import type {
  Aporte,
  EstadoAlmacenado,
  FechaCivil,
  Grupo,
  Id,
  Involucrado,
  Miembro,
  Minor,
  Modalidad,
  Objetivo,
  Periodicidad,
  TipoParte,
} from '@deudas/core';
import type { Base } from './db/base.ts';

/**
 * Traduce entre filas de SQLite y las estructuras del núcleo.
 *
 * **Toda** consulta filtra por `grupo_id`, y ese `grupo_id` viene siempre de resolver el
 * enlace, nunca de la petición del cliente (Artículo VI). Es la única defensa real contra
 * que un grupo vea los datos de otro, y por eso no hay ni una consulta sin ese filtro.
 */

type Fila = Record<string, unknown>;

// SQLite devuelve `string | number | bigint | Uint8Array | null`. Estas tres funciones
// estrechan ese tipo sin `as`, para que una columna con un valor inesperado se note aquí y
// no tres capas más adentro.
function texto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint') return String(valor);
  return '';
}

function textoOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return texto(valor);
}

function entero(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number(textoOpcional(valor) ?? 0);
}

function aMiembro(fila: Fila): Miembro {
  return {
    id: texto(fila.id),
    grupoId: texto(fila.grupo_id),
    nombre: texto(fila.nombre),
    activo: entero(fila.activo) === 1,
    creadoEn: texto(fila.creado_en),
  };
}

function aAporte(fila: Fila): Aporte {
  const anuladoEn = textoOpcional(fila.anulado_en);
  return {
    id: texto(fila.id),
    grupoId: texto(fila.grupo_id),
    objetivoId: texto(fila.objetivo_id),
    acreditadoA: texto(fila.acreditado_a),
    pagadoPor: texto(fila.pagado_por),
    monto: entero(fila.monto) as Minor,
    fechaValor: texto(fila.fecha_valor) as FechaCivil,
    periodoIndice: fila.periodo_indice === null ? null : entero(fila.periodo_indice),
    metodo: textoOpcional(fila.metodo),
    nota: textoOpcional(fila.nota),
    registradoPor: texto(fila.registrado_por),
    registradoEn: texto(fila.registrado_en),
    anulacion: anuladoEn
      ? {
          motivo: textoOpcional(fila.anulacion_motivo) ?? '',
          anuladoPor: textoOpcional(fila.anulado_por) ?? '',
          anuladoEn,
        }
      : null,
  };
}

export function leerGrupo(base: Base, grupoId: Id): Grupo | null {
  const fila = base.prepare('SELECT * FROM grupo WHERE id = ?').get(grupoId) as Fila | undefined;
  if (!fila) return null;
  return {
    id: texto(fila.id),
    nombre: texto(fila.nombre),
    moneda: { codigo: texto(fila.moneda_codigo), exponente: entero(fila.moneda_exponente) },
    creadoEn: texto(fila.creado_en),
  };
}

