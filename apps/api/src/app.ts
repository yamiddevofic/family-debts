import {
  advertenciasDeCambio,
  estadoGrupo,
  generarPeriodos,
  sePuedeEliminar,
  validarAporte,
  validarObjetivo,
  type EstadoAlmacenado,
  type Involucrado,
  type Minor,
  type Objetivo,
  type Problema,
} from '@deudas/core';
import { Hono } from 'hono';
import type { Acceso } from './acceso.ts';
import { resolverEnlace } from './acceso.ts';
import type { Base } from './db/base.ts';
import { enTransaccion } from './db/base.ts';
import { generarToken, hashDeToken, rutaSinToken } from './enlaces.ts';
import {
  ErrorHttp,
  conflictoDeVersion,
  cuerpoDeError,
  datosInvalidos,
  noEncontrado,
  soloLectura,
} from './errores.ts';
import type { Reloj } from './reloj.ts';
import * as repo from './repositorio.ts';

/**
 * API HTTP — DT-06.
 *
 * Traduce HTTP y SQL a estructuras del núcleo y de vuelta. Aquí viven el reloj, los
 * identificadores, la aleatoriedad y la autorización por enlace; el núcleo no sabe que nada
 * de esto existe (Artículo II).
 */

export interface Dependencias {
  base: Base;
  reloj: Reloj;
  /** Registro de peticiones. Recibe la ruta ya enmascarada (RNF-06). */
  registrar?: (linea: string) => void;
}

type Variables = { acceso: Acceso };

