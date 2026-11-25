import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-002 — la salvaguarda del Artículo III se comprueba a sí misma.
 *
 * Una regla de linter que nadie verifica es una regla que puede haberse desactivado hace
 * meses. Esta prueba lo comprueba en cada ejecución: un archivo que divide dinero fuera de
 * `reparto.ts` tiene que poner el linter en rojo.
 */

const RAIZ = resolve(import.meta.dirname, '../../..');
const FIXTURE = resolve(RAIZ, 'tools/fixtures/division-de-dinero.ts');

async function lintar(rutas: string[]) {
  const eslint = new ESLint({ cwd: RAIZ, ignore: false });
  return eslint.lintFiles(rutas);
}

describe('Artículo III — dividir dinero fuera del módulo de reparto no compila el linter', () => {
  it('marca cada división, multiplicación y módulo sobre un Minor', async () => {
    const [resultado] = await lintar([FIXTURE]);
    const mensajes = (resultado?.messages ?? []).filter(
      (m) => m.ruleId === 'constitucion/sin-dividir-dinero',
    );
    // `/`, `*` y `%` sobre montos: tres infracciones en la fixture.
    expect(mensajes).toHaveLength(3);
    expect(mensajes[0]?.message).toMatch(/Artículo III/);
  }, 60_000);

  it('no molesta a la suma ni a la resta, que no producen fracciones', async () => {
    const [resultado] = await lintar([FIXTURE]);
    const lineasConError = new Set(
      (resultado?.messages ?? [])
        .filter((m) => m.ruleId === 'constitucion/sin-dividir-dinero')
        .map((m) => m.line),
    );
    const lineaDeLaSuma = 24;
    expect(lineasConError.has(lineaDeLaSuma)).toBe(false);
  }, 60_000);

  it('reparto.ts sí puede dividir: es el único lugar autorizado (DT-04)', async () => {
    const [resultado] = await lintar([resolve(RAIZ, 'packages/core/src/reparto.ts')]);
    const mensajes = (resultado?.messages ?? []).filter(
      (m) => m.ruleId === 'constitucion/sin-dividir-dinero',
    );
    expect(mensajes).toEqual([]);
  }, 60_000);
});
