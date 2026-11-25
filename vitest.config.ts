import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Un solo runner para todo el monorepo (T-001): `npm test` desde la raíz corre núcleo,
// API e interfaz. El alias apunta al *fuente* de `core`, no a su compilado: las pruebas no
// deben depender de que alguien se acuerde de construir primero.
export default defineConfig({
  resolve: {
    alias: { '@deudas/core': resolve(import.meta.dirname, 'packages/core/src/index.ts') },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts?(x)'],
    environment: 'node',
    globals: false,
    // Los archivos corren uno detrás de otro, no en paralelo. RNF-04 se verifica con el
    // reloj, y la prueba de la regla de ESLint satura un núcleo durante varios segundos
    // haciendo análisis de tipos: en paralelo, la medición del rendimiento acaba midiendo
    // la contención de la máquina en vez del algoritmo. Cuesta unos segundos más de suite
    // y a cambio el resultado no depende de qué otra cosa estaba corriendo.
    fileParallelism: false,
  },
});
