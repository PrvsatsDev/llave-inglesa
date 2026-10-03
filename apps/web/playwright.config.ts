import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas en un navegador real contra el build de producción (con su CSP): así se prueba
 * lo mismo que se publica. Los ficheros son *.e2e.ts para que vitest no los recoja.
 * Con E2E_URL (p. ej. la web publicada) se prueba esa dirección en vez de levantar un servidor local.
 */
const remote = process.env.E2E_URL;
const baseURL = remote ?? 'http://127.0.0.1:4180';
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: 'e2e/.resultados',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'es-ES',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: remote
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4180 --strictPort',
        url: 'http://127.0.0.1:4180',
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
