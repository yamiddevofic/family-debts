import { describe, expect, it } from 'vitest';
import { grupoDeEjemplo, montarApi, pedir, type Contexto } from './ayudas.ts';

const objetivoDe = (datos: any, nombre = 'Nevera') =>
  datos.estado.objetivos.find((o: { nombre: string }) => o.nombre === nombre);

async function aportar(ctx: Contexto, enlace: string, objetivoId: string, acreditadoA: string, monto: number) {
  const { datos } = await pedir(ctx, 'POST', `/api/g/${enlace}/aportes`, {
    objetivoId,
    acreditadoA,
    monto,
    fechaValor: '2026-09-10',
    registradoPor: 'Ana',
  });
  return datos.aporte.id as string;
}

const versionDe = async (ctx: Contexto, enlace: string, nombre = 'Nevera') =>
  objetivoDe((await pedir(ctx, 'GET', `/api/g/${enlace}/estado`)).datos, nombre).version as number;

describe('RN-11 — cambio del monto total o de los involucrados', () => {
  it('HU-08 — al cambiar el monto las obligaciones se recalculan y ningún aporte se altera', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const aporteId = await aportar(ctx, edicion, objetivoId, miembros.Ana, 33_334);

    const cambio = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      montoTotal: 300_000,
      version: await versionDe(ctx, edicion),
    });
    expect(cambio.estado).toBe(200);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const nevera = objetivoDe(datos);
    expect(nevera.involucrados.map((i: { obligacion: number }) => i.obligacion)).toEqual([
      100_000, 100_000, 100_000,
    ]);
    // El aporte sigue intacto: mismo id, mismo monto.
    expect(nevera.aportes).toHaveLength(1);
    expect(nevera.aportes[0].aporteId).toBe(aporteId);
    expect(nevera.aportes[0].monto).toBe(33_334);
    expect(nevera.recaudado).toBe(33_334);
  });

  it('avisa con nombre y monto antes de dejar a alguien con saldo a favor, y no aplica el cambio', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 33_334);

    const intento = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      montoTotal: 30_000,
      version: await versionDe(ctx, edicion),
    });

    expect(intento.estado).toBe(409);
    expect(intento.datos.requiereConfirmacion).toBe(true);
    const deAna = intento.datos.advertencias.find(
      (a: { miembroId: string | null }) => a.miembroId === miembros.Ana,
    );
    expect(deAna.tipo).toBe('SALDO_A_FAVOR');
    expect(deAna.monto).toBe(23_334);

    // Sin confirmar, el objetivo sigue como estaba.
    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(datos).montoTotal).toBe(100_000);
  });

  it('con la confirmación explícita sí se aplica, y el saldo a favor queda visible (RN-09)', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 33_334);

    const cambio = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      montoTotal: 30_000,
      confirmado: true,
      version: await versionDe(ctx, edicion),
    });
    expect(cambio.estado).toBe(200);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const ana = objetivoDe(datos).involucrados.find(
      (i: { miembroId: string }) => i.miembroId === miembros.Ana,
    );
    expect(ana.obligacion).toBe(10_000);
    expect(ana.aFavor).toBe(23_334);
  });

  it('retirar a alguien que ya aportó deja su obligación en cero y avisa antes', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Sara, 33_333);

    const cuerpo = {
      involucrados: [miembros.Ana, miembros.Luis],
      version: await versionDe(ctx, edicion),
    };

    const aviso = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, cuerpo);
    expect(aviso.estado).toBe(409);
    const deSara = aviso.datos.advertencias[0];
    expect(deSara.tipo).toBe('INVOLUCRADO_RETIRADO');
    expect(deSara.monto).toBe(33_333);

    const aplicado = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      ...cuerpo,
      confirmado: true,
      version: await versionDe(ctx, edicion),
    });
    expect(aplicado.estado).toBe(200);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const nevera = objetivoDe(datos);
    expect(nevera.involucrados).toHaveLength(2);
    // El aporte de Sara no se borró ni se movió: sigue contando en lo recaudado.
    expect(nevera.recaudado).toBe(33_333);
    expect(nevera.aportes).toHaveLength(1);
  });

  it('CB-07 — bajar el monto por debajo de lo aportado se permite, avisando', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 50_000);

    const aviso = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      montoTotal: 20_000,
      version: await versionDe(ctx, edicion),
    });
    expect(
      aviso.datos.advertencias.some((a: { tipo: string }) => a.tipo === 'MONTO_BAJO_LO_APORTADO'),
    ).toBe(true);
  });

  it('un cambio que no deja a nadie con saldo a favor se aplica sin confirmación', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 10_000);

    const cambio = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      nombre: 'Nevera nueva',
      montoTotal: 200_000,
      version: await versionDe(ctx, edicion),
    });
    expect(cambio.estado).toBe(200);
    expect(cambio.datos.advertencias).toEqual([]);
    expect(cambio.datos.objetivo.nombre).toBe('Nevera nueva');
  });

  it('editar respeta las mismas validaciones que crear (RF-07)', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      montoTotal: 0,
      involucrados: [],
      version: await versionDe(ctx, edicion),
    });
    expect(intento.estado).toBe(422);
    expect(intento.datos.error.problemas.map((p: { codigo: string }) => p.codigo).sort()).toEqual([
      'MONTO_INVALIDO',
      'SIN_INVOLUCRADOS',
    ]);
  });

  it('no se puede editar un objetivo de otro grupo', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'PATCH', `/api/g/${casa.edicion}/objetivos/${otra.objetivoId}`, {
      montoTotal: 1,
      version: 1,
    });
    expect(intento.estado).toBe(404);
  });

  it('con el enlace de lectura no se puede editar', async () => {
    const ctx = montarApi();
    const { lectura, objetivoId } = await grupoDeEjemplo(ctx);
    expect(
      (await pedir(ctx, 'PATCH', `/api/g/${lectura}/objetivos/${objetivoId}`, { montoTotal: 1, version: 1 }))
        .estado,
    ).toBe(403);
  });
});

