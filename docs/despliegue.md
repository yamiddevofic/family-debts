# Despliegue

DT-14: **un contenedor, un volumen**. Un solo proceso Node sirve la API y los estáticos de la
web; la base de datos es un archivo dentro del volumen.

## Local

```bash
npm install
npm run build
npm run start --workspace=@deudas/api
```

Queda en `http://localhost:8787`. La base se crea en `datos/deudas.db`.

## Desarrollo

```bash
npm run dev
```

Levanta la API en `:8787` y la interfaz de Vite en `:5173`, que le hace de proxy. Son dos
procesos porque cada uno recarga distinto: la API con `node --watch` sobre TypeScript nativo,
la web con el servidor de Vite.

Node 24 ejecuta TypeScript sin compilar, pero **no** reescribe `./app.js` a `./app.ts`. Por
eso `apps/api` y `apps/web` nombran la extensión real en sus imports relativos y su
`tsconfig` lleva `rewriteRelativeImportExtensions`, que la convierte a `.js` al compilar.

`packages/core` **no** hace eso, y la diferencia es deliberada: es una librería que emite
`.d.ts`, y TypeScript no reescribe la extensión dentro de las declaraciones. Con `.ts` en los
imports, su `dist` quedaría con tipos irresolubles para quien lo consuma. Como librería, usa
el `.js` estándar de NodeNext.

Al tocar `packages/core` hay que recompilarlo: la API lo consume por su nombre de paquete, o
sea desde `dist`. `npm run dev` lo hace antes de arrancar.

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8787` | Puerto de escucha. |
| `RUTA_BASE_DATOS` | `datos/deudas.db` | Archivo SQLite. Debe estar en el volumen persistente. |
| `RUTA_WEB` | `apps/web/dist` | Estáticos compilados de la interfaz. |
| `ZONA_HORARIA` | `America/Bogota` | Zona en la que se calcula "hoy" para la mora (RN-12). |

`ZONA_HORARIA` no es cosmética: si el servidor calculara la fecha en UTC, a partir de las
7 de la tarde en Colombia "hoy" sería mañana, y un periodo aparecería vencido antes de tiempo.

## Contenedor

```bash
docker build -t deudas-familiares .
docker run -p 8787:8787 -v deudas-datos:/datos deudas-familiares
```

## Respaldo

El respaldo es copiar un archivo (RNF-09). Con el servicio detenido:

```bash
docker run --rm -v deudas-datos:/datos -v "$PWD":/respaldo alpine cp /datos/deudas.db /respaldo/
```

Con el servicio en marcha conviene usar la API de respaldo de SQLite en vez de `cp`, porque
el modo WAL deja cambios fuera del archivo principal:

```bash
sqlite3 datos/deudas.db ".backup 'respaldo.db'"
```

## Elección de proveedor

Sigue abierta a propósito (plan §8): ninguna decisión del plan depende de cuál sea. La imagen
es un contenedor corriente con un volumen, así que Fly.io, Railway, Render o un VPS con
Docker sirven igual. Lo único que hay que garantizar es que **el volumen sea persistente**:
un sistema de archivos efímero perdería la base en cada despliegue.

## Migraciones

Hasta el primer despliegue en uso real, el esquema se recrea (`CREATE TABLE IF NOT EXISTS`).
Desde ahí, migraciones SQL numeradas a mano en `apps/api/src/db/` (plan §8).
