import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-004 — el Artículo II deja de depender de la disciplina.
 *
 * Si alguien añade una dependencia a `core`, o importa algo que no sea un módulo hermano,
 * estas pruebas se ponen en rojo. Es la única forma de que "núcleo puro" siga siendo
 * verdad dentro de un año.
 */

const RAIZ = new URL('..', import.meta.url).pathname;
const FUENTES = join(RAIZ, 'src');

/**
 * Quita comentarios antes de inspeccionar: lo que se audita es el código, no la prosa que
 * lo explica. Sin esto, un comentario que menciona `Date.now()` para decir que está
 * prohibido haría fallar la prueba que lo prohíbe.
 */
function codigoSinComentarios(contenido: string): string {
  return contenido.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

function archivos(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivos(ruta, acumulado);
    else if (ruta.endsWith('.ts')) acumulado.push(ruta);
  }
  return acumulado;
}

describe('Artículo II — el núcleo es puro y determinista', () => {
  it('packages/core no declara ninguna dependencia de runtime (DT-03)', () => {
    const manifiesto = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifiesto.dependencies ?? {})).toEqual([]);
    expect(Object.keys(manifiesto.peerDependencies ?? {})).toEqual([]);
  });

  it('no importa nada que no sea un módulo hermano', () => {
    const infractores: string[] = [];
    for (const ruta of archivos(FUENTES)) {
      const contenido = codigoSinComentarios(readFileSync(ruta, 'utf8'));
      for (const [, especificador] of contenido.matchAll(/^\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
        if (especificador && !especificador.startsWith('./') && !especificador.startsWith('../')) {
          infractores.push(`${ruta}: ${especificador}`);
        }
      }
    }
    expect(infractores).toEqual([]);
  });

  it('no lee el reloj ni la aleatoriedad: el tiempo y los ids entran como parámetros (DT-12)', () => {
    const infractores: string[] = [];
    for (const ruta of archivos(FUENTES)) {
      const contenido = codigoSinComentarios(readFileSync(ruta, 'utf8'));
      for (const prohibido of ['Date.now(', 'new Date(', 'Math.random(', 'crypto.', 'process.']) {
        if (contenido.includes(prohibido)) infractores.push(`${ruta}: ${prohibido}`);
      }
    }
    expect(infractores).toEqual([]);
  });

  it('DT-11 — el núcleo no conoce el formato de presentación DD-MM-AAAA', () => {
    for (const ruta of archivos(FUENTES)) {
      expect(codigoSinComentarios(readFileSync(ruta, 'utf8'))).not.toMatch(/DD-MM-(AAAA|YYYY)/);
    }
  });
});
