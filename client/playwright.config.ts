import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta: abren el navegador y recorren el sistema como lo haría una persona.
 * Antes: `npm run build` y la API (SIGTA-Agrofood-Back) corriendo en el puerto 3000 con los datos iniciales recién cargados.
 * Levanta las pantallas compiladas (vite preview, que reenvía /api a la API) si no están corriendo.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:4173',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
  // Con E2E_URL se prueba un sitio ya publicado (por ejemplo, la dirección de Vercel); si no, se levanta el local.
  webServer: process.env.E2E_URL ? undefined : {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