const objeto = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});
const cadena = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function crearApp({ base, reloj, registrar }: Dependencias): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  // RNF-06 y DT-09: el token no viaja en la cabecera de referencia, las páginas de grupo no
  // se indexan, y nunca aparece completo en un registro.
  app.use('*', async (c, siguiente) => {
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('X-Content-Type-Options', 'nosniff');
    registrar?.(`${c.req.method} ${rutaSinToken(new URL(c.req.url).pathname)}`);
    await siguiente();
  });

  app.onError((error, c) => {
    if (error instanceof ErrorHttp) return c.json(cuerpoDeError(error), error.estado);
    registrar?.(`ERROR ${error.message}`);
    return c.json(
      { error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo falló de nuestro lado.' } },
      500,
    );
  });

  // ── Crear grupo — RF-01, HU-01 ────────────────────────────────────────────────────────
  app.post('/api/grupos', async (c) => {
    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const nombre = cadena(cuerpo.nombre);
    const codigoMoneda = cadena(cuerpo.codigoMoneda) || 'COP';
    const exponente = typeof cuerpo.exponente === 'number' ? cuerpo.exponente : 0;

    const problemas: Problema[] = [];
    if (nombre === '') {
      problemas.push({ codigo: 'NOMBRE_VACIO', campo: 'nombre', mensaje: 'El grupo necesita un nombre.' });
    }
    if (!Number.isInteger(exponente) || exponente < 0 || exponente > 4) {
      problemas.push({
        codigo: 'EXPONENTE_INVALIDO',
        campo: 'exponente',
        mensaje: 'El exponente de la moneda es 0 para COP y 2 para USD.',
      });
    }
    if (problemas.length > 0) throw datosInvalidos(problemas);

    const tokenEdicion = generarToken();
    const tokenLectura = generarToken();
    const id = reloj.nuevoId();
    const creadoEn = reloj.ahora();

    repo.crearGrupo(base, {
      id,
      nombre,
      codigoMoneda,
      exponente,
      hashEdicion: hashDeToken(tokenEdicion),
      hashLectura: hashDeToken(tokenLectura),
      creadoEn,
    });

    // Los tokens se devuelven **una sola vez**: en la base solo queda su hash (DT-09).
    return c.json(
      {
        grupo: { id, nombre, moneda: { codigo: codigoMoneda, exponente }, creadoEn },
        enlaceEdicion: tokenEdicion,
        enlaceLectura: tokenLectura,
        advertencia:
          'Guarda estos enlaces ahora. No se pueden recuperar: si los pierdes, hay que crear el grupo otra vez.',
      },
      201,
    );
  });

  // ── Todo lo demás exige un enlace válido — RN-17, Artículo VI ──────────────────────────
  app.use('/api/g/:token/*', async (c, siguiente) => {
    const acceso = resolverEnlace(base, c.req.param('token'));
    if (!acceso) throw noEncontrado();
    c.set('acceso', acceso);
    await siguiente();
  });

  const exigirEdicion = (c: { get: (k: 'acceso') => Acceso }): Acceso => {
    const acceso = c.get('acceso');
    if (acceso.permiso !== 'EDICION') throw soloLectura();
    return acceso;
  };

  // ── Estado completo del grupo — RF-13, RF-15, HU-06 ───────────────────────────────────
  app.get('/api/g/:token/estado', (c) => {
    const { grupoId, permiso } = c.get('acceso');
    const grupo = repo.leerGrupo(base, grupoId);
    if (!grupo) throw noEncontrado();

    const hoy = reloj.hoy();
    const estado = estadoGrupo(
      grupo,
      repo.listarMiembros(base, grupoId),
      repo.listarObjetivos(base, grupoId),
      repo.listarAportes(base, grupoId),
      hoy,
    );
    return c.json({ permiso, estado });
  });

  // ── Rotar un enlace — RF-03, RG-02 ────────────────────────────────────────────────────
  app.post('/api/g/:token/rotar-enlace', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const tipo = cadena(cuerpo.tipo).toUpperCase();
    if (tipo !== 'EDICION' && tipo !== 'LECTURA') {
      throw datosInvalidos([
        { codigo: 'TIPO_INVALIDO', campo: 'tipo', mensaje: 'Se rota el enlace de EDICION o el de LECTURA.' },
      ]);
    }

    const nuevo = generarToken();
    repo.rotarHash(base, grupoId, tipo, hashDeToken(nuevo));
    return c.json({
      tipo,
      enlace: nuevo,
      advertencia:
        'El enlace anterior dejó de funcionar para todos. Hay que volver a compartir este con la familia.',
    });
  });

  // ── Eliminar el grupo entero — RF-23, RN-19, HU-09 ────────────────────────────────────
  app.delete('/api/g/:token/grupo', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const grupo = repo.leerGrupo(base, grupoId);
    if (!grupo) throw noEncontrado();

    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const confirmacion = cadena(cuerpo.confirmacion);

    // CB-18 — hay que escribir el nombre exacto. Un "¿estás seguro?" se acepta sin leer, y
    // esta es la única operación del sistema que no se puede deshacer ni auditar después.
    //
    // Se comparan las cadenas ya recortadas: lo que la confirmación tiene que probar es la
    // intención, no la mecanografía, y un espacio que mete el teclado del móvil no la debilita.
    // Las mayúsculas sí cuentan: escribir el nombre como es exige haberlo leído.
    if (confirmacion !== grupo.nombre) {
      throw datosInvalidos([
        {
          codigo: 'CONFIRMACION_NO_COINCIDE',
          campo: 'confirmacion',
          mensaje: `Para eliminar el grupo hay que escribir su nombre exacto: «${grupo.nombre}». No se borró nada.`,
        },
      ]);
    }

    enTransaccion(base, () => {
      repo.borrarGrupo(base, grupoId);
    });

    // CB-19 — los dos enlaces dejan de resolver de inmediato: ya no hay grupo que resolver.
    return c.body(null, 204);
  });

  // ── Miembros — RF-04, RN-14, HU-02 ────────────────────────────────────────────────────
  app.post('/api/g/:token/miembros', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const nombre = cadena(cuerpo.nombre);
    if (nombre === '') {
      throw datosInvalidos([
        { codigo: 'NOMBRE_VACIO', campo: 'nombre', mensaje: 'El miembro necesita un nombre.' },
      ]);
    }

    const id = reloj.nuevoId();
    repo.crearMiembro(base, { id, grupoId, nombre, creadoEn: reloj.ahora() });

    // CB-08: dos miembros con el mismo nombre se permiten; la interfaz avisa.
    const repetido = repo
      .listarMiembros(base, grupoId)
      .some((m) => m.id !== id && m.nombre.toLowerCase() === nombre.toLowerCase());

    return c.json({ miembro: repo.leerMiembro(base, grupoId, id), nombreRepetido: repetido }, 201);
  });

  app.patch('/api/g/:token/miembros/:id', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const miembroId = c.req.param('id');
    if (!repo.leerMiembro(base, grupoId, miembroId)) throw noEncontrado();

    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const cambios: { nombre?: string; activo?: boolean } = {};
    if (typeof cuerpo.nombre === 'string') {
      const nombre = cadena(cuerpo.nombre);
      if (nombre === '') {
        throw datosInvalidos([
          { codigo: 'NOMBRE_VACIO', campo: 'nombre', mensaje: 'El miembro necesita un nombre.' },
        ]);
      }
      cambios.nombre = nombre;
    }
    if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo;

    repo.actualizarMiembro(base, grupoId, miembroId, cambios);
    return c.json({ miembro: repo.leerMiembro(base, grupoId, miembroId) });
  });

  app.delete('/api/g/:token/miembros/:id', (c) => {
    const { grupoId } = exigirEdicion(c);
    const miembroId = c.req.param('id');
    if (!repo.leerMiembro(base, grupoId, miembroId)) throw noEncontrado();

    // RN-14 y Artículo V: quien tiene aportes no se elimina jamás, se desactiva.
    if (repo.contarAportesDelMiembro(base, grupoId, miembroId) > 0) {
      throw new ErrorHttp(
        409,
        'MIEMBRO_CON_APORTES',
        'Esta persona ya tiene aportes registrados, así que no se puede eliminar sin perder historial. ' +
          'Se puede marcar como inactiva: conserva todo y deja de aparecer en objetivos nuevos.',
      );
    }
    if (repo.contarInvolucramientos(base, grupoId, miembroId) > 0) {
      throw new ErrorHttp(
        409,
        'MIEMBRO_INVOLUCRADO',
        'Esta persona está involucrada en algún objetivo. Se puede marcar como inactiva.',
      );
    }

    repo.borrarMiembro(base, grupoId, miembroId);
    return c.body(null, 204);
  });

  // ── Objetivos — RF-05, RF-06, RF-07, HU-03, HU-04 ─────────────────────────────────────
  app.post('/api/g/:token/objetivos', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const cuerpo = objeto(await c.req.json().catch(() => ({})));

    const miembros = repo.listarMiembros(base, grupoId);
    // CB-11: sin miembros no se pueden crear objetivos.
    if (miembros.length === 0) {
      throw datosInvalidos([
        {
          codigo: 'GRUPO_SIN_MIEMBROS',
          campo: 'involucrados',
          mensaje: 'Primero hay que agregar a las personas del grupo (CB-11).',
        },
      ]);
    }

    const borrador = construirBorrador(cuerpo);
    const problemas = validarObjetivo(borrador);
    const conocidos = new Set(miembros.map((m) => m.id));
    for (const involucrado of borrador.involucrados) {
      if (!conocidos.has(involucrado.miembroId)) {
        problemas.push({
          codigo: 'MIEMBRO_DESCONOCIDO',
          campo: 'involucrados',
          mensaje: 'Alguno de los involucrados no es miembro de este grupo.',
        });
      }
    }
    if (problemas.length > 0) throw datosInvalidos(problemas);

    const objetivo: Objetivo = {
      id: reloj.nuevoId(),
      grupoId,
      nombre: borrador.nombre,
      descripcion: typeof cuerpo.descripcion === 'string' ? cadena(cuerpo.descripcion) || null : null,
      montoTotal: borrador.montoTotal as Minor,
      modalidad: borrador.modalidad,
      estado: 'ACTIVO',
      periodicidad: borrador.periodicidad,
      fechaInicio: borrador.fechaInicio as Objetivo['fechaInicio'],
      fechaLimite: borrador.fechaLimite as Objetivo['fechaLimite'],
      involucrados: borrador.involucrados,
      version: 1,
      creadoEn: reloj.ahora(),
    };

    enTransaccion(base, () => {
      repo.crearObjetivo(base, objetivo);
    });
    return c.json({ objetivo }, 201);
  });

  // ── Editar un objetivo — RF-16, RN-11, HU-08 ──────────────────────────────────────────
  app.patch('/api/g/:token/objetivos/:id', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const objetivoId = c.req.param('id');
    const actual = repo.leerObjetivo(base, grupoId, objetivoId);
    if (!actual) throw noEncontrado();

    const cuerpo = objeto(await c.req.json().catch(() => ({})));

    // RN-18 y DT-10: quien edita manda la versión que leyó. Sin ella no se puede saber si
    // está pisando el cambio de otra persona, así que se exige.
    if (typeof cuerpo.version !== 'number') {
      throw datosInvalidos([
        {
          codigo: 'VERSION_REQUERIDA',
          campo: 'version',
          mensaje: 'Falta la versión del objetivo que se está editando.',
        },
      ]);
    }

    const miembros = repo.listarMiembros(base, grupoId);
    const borrador = construirBorrador(cuerpo, actual);
    const problemas = validarObjetivo(borrador);
    const conocidos = new Set(miembros.map((m) => m.id));
    for (const involucrado of borrador.involucrados) {
      if (!conocidos.has(involucrado.miembroId)) {
        problemas.push({
          codigo: 'MIEMBRO_DESCONOCIDO',
          campo: 'involucrados',
          mensaje: 'Alguno de los involucrados no es miembro de este grupo.',
        });
      }
    }
    if (problemas.length > 0) throw datosInvalidos(problemas);

    const editado: Objetivo = {
      ...actual,
      nombre: borrador.nombre,
      descripcion: typeof cuerpo.descripcion === 'string' ? cadena(cuerpo.descripcion) || null : actual.descripcion,
      montoTotal: borrador.montoTotal as Minor,
      modalidad: borrador.modalidad,
      periodicidad: borrador.periodicidad,
      fechaInicio: borrador.fechaInicio as Objetivo['fechaInicio'],
      fechaLimite: borrador.fechaLimite as Objetivo['fechaLimite'],
      involucrados: borrador.involucrados,
    };

    const aportes = repo.listarAportes(base, grupoId);
    const advertencias = advertenciasDeCambio(actual, editado, aportes);

    // RN-11.3: el cambio que deja a alguien con saldo a favor no se aplica sin que quien
    // edita lo haya visto. La interfaz manda `confirmado: true` después de mostrarlo.
    if (advertencias.length > 0 && cuerpo.confirmado !== true) {
      return c.json({ requiereConfirmacion: true, advertencias, objetivo: null }, 409);
    }

    const aplicado = enTransaccion(base, () =>
      repo.actualizarObjetivo(base, grupoId, editado, cuerpo.version as number),
    );
    if (!aplicado) throw conflictoDeVersion();

    return c.json({
      objetivo: repo.leerObjetivo(base, grupoId, objetivoId),
      advertencias,
      requiereConfirmacion: false,
    });
  });

  // ── Cancelar, archivar y reactivar — RF-17, RN-16 ─────────────────────────────────────
  app.post('/api/g/:token/objetivos/:id/estado', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const objetivoId = c.req.param('id');
    const actual = repo.leerObjetivo(base, grupoId, objetivoId);
    if (!actual) throw noEncontrado();

    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const estado = cadena(cuerpo.estado).toUpperCase() as EstadoAlmacenado;
    if (!['ACTIVO', 'CANCELADO', 'ARCHIVADO'].includes(estado)) {
      throw datosInvalidos([
        {
          codigo: 'ESTADO_INVALIDO',
          campo: 'estado',
          mensaje: 'Un objetivo puede quedar ACTIVO, CANCELADO o ARCHIVADO.',
        },
      ]);
    }
    if (typeof cuerpo.version !== 'number') {
      throw datosInvalidos([
        { codigo: 'VERSION_REQUERIDA', campo: 'version', mensaje: 'Falta la versión del objetivo.' },
      ]);
    }

    if (!repo.cambiarEstadoObjetivo(base, grupoId, objetivoId, estado, cuerpo.version)) {
      throw conflictoDeVersion();
    }
    return c.json({ objetivo: repo.leerObjetivo(base, grupoId, objetivoId) });
  });

  // ── Eliminar un objetivo — RF-22, RN-16, CB-16 ────────────────────────────────────────
  app.delete('/api/g/:token/objetivos/:id', (c) => {
    const { grupoId } = exigirEdicion(c);
    const objetivoId = c.req.param('id');
    if (!repo.leerObjetivo(base, grupoId, objetivoId)) throw noEncontrado();

    // CB-16: un aporte anulado sigue siendo historial. Lo que protege el Artículo V es el
    // registro de que alguien puso dinero, no el saldo que ese registro produce.
    if (!sePuedeEliminar(objetivoId, repo.listarAportes(base, grupoId))) {
      throw new ErrorHttp(
        409,
        'OBJETIVO_CON_APORTES',
        'Este objetivo ya tiene aportes registrados, así que eliminarlo perdería historial. ' +
          'Se puede cancelar, si se abandonó, o archivar, si se completó: ninguna de las dos borra nada.',
      );
    }

    enTransaccion(base, () => {
      repo.borrarObjetivo(base, grupoId, objetivoId);
    });
    return c.body(null, 204);
  });

  // ── Aportes — RF-09, RF-10, RF-11, HU-05 ──────────────────────────────────────────────
  app.post('/api/g/:token/aportes', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const cuerpo = objeto(await c.req.json().catch(() => ({})));

    const objetivoId = cadena(cuerpo.objetivoId);
    const objetivo = repo.leerObjetivo(base, grupoId, objetivoId);
    // Un objetivo de otro grupo responde 404 igual que uno inexistente (T-023).
    if (!objetivo) throw noEncontrado();

    const nPeriodos = contarPeriodos(objetivo);
    const acreditadoA = cadena(cuerpo.acreditadoA);
    const borrador = {
      monto: typeof cuerpo.monto === 'number' ? cuerpo.monto : Number.NaN,
      fechaValor: typeof cuerpo.fechaValor === 'string' ? cuerpo.fechaValor : '',
      acreditadoA,
      // RN-15: si no se dice quién pagó, pagó la misma persona a la que se acredita.
      pagadoPor: cadena(cuerpo.pagadoPor) || acreditadoA,
      periodoIndice: typeof cuerpo.periodoIndice === 'number' ? cuerpo.periodoIndice : null,
      registradoPor: cadena(cuerpo.registradoPor),
    };

    const problemas = validarAporte(borrador, {
      involucrados: objetivo.involucrados.map((i) => i.miembroId),
      miembrosDelGrupo: repo.listarMiembros(base, grupoId).map((m) => m.id),
      nPeriodos,
    });
    if (problemas.length > 0) throw datosInvalidos(problemas);

    const aporte = {
      id: reloj.nuevoId(),
      grupoId,
      objetivoId,
      acreditadoA: borrador.acreditadoA,
      pagadoPor: borrador.pagadoPor,
      monto: borrador.monto as Minor,
      fechaValor: borrador.fechaValor as Objetivo['fechaInicio'] & string,
      periodoIndice: borrador.periodoIndice,
      metodo: typeof cuerpo.metodo === 'string' ? cadena(cuerpo.metodo) || null : null,
      nota: typeof cuerpo.nota === 'string' ? cadena(cuerpo.nota) || null : null,
      registradoPor: borrador.registradoPor,
      registradoEn: reloj.ahora(),
      anulacion: null,
    };

    repo.crearAporte(base, aporte);
    return c.json({ aporte }, 201);
  });

  // ── Anular un aporte — RF-12, RN-13, HU-07 ────────────────────────────────────────────
  app.post('/api/g/:token/aportes/:id/anular', async (c) => {
    const { grupoId } = exigirEdicion(c);
    const aporteId = c.req.param('id');
    const aporte = repo.leerAporte(base, grupoId, aporteId);
    if (!aporte) throw noEncontrado();

    const cuerpo = objeto(await c.req.json().catch(() => ({})));
    const motivo = cadena(cuerpo.motivo);
    const anuladoPor = cadena(cuerpo.anuladoPor);

    const problemas: Problema[] = [];
    // El motivo es obligatorio: una anulación sin motivo no cierra ninguna discusión.
    if (motivo === '') {
      problemas.push({
        codigo: 'MOTIVO_OBLIGATORIO',
        campo: 'motivo',
        mensaje: 'Anular exige decir por qué: es lo que queda en el historial (RN-13).',
      });
    }
    if (anuladoPor === '') {
      problemas.push({
        codigo: 'ANULADO_POR_VACIO',
        campo: 'anuladoPor',
        mensaje: 'Falta decir quién anula el aporte.',
      });
    }
    if (problemas.length > 0) throw datosInvalidos(problemas);

    // Un aporte anulado no se reactiva ni se vuelve a anular (HU-07).
    if (aporte.anulacion !== null) {
      throw new ErrorHttp(
        409,
        'APORTE_YA_ANULADO',
        'Este aporte ya estaba anulado. Si la anulación fue el error, se registra un aporte nuevo que lo mencione.',
      );
    }

    const objetivo = repo.leerObjetivo(base, grupoId, aporte.objetivoId);
    repo.anularAporte(base, grupoId, aporteId, {
      motivo,
      anuladoPor,
      anuladoEn: reloj.ahora(),
    });

    return c.json({
      aporte: repo.leerAporte(base, grupoId, aporteId),
      // CB-13: anular sobre un archivado se permite, avisando que toca un histórico cerrado.
      advertencia:
        objetivo?.estado === 'ARCHIVADO'
          ? 'Este objetivo estaba archivado: la anulación altera un histórico ya cerrado.'
          : null,
    });
  });

  return app;
}

