import type { Hono } from 'hono';
import { crearApp } from '../src/app.ts';
import { abrirBase, type Base } from '../src/db/base.ts';
import type { Reloj } from '../src/reloj.ts';

/** Reloj falso: el tiempo y los ids entran como parámetros, así que se pueden fijar. */
export function relojFijo(hoy = '2026-09-15', ahora = '2026-09-15T12:00:00.000Z'): Reloj & { fijarHoy: (f: string) => void } {
  let fecha = hoy;
  let contador = 0;
  return {
    hoy: () => fecha as ReturnType<Reloj['hoy']>,
    ahora: () => {
      contador += 1;
      return ahora.replace('12:00:00', `12:00:${String(contador).padStart(2, '0')}`);
    },
    nuevoId: () => {
      contador += 1;
      return `id-${String(contador).padStart(4, '0')}`;
    },
    fijarHoy: (f: string) => {
      fecha = f;
    },
  };
}

export interface Contexto {
  app: Hono<{ Variables: { acceso: { grupoId: string; permiso: 'EDICION' | 'LECTURA' } } }>;
  base: Base;
  reloj: ReturnType<typeof relojFijo>;
  registros: string[];
}

export function montarApi(): Contexto {
  const base = abrirBase(':memory:');
  const reloj = relojFijo();
  const registros: string[] = [];
  const app = crearApp({ base, reloj, registrar: (linea) => registros.push(linea) });
  return { app, base, reloj, registros };
}

export async function pedir(
  ctx: Contexto,
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
): Promise<{ estado: number; datos: any }> {
  const respuesta = await ctx.app.request(ruta, {
    method: metodo,
    ...(cuerpo === undefined
      ? {}
      : { body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null };
}

/** Grupo con tres miembros y un objetivo de $100.000 en partes iguales. */
export async function grupoDeEjemplo(ctx: Contexto) {
  const { datos: creado } = await pedir(ctx, 'POST', '/api/grupos', { nombre: 'Casa' });
  const edicion: string = creado.enlaceEdicion;
  const lectura: string = creado.enlaceLectura;

  // Tipado explícito en vez de Record<string, string>: así `miembros.Ana` es un `string` y
  // no un `string | undefined` que haya que comprobar en cada prueba.
  const ids: string[] = [];
  for (const nombre of ['Ana', 'Luis', 'Sara']) {
    const { datos } = await pedir(ctx, 'POST', `/api/g/${edicion}/miembros`, { nombre });
    ids.push(datos.miembro.id as string);
  }
  const miembros = { Ana: ids[0] as string, Luis: ids[1] as string, Sara: ids[2] as string };

  const { datos: objetivo } = await pedir(ctx, 'POST', `/api/g/${edicion}/objetivos`, {
    nombre: 'Nevera',
    montoTotal: 100_000,
    modalidad: 'REPARTO_UNICO',
    involucrados: [miembros.Ana, miembros.Luis, miembros.Sara],
  });

  return { edicion, lectura, grupoId: creado.grupo.id, miembros, objetivoId: objetivo.objetivo.id as string };
}