describe('RN-18 — escrituras concurrentes', () => {
  it('RF-19 — la segunda edición del mismo objetivo detecta el conflicto y pide recargar', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    const version = await versionDe(ctx, edicion);

    // Dos personas leyeron la misma versión y editan una detrás de otra.
    const primera = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      nombre: 'Nevera de Ana',
      version,
    });
    expect(primera.estado).toBe(200);

    const segunda = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      nombre: 'Nevera de Luis',
      version,
    });
    expect(segunda.estado).toBe(409);
    expect(segunda.datos.error.codigo).toBe('CONFLICTO_DE_VERSION');
    expect(segunda.datos.error.mensaje).toMatch(/recarga/i);

    // El cambio de la primera persona no se pisó.
    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(datos.estado.objetivos[0].nombre).toBe('Nevera de Ana');
  });

  it('la versión sube con cada cambio, así que al recargar se puede reintentar', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    expect(await versionDe(ctx, edicion)).toBe(1);
    await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      nombre: 'Nevera',
      version: 1,
    });
    expect(await versionDe(ctx, edicion)).toBe(2);
  });

  it('los aportes solo se añaden: dos registros simultáneos se conservan los dos', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const [a, b] = await Promise.all([
      aportar(ctx, edicion, objetivoId, miembros.Ana, 10_000),
      aportar(ctx, edicion, objetivoId, miembros.Luis, 5_000),
    ]);
    expect(a).not.toBe(b);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(datos).aportes).toHaveLength(2);
    expect(objetivoDe(datos).recaudado).toBe(15_000);
  });

  it('editar exige mandar la versión: sin ella no se puede saber si se pisa a alguien', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    const intento = await pedir(ctx, 'PATCH', `/api/g/${edicion}/objetivos/${objetivoId}`, {
      nombre: 'Sin versión',
    });
    expect(intento.estado).toBe(422);
    expect(intento.datos.error.problemas[0].codigo).toBe('VERSION_REQUERIDA');
  });
});