export function crearGrupo(
  base: Base,
  datos: { id: Id; nombre: string; codigoMoneda: string; exponente: number; hashEdicion: string; hashLectura: string; creadoEn: string },
): void {
  base
    .prepare(
      `INSERT INTO grupo (id, nombre, moneda_codigo, moneda_exponente, hash_enlace_edicion, hash_enlace_lectura, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(datos.id, datos.nombre, datos.codigoMoneda, datos.exponente, datos.hashEdicion, datos.hashLectura, datos.creadoEn);
}

export function rotarHash(base: Base, grupoId: Id, tipo: 'EDICION' | 'LECTURA', hash: string): void {
  const columna = tipo === 'EDICION' ? 'hash_enlace_edicion' : 'hash_enlace_lectura';
  base.prepare(`UPDATE grupo SET ${columna} = ? WHERE id = ?`).run(hash, grupoId);
}

export function listarMiembros(base: Base, grupoId: Id): Miembro[] {
  return (
    base.prepare('SELECT * FROM miembro WHERE grupo_id = ? ORDER BY creado_en, id').all(grupoId) as Fila[]
  ).map(aMiembro);
}

export function leerMiembro(base: Base, grupoId: Id, miembroId: Id): Miembro | null {
  const fila = base
    .prepare('SELECT * FROM miembro WHERE grupo_id = ? AND id = ?')
    .get(grupoId, miembroId) as Fila | undefined;
  return fila ? aMiembro(fila) : null;
}

export function crearMiembro(
  base: Base,
  datos: { id: Id; grupoId: Id; nombre: string; creadoEn: string },
): void {
  base
    .prepare('INSERT INTO miembro (id, grupo_id, nombre, activo, creado_en) VALUES (?, ?, ?, 1, ?)')
    .run(datos.id, datos.grupoId, datos.nombre, datos.creadoEn);
}

export function actualizarMiembro(
  base: Base,
  grupoId: Id,
  miembroId: Id,
  cambios: { nombre?: string; activo?: boolean },
): void {
  if (cambios.nombre !== undefined) {
    base
      .prepare('UPDATE miembro SET nombre = ? WHERE grupo_id = ? AND id = ?')
      .run(cambios.nombre, grupoId, miembroId);
  }
  if (cambios.activo !== undefined) {
    base
      .prepare('UPDATE miembro SET activo = ? WHERE grupo_id = ? AND id = ?')
      .run(cambios.activo ? 1 : 0, grupoId, miembroId);
  }
}

/** RN-14: solo se puede borrar de verdad a quien no tiene ningún aporte, ni propio ni pagado. */
export function contarAportesDelMiembro(base: Base, grupoId: Id, miembroId: Id): number {
  const fila = base
    .prepare(
      'SELECT COUNT(*) AS n FROM aporte WHERE grupo_id = ? AND (acreditado_a = ? OR pagado_por = ?)',
    )
    .get(grupoId, miembroId, miembroId) as Fila;
  return entero(fila.n);
}

export function contarInvolucramientos(base: Base, grupoId: Id, miembroId: Id): number {
  const fila = base
    .prepare(
      `SELECT COUNT(*) AS n FROM involucrado i
       JOIN objetivo o ON o.id = i.objetivo_id
       WHERE o.grupo_id = ? AND i.miembro_id = ?`,
    )
    .get(grupoId, miembroId) as Fila;
  return entero(fila.n);
}

export function borrarMiembro(base: Base, grupoId: Id, miembroId: Id): void {
  base.prepare('DELETE FROM miembro WHERE grupo_id = ? AND id = ?').run(grupoId, miembroId);
}

export function listarObjetivos(base: Base, grupoId: Id): Objetivo[] {
  const filas = base
    .prepare('SELECT * FROM objetivo WHERE grupo_id = ? ORDER BY creado_en, id')
    .all(grupoId) as Fila[];
  if (filas.length === 0) return [];

  const involucrados = base
    .prepare(
      `SELECT i.* FROM involucrado i
       JOIN objetivo o ON o.id = i.objetivo_id
       WHERE o.grupo_id = ?
       ORDER BY i.orden`,
    )
    .all(grupoId) as Fila[];

  const porObjetivo = new Map<Id, Involucrado[]>();
  for (const fila of involucrados) {
    const lista = porObjetivo.get(texto(fila.objetivo_id)) ?? [];
    lista.push({
      miembroId: texto(fila.miembro_id),
      tipoParte: texto(fila.tipo_parte) as TipoParte,
      valorParte: entero(fila.valor_parte),
      orden: entero(fila.orden),
    });
    porObjetivo.set(texto(fila.objetivo_id), lista);
  }

  return filas.map((fila) => ({
    id: texto(fila.id),
    grupoId: texto(fila.grupo_id),
    nombre: texto(fila.nombre),
    descripcion: textoOpcional(fila.descripcion),
    montoTotal: entero(fila.monto_total) as Minor,
    modalidad: texto(fila.modalidad) as Modalidad,
    estado: texto(fila.estado) as EstadoAlmacenado,
    periodicidad: textoOpcional(fila.periodicidad) as Periodicidad | null,
    fechaInicio: textoOpcional(fila.fecha_inicio) as FechaCivil | null,
    fechaLimite: textoOpcional(fila.fecha_limite) as FechaCivil | null,
    involucrados: porObjetivo.get(texto(fila.id)) ?? [],
    version: entero(fila.version),
    creadoEn: texto(fila.creado_en),
  }));
}

export function leerObjetivo(base: Base, grupoId: Id, objetivoId: Id): Objetivo | null {
  return listarObjetivos(base, grupoId).find((o) => o.id === objetivoId) ?? null;
}

export function crearObjetivo(base: Base, objetivo: Objetivo): void {
  base
    .prepare(
      `INSERT INTO objetivo (id, grupo_id, nombre, descripcion, monto_total, modalidad, estado,
                             periodicidad, fecha_inicio, fecha_limite, version, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      objetivo.id,
      objetivo.grupoId,
      objetivo.nombre,
      objetivo.descripcion,
      objetivo.montoTotal,
      objetivo.modalidad,
      objetivo.estado,
      objetivo.periodicidad,
      objetivo.fechaInicio,
      objetivo.fechaLimite,
      objetivo.version,
      objetivo.creadoEn,
    );

  const insertar = base.prepare(
    'INSERT INTO involucrado (objetivo_id, miembro_id, tipo_parte, valor_parte, orden) VALUES (?, ?, ?, ?, ?)',
  );
  for (const involucrado of objetivo.involucrados) {
    insertar.run(
      objetivo.id,
      involucrado.miembroId,
      involucrado.tipoParte,
      involucrado.valorParte,
      involucrado.orden,
    );
  }
}

export function listarAportes(base: Base, grupoId: Id): Aporte[] {
  return (
    base
      .prepare('SELECT * FROM aporte WHERE grupo_id = ? ORDER BY fecha_valor, registrado_en, id')
      .all(grupoId) as Fila[]
  ).map(aAporte);
}

export function leerAporte(base: Base, grupoId: Id, aporteId: Id): Aporte | null {
  const fila = base
    .prepare('SELECT * FROM aporte WHERE grupo_id = ? AND id = ?')
    .get(grupoId, aporteId) as Fila | undefined;
  return fila ? aAporte(fila) : null;
}

export function crearAporte(base: Base, aporte: Aporte): void {
  base
    .prepare(
      `INSERT INTO aporte (id, grupo_id, objetivo_id, acreditado_a, pagado_por, monto, fecha_valor,
                           periodo_indice, metodo, nota, registrado_por, registrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      aporte.id,
      aporte.grupoId,
      aporte.objetivoId,
      aporte.acreditadoA,
      aporte.pagadoPor,
      aporte.monto,
      aporte.fechaValor,
      aporte.periodoIndice,
      aporte.metodo,
      aporte.nota,
      aporte.registradoPor,
      aporte.registradoEn,
    );
}

/**
 * RN-13 y Artículo V: anular es marcar, nunca borrar ni editar. No hay ningún `UPDATE`
 * sobre el monto o la fecha de un aporte en todo el proyecto, y este es el único `UPDATE`
 * que toca la tabla.
 */
export function anularAporte(
  base: Base,
  grupoId: Id,
  aporteId: Id,
  anulacion: { motivo: string; anuladoPor: string; anuladoEn: string },
): void {
  base
    .prepare(
      `UPDATE aporte SET anulado_en = ?, anulado_por = ?, anulacion_motivo = ?
       WHERE grupo_id = ? AND id = ? AND anulado_en IS NULL`,
    )
    .run(anulacion.anuladoEn, anulacion.anuladoPor, anulacion.motivo, grupoId, aporteId);
}

/**
 * RF-16 y RN-11 — cambia la definición de un objetivo y sustituye sus involucrados.
 *
 * Los aportes no se tocan: no hay ni un `UPDATE` ni un `DELETE` sobre la tabla `aporte` en
 * esta función, y las obligaciones se recalculan solas porque nunca estuvieron guardadas
 * (Artículo IV). La versión sube en la misma sentencia que exige la versión leída, así que
 * dos ediciones simultáneas no pueden pisarse (DT-10, RN-18).
 */
export function actualizarObjetivo(
  base: Base,
  grupoId: Id,
  objetivo: Objetivo,
  versionEsperada: number,
): boolean {
  const resultado = base
    .prepare(
      `UPDATE objetivo
       SET nombre = ?, descripcion = ?, monto_total = ?, modalidad = ?, periodicidad = ?,
           fecha_inicio = ?, fecha_limite = ?, version = version + 1
       WHERE grupo_id = ? AND id = ? AND version = ?`,
    )
    .run(
      objetivo.nombre,
      objetivo.descripcion,
      objetivo.montoTotal,
      objetivo.modalidad,
      objetivo.periodicidad,
      objetivo.fechaInicio,
      objetivo.fechaLimite,
      grupoId,
      objetivo.id,
      versionEsperada,
    );

  // Nadie actualizó nada: otra persona cambió el objetivo entre la lectura y esta escritura.
  if (resultado.changes === 0) return false;

  base.prepare('DELETE FROM involucrado WHERE objetivo_id = ?').run(objetivo.id);
  const insertar = base.prepare(
    'INSERT INTO involucrado (objetivo_id, miembro_id, tipo_parte, valor_parte, orden) VALUES (?, ?, ?, ?, ?)',
  );
  for (const involucrado of objetivo.involucrados) {
    insertar.run(
      objetivo.id,
      involucrado.miembroId,
      involucrado.tipoParte,
      involucrado.valorParte,
      involucrado.orden,
    );
  }
  return true;
}

/** RF-17 y RN-16 — cancelar, archivar o reactivar. Reversible y sin borrar nada. */
export function cambiarEstadoObjetivo(
  base: Base,
  grupoId: Id,
  objetivoId: Id,
  estado: EstadoAlmacenado,
  versionEsperada: number,
): boolean {
  const resultado = base
    .prepare(
      `UPDATE objetivo SET estado = ?, version = version + 1
       WHERE grupo_id = ? AND id = ? AND version = ?`,
    )
    .run(estado, grupoId, objetivoId, versionEsperada);
  return resultado.changes > 0;
}

export function contarAportesDelObjetivo(base: Base, grupoId: Id, objetivoId: Id): number {
  const fila = base
    .prepare('SELECT COUNT(*) AS n FROM aporte WHERE grupo_id = ? AND objetivo_id = ?')
    .get(grupoId, objetivoId) as Fila;
  return entero(fila.n);
}

/**
 * RF-22 y RN-16 — eliminación definitiva.
 *
 * Quien llama debe haber comprobado antes que el objetivo no tiene ningún aporte, anulados
 * incluidos (CB-16). Aquí solo desaparecen el objetivo y sus involucrados, que son la
 * definición de un acuerdo que nadie llegó a cumplir.
 */
export function borrarObjetivo(base: Base, grupoId: Id, objetivoId: Id): void {
  base.prepare('DELETE FROM involucrado WHERE objetivo_id = ?').run(objetivoId);
  base.prepare('DELETE FROM objetivo WHERE grupo_id = ? AND id = ?').run(grupoId, objetivoId);
}

/**
 * RN-19 y RF-23 — borra un grupo entero y todo lo que cuelga de él.
 *
 * La única operación del sistema que destruye historial. Alcanza **solo** al `grupo_id` que
 * salió de resolver el enlace: nunca a otro grupo (INV-01, Artículo VI). El orden respeta
 * las claves foráneas, de lo más dependiente a lo menos.
 */
export function borrarGrupo(base: Base, grupoId: Id): void {
  base.prepare('DELETE FROM aporte WHERE grupo_id = ?').run(grupoId);
  base
    .prepare('DELETE FROM involucrado WHERE objetivo_id IN (SELECT id FROM objetivo WHERE grupo_id = ?)')
    .run(grupoId);
  base.prepare('DELETE FROM objetivo WHERE grupo_id = ?').run(grupoId);
  base.prepare('DELETE FROM miembro WHERE grupo_id = ?').run(grupoId);
  base.prepare('DELETE FROM grupo WHERE id = ?').run(grupoId);
}
