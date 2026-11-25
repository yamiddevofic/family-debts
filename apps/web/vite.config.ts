import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // La web importa el núcleo directamente para no duplicar ni una regla (RNF-02).
    alias: { '@deudas/core': resolve(import.meta.dirname, '../../packages/core/src/index.ts') },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        configure: (proxy) => {
          // Sin esto, tener la API apagada se manifiesta como un 500 con cuerpo HTML y una
          // consola llena de ruido que no dice qué hacer. Lo más común en desarrollo es
          // haber arrancado solo la web, así que conviene decirlo con todas las letras.
          proxy.on('error', (_error, _peticion, respuesta) => {
            const cuerpo = JSON.stringify({
              error: {
                codigo: 'API_NO_DISPONIBLE',
                mensaje:
                  'La API no está escuchando en http://localhost:8787. Arranca las dos a la vez con `npm run dev`.',
              },
            });
            if ('writeHead' in respuesta && !respuesta.headersSent) {
              respuesta.writeHead(503, { 'Content-Type': 'application/json' });
            }
            if ('end' in respuesta) respuesta.end(cuerpo);
          });
        },
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
