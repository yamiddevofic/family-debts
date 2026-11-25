import type { Id } from '@deudas/core';
import type { Base } from './db/base.ts';
import { hashDeToken } from './enlaces.ts';

/**
 * Punto **único** de resolución `enlace → grupo` — T-022, Artículo VI, RN-17.
 *
 * Ninguna otra parte del código deduce a qué grupo pertenece una petición. El `grupoId`
 * siempre sale de aquí y nunca del cuerpo o de la query del cliente: si viniera del cliente,
 * bastaría con cambiar un identificador para leer el grupo de otra familia.
 */

export type Permiso = 'EDICION' | 'LECTURA';

export interface Acceso {
  grupoId: Id;
  permiso: Permiso;
}

export function resolverEnlace(base: Base, token: string): Acceso | null {
  if (typeof token !== 'string' || token.length < 20) return null;

  const hash = hashDeToken(token);
  const fila = base
    .prepare(
      `SELECT id, hash_enlace_edicion FROM grupo
       WHERE hash_enlace_edicion = ? OR hash_enlace_lectura = ?`,
    )
    .get(hash, hash) as { id: string; hash_enlace_edicion: string } | undefined;

  if (!fila) return null;
  return {
    grupoId: String(fila.id),
    permiso: String(fila.hash_enlace_edicion) === hash ? 'EDICION' : 'LECTURA',
  };
}
