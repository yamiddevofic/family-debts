import { defineConfig, devices } from '@playwright/test';

/**
 * T-041 — extremo a extremo de HU-01, HU-05 y HU-06.
 *
 * Solo esos tres flujos, a propósito (plan §6): son los que, si se rompen, dejan la app
 * inservible. Todo lo demás está cubierto por pruebas de núcleo y de API, que son mucho más
 * rápidas y precisas para lo que verifican.
 *
 * Se corre en un móvil emulado porque ese es el contexto real de uso (RNF-03).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list']],
  use: { baseURL: 'http://localhost:8788', trace: 'retain-on-failure' },
  projects: [{ name: 'movil', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npm run start --workspace=@deudas/api',
    url: 'http://localhost:8788',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: '8788',
      RUTA_BASE_DATOS: 'datos/e2e.db',
      ZONA_HORARIA: 'America/Bogota',
    },
  },
});