/**
 * Lee del cuerpo de la petición la definición de un objetivo, en la forma que espera
 * `validarObjetivo`. La usan crear y editar: si cada una interpretara el JSON a su manera,
 * un objetivo válido al crearlo podría dejar de serlo al editarlo sin haberlo tocado.
 *
 * Al editar, los campos ausentes conservan el valor actual.
 */
function construirBorrador(cuerpo: Record<string, unknown>, actual?: Objetivo) {
  const ids = Array.isArray(cuerpo.involucrados)
    ? cuerpo.involucrados.map((v) => cadena(v)).filter((v) => v !== '')
    : actual?.involucrados.map((i) => i.miembroId) ?? [];

  const modalidad =
    typeof cuerpo.modalidad === 'string'
      ? cuerpo.modalidad === 'CUOTAS_PERIODICAS'
        ? ('CUOTAS_PERIODICAS' as const)
        : ('REPARTO_UNICO' as const)
      : (actual?.modalidad ?? ('REPARTO_UNICO' as const));

  const fecha = (clave: 'fechaInicio' | 'fechaLimite'): string | null => {
    const enviada = cuerpo[clave];
    if (typeof enviada === 'string') return enviada === '' ? null : enviada;
    return actual?.[clave] ?? null;
  };

  const involucrados: Involucrado[] = ids.map((miembroId, orden) => ({
    miembroId,
    tipoParte: 'IGUAL' as const,
    valorParte: 0,
    orden,
  }));

  return {
    nombre: typeof cuerpo.nombre === 'string' ? cadena(cuerpo.nombre) : (actual?.nombre ?? ''),
    montoTotal:
      typeof cuerpo.montoTotal === 'number' ? cuerpo.montoTotal : (actual?.montoTotal ?? Number.NaN),
    modalidad,
    periodicidad:
      modalidad === 'CUOTAS_PERIODICAS'
        ? cuerpo.periodicidad === 'MENSUAL' || (cuerpo.periodicidad === undefined && actual?.periodicidad === 'MENSUAL')
          ? ('MENSUAL' as const)
          : null
        : null,
    fechaInicio: modalidad === 'CUOTAS_PERIODICAS' ? fecha('fechaInicio') : null,
    fechaLimite: fecha('fechaLimite'),
    involucrados,
  };
}

/**
 * Número de cuotas de un objetivo. El cálculo del calendario es RN-05 y vive en el núcleo:
 * reimplementarlo aquí sería tener dos versiones de la misma regla, que es exactamente como
 * se empiezan a desviar.
 */
function contarPeriodos(objetivo: Objetivo): number {
  if (objetivo.modalidad !== 'CUOTAS_PERIODICAS' || !objetivo.fechaInicio || !objetivo.fechaLimite) return 0;
  return generarPeriodos(objetivo.fechaInicio, objetivo.fechaLimite).length;
}
