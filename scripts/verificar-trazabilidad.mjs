#!/usr/bin/env node
/**
 * Verificador de trazabilidad — RNF-10 y Artículo VII.
 *
 * Extrae cada `RN-xx` de la spec aprobada y exige que aparezca nombrada en el título de
 * al menos un `describe(...)` de las pruebas. La trazabilidad deja de depender de que
 * alguien se acuerde: si se borra el `describe`, este script se pone rojo.
 *
 * Las reglas que un incremento todavía no aborda se declaran abajo, con el incremento que
 * las traerá. Declararlas es deliberado: obliga a que posponer una regla sea un acto
 * visible y no un olvido (Artículo X — se recorta alcance, nunca corrección).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const SPEC = join(RAIZ, 'specs/001-objetivos-y-aportes/spec.md');

/** Reglas fuera del MVP (incrementos 1-3). Cada una con el incremento que la implementa. */
const PENDIENTES = new Map([
  ['RN-02', 'Incremento 4 — reparto por porcentajes'],
  ['RN-03', 'Incremento 4 — reparto por montos fijos'],
]);

function archivosDePrueba(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === 'dist' || entrada.startsWith('.')) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDePrueba(ruta, acumulado);
    else if (/\.test\.tsx?$/.test(ruta)) acumulado.push(ruta);
  }
  return acumulado;
}

const spec = readFileSync(SPEC, 'utf8');
const reglas = [...spec.matchAll(/^### (RN-\d+) — (.+)$/gm)].map(([, id, titulo]) => ({ id, titulo }));

if (reglas.length === 0) {
  console.error('✗ No se encontró ninguna RN-xx en la spec. ¿Cambió el formato de los títulos?');
  process.exit(1);
}

const pruebas = archivosDePrueba(join(RAIZ, 'packages')).concat(archivosDePrueba(join(RAIZ, 'apps')));
const cubiertas = new Map();

for (const ruta of pruebas) {
  const contenido = readFileSync(ruta, 'utf8');
  for (const [, id] of contenido.matchAll(/describe\(\s*['"`](RN-\d+)/g)) {
    if (!cubiertas.has(id)) cubiertas.set(id, []);
    cubiertas.get(id).push(relative(RAIZ, ruta));
  }
}

const sinCubrir = [];
const pospuestas = [];
for (const { id, titulo } of reglas) {
  if (cubiertas.has(id)) continue;
  if (PENDIENTES.has(id)) pospuestas.push(`${id} — ${titulo} (${PENDIENTES.get(id)})`);
  else sinCubrir.push(`${id} — ${titulo}`);
}

// Una regla declarada pendiente que ya tiene prueba es una declaración obsoleta: avisa.
const pendientesObsoletas = [...PENDIENTES.keys()].filter((id) => cubiertas.has(id));

console.log(`Reglas en la spec: ${reglas.length}`);
console.log(`Con prueba que las nombra: ${cubiertas.size}`);
if (pospuestas.length > 0) {
  console.log(`\nPospuestas fuera del MVP (${pospuestas.length}):`);
  for (const linea of pospuestas) console.log(`  · ${linea}`);
}

if (pendientesObsoletas.length > 0) {
  console.error(
    `\n✗ Estas reglas ya tienen prueba pero siguen declaradas como pendientes en ${relative(RAIZ, new URL(import.meta.url).pathname)}:`,
  );
  for (const id of pendientesObsoletas) console.error(`  · ${id}`);
}

if (sinCubrir.length > 0) {
  console.error(`\n✗ Sin ninguna prueba que las nombre (${sinCubrir.length}):`);
  for (const linea of sinCubrir) console.error(`  · ${linea}`);
  console.error('\n  Cada RN-xx necesita un describe("RN-xx — ...") (RNF-10, Artículo VII).');
}

if (sinCubrir.length > 0 || pendientesObsoletas.length > 0) process.exit(1);
console.log('\n✓ Trazabilidad completa para el alcance del MVP.');