describe('RN-16 — cancelación, archivado y eliminación', () => {
  const cambiarEstado = (ctx: Contexto, enlace: string, id: string, estado: string, version: number) =>
    pedir(ctx, 'POST', `/api/g/${enlace}/objetivos/${id}/estado`, { estado, version });

  it('HU-08 — cancelar deja de contar en los totales y los aportes quedan como saldo a favor', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 33_334);

    await cambiarEstado(ctx, edicion, objetivoId, 'CANCELADO', await versionDe(ctx, edicion));

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const nevera = objetivoDe(datos);
    expect(nevera.estado).toBe('CANCELADO');
    // Las obligaciones dejan de exigirse.
    expect(nevera.involucrados.every((i: { obligacion: number }) => i.obligacion === 0)).toBe(true);
    expect(nevera.faltante).toBe(0);
    expect(nevera.saldado).toBe(false);
    // Y lo aportado queda a favor, visible.
    const ana = nevera.involucrados.find((i: { miembroId: string }) => i.miembroId === miembros.Ana);
    expect(ana.aFavor).toBe(33_334);
    // Fuera de los totales del grupo.
    expect(datos.estado.totalNecesario).toBe(0);
    expect(datos.estado.totalFaltante).toBe(0);
  });

  it('un objetivo cancelado no genera mora aunque su fecha límite haya pasado (RN-12)', async () => {
    const ctx = montarApi();
    const { edicion, miembros } = await grupoDeEjemplo(ctx);
    const { datos: creado } = await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
      nombre: 'Techo',
      montoTotal: 900_000,
      modalidad: 'CUOTAS_PERIODICAS',
      periodicidad: 'MENSUAL',
      fechaInicio: '2026-01-05',
      fechaLimite: '2026-03-05',
      involucrados: [miembros.Ana],
    });
    ctx.reloj.fijarHoy('2026-06-01');
    expect(objetivoDe((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).datos, 'Techo').enMora).toBe(true);

    await cambiarEstado(ctx, edicion, creado.objetivo.id, 'CANCELADO', await versionDe(ctx, edicion, 'Techo'));
    expect(objetivoDe((await pedir(ctx, 'GET', `/api/g/${edicion}/estado`)).datos, 'Techo').enMora).toBe(false);
  });

  it('archivar conserva las obligaciones: sale de la vista principal, no del histórico', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    await cambiarEstado(ctx, edicion, objetivoId, 'ARCHIVADO', await versionDe(ctx, edicion));

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    const nevera = objetivoDe(datos);
    expect(nevera.estado).toBe('ARCHIVADO');
    expect(nevera.involucrados[0].obligacion).toBe(33_334);
    expect(datos.estado.totalNecesario).toBe(0);
  });

  it('cancelar y archivar son reversibles: se puede volver a ACTIVO', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    await cambiarEstado(ctx, edicion, objetivoId, 'CANCELADO', await versionDe(ctx, edicion));
    await cambiarEstado(ctx, edicion, objetivoId, 'ACTIVO', await versionDe(ctx, edicion));

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(objetivoDe(datos).estado).toBe('ACTIVO');
    expect(datos.estado.totalNecesario).toBe(100_000);
  });

  it('ninguno de los dos borra datos: los aportes siguen en la base', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 33_334);
    await cambiarEstado(ctx, edicion, objetivoId, 'CANCELADO', await versionDe(ctx, edicion));

    const filas = ctx.base.prepare('SELECT COUNT(*) AS n FROM aporte').get() as { n: number };
    expect(filas.n).toBe(1);
  });

  it('RF-22 — un objetivo sin ningún aporte se elimina de verdad', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'DELETE', `/api/g/${edicion}/objetivos/${objetivoId}`)).estado).toBe(204);

    const { datos } = await pedir(ctx, 'GET', `/api/g/${edicion}/estado`);
    expect(datos.estado.objetivos).toHaveLength(0);
    // También desaparecen sus involucrados: eran la definición de un acuerdo que nadie cumplió.
    const filas = ctx.base.prepare('SELECT COUNT(*) AS n FROM involucrado').get() as { n: number };
    expect(filas.n).toBe(0);
  });

  it('RF-22 — un objetivo con aportes no se elimina: 409 que ofrece cancelar o archivar', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    await aportar(ctx, edicion, objetivoId, miembros.Ana, 10_000);

    const intento = await pedir(ctx, 'DELETE', `/api/g/${edicion}/objetivos/${objetivoId}`);
    expect(intento.estado).toBe(409);
    expect(intento.datos.error.codigo).toBe('OBJETIVO_CON_APORTES');
    expect(intento.datos.error.mensaje).toMatch(/cancelar/i);
    expect(intento.datos.error.mensaje).toMatch(/archivar/i);
  });

  it('CB-16 — tampoco se elimina si sus únicos aportes están anulados', async () => {
    const ctx = montarApi();
    const { edicion, miembros, objetivoId } = await grupoDeEjemplo(ctx);
    const aporteId = await aportar(ctx, edicion, objetivoId, miembros.Ana, 10_000);
    await pedir(ctx, 'POST', `/api/g/${edicion}/aportes/${aporteId}/anular`, {
      motivo: 'Error de dedo',
      anuladoPor: 'Ana',
    });

    const intento = await pedir(ctx, 'DELETE', `/api/g/${edicion}/objetivos/${objetivoId}`);
    expect(intento.estado).toBe(409);
  });

  it('no se puede eliminar un objetivo de otro grupo, ni con el enlace de lectura', async () => {
    const ctx = montarApi();
    const casa = await grupoDeEjemplo(ctx);
    const otra = await grupoDeEjemplo(ctx);
    expect((await pedir(ctx, 'DELETE', `/api/g/${casa.edicion}/objetivos/${otra.objetivoId}`)).estado).toBe(404);
    expect((await pedir(ctx, 'DELETE', `/api/g/${casa.lectura}/objetivos/${casa.objetivoId}`)).estado).toBe(403);
  });

  it('un estado que no existe se rechaza', async () => {
    const ctx = montarApi();
    const { edicion, objetivoId } = await grupoDeEjemplo(ctx);
    const intento = await cambiarEstado(ctx, edicion, objetivoId, 'BORRADO', 1);
    expect(intento.estado).toBe(422);
  });
});
