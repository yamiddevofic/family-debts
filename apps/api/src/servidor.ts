import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from './app.ts';
import { abrirBase } from './db/base.ts';
import { rutaSinToken } from './enlaces.ts';
import { relojDelSistema } from './reloj.ts';

/**
 * Un solo proceso sirve la API y los estáticos de la web — DT-06 y DT-14.
 * La base vive en un archivo dentro de un volumen persistente; respaldar es copiarlo.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));

// `@deudas/core` se resuelve a su compilado. En desarrollo, `node --watch src/servidor.ts`
// recarga la API al vuelo pero no reconstruye el núcleo: si se toca `packages/core`, hay que
// volver a compilarlo. `npm run dev` desde la raíz ya lo hace antes de arrancar.

const PUERTO = Number(process.env.PORT ?? 8787);
const RUTA_BASE = process.env.RUTA_BASE_DATOS ?? resolve(AQUI, '../../../datos/deudas.db');
const RUTA_WEB = process.env.RUTA_WEB ?? resolve(AQUI, '../../web/dist');

mkdirSync(dirname(RUTA_BASE), { recursive: true });

const base = abrirBase(RUTA_BASE);
const app = crearApp({
  base,
  reloj: relojDelSistema(),
  // El token nunca entra completo en un registro (RNF-06, T-029).
  registrar: (linea) => {
    console.log(`[${new Date().toISOString()}] ${rutaSinToken(linea)}`);
  },
});

if (existsSync(RUTA_WEB)) {
  // `serveStatic` resuelve contra el directorio de trabajo, así que se le pasa la ruta
  // relativa a él.
  const raizWeb = relative(process.cwd(), RUTA_WEB) || '.';
  app.use('/assets/*', serveStatic({ root: raizWeb }));
  app.use('/favicon.ico', serveStatic({ root: raizWeb }));
  // La web es una sola página: cualquier ruta que no sea de la API devuelve el index y deja
  // que el enrutador del navegador se encargue.
  app.get('*', serveStatic({ path: join(raizWeb, 'index.html') }));
} else {
  console.warn(`No encontré la web compilada en ${RUTA_WEB}. Ejecuta: npm run build`);
}

serve({ fetch: app.fetch, port: PUERTO }, (info) => {
  console.log(`Deudas Familiares escuchando en http://localhost:${String(info.port)}`);
  console.log(`Base de datos: ${RUTA_BASE}`);
});
