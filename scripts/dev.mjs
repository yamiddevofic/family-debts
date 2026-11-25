#!/usr/bin/env node
/**
 * Arranca la API y la interfaz juntas para desarrollo.
 *
 * Son dos procesos porque cada uno recarga de forma distinta: la API con `node --watch`, la
 * web con el servidor de Vite. Levantar solo uno de los dos es un error fácil de cometer y
 * difícil de leer: sin la API, el proxy de Vite responde 500 a cada `/api/...` y en la
 * consola del navegador no aparece ninguna pista de por qué.
 *
 * Sin dependencias: un orquestador de 40 líneas cuesta menos que traer una (Artículo VIII).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// La API importa `@deudas/core` por su nombre, que se resuelve al compilado: sin construirlo
// antes, arranca con un error de módulo no encontrado.
console.log('▸ Compilando @deudas/core…');
const construccion = spawn(npm, ['run', 'build', '--workspace=@deudas/core'], {
  cwd: RAIZ,
  stdio: 'inherit',
});

construccion.on('exit', (codigo) => {
  if (codigo !== 0) {
    console.error('✗ No se pudo compilar el núcleo. Revisa los errores de arriba.');
    process.exit(codigo ?? 1);
  }
  if (!existsSync(resolve(RAIZ, 'packages/core/dist/index.js'))) {
    console.error('✗ El núcleo compiló pero no dejó salida en packages/core/dist.');
    process.exit(1);
  }
  arrancar();
});

const procesos = [];

function lanzar(etiqueta, args, cwd) {
  const proceso = spawn(npm, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const escribir = (flujo) => (dato) => {
    for (const linea of String(dato).split('\n')) {
      if (linea.trim() !== '') flujo.write(`[${etiqueta}] ${linea}\n`);
    }
  };
  proceso.stdout.on('data', escribir(process.stdout));
  proceso.stderr.on('data', escribir(process.stderr));
  proceso.on('exit', (codigo) => {
    console.error(`[${etiqueta}] terminó con código ${String(codigo)}. Cerrando el resto.`);
    cerrar(codigo ?? 1);
  });
  procesos.push(proceso);
}

function arrancar() {
  lanzar('api', ['run', 'dev', '--workspace=@deudas/api'], RAIZ);
  lanzar('web', ['run', 'dev', '--workspace=@deudas/web'], RAIZ);
  console.log('\n▸ API en http://localhost:8787 · interfaz en http://localhost:5173');
  console.log('▸ Abre la interfaz en el 5173: su proxy manda /api al 8787.\n');
}

let cerrando = false;
function cerrar(codigo) {
  if (cerrando) return;
  cerrando = true;
  for (const proceso of procesos) proceso.kill('SIGTERM');
  setTimeout(() => process.exit(codigo), 300);
}

process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));
