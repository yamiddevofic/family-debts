import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Único punto de contacto con SQLite — DT-05 y RG-01.
 *
 * `node:sqlite` es API experimental en Node 24. Todo el acceso pasa por aquí justamente por
 * eso: cambiar a `better-sqlite3` significaría tocar este archivo y ninguno más. El resto
 * del proyecto no sabe qué motor hay debajo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

export type Base = DatabaseSync;

export function abrirBase(ruta = ':memory:'): Base {
  const base = new DatabaseSync(ruta);
  const esquema = readFileSync(join(AQUI, 'esquema.sql'), 'utf8');
  base.exec(esquema);
  return base;
}

/**
 * Ejecuta `trabajo` dentro de una transacción. Registrar un objetivo con sus involucrados
 * son varias escrituras que solo tienen sentido juntas.
 */
export function enTransaccion<T>(base: Base, trabajo: () => T): T {
  base.exec('BEGIN');
  try {
    const resultado = trabajo();
    base.exec('COMMIT');
    return resultado;
  } catch (error) {
    base.exec('ROLLBACK');
    throw error;
  }
}
