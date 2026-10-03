import { expect, test } from '@playwright/test';

test('la app arranca sin errores y sin hacer peticiones de red', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !r.url().startsWith(new URL(baseURL!).origin) && !r.url().startsWith('data:') && external.push(r.url()));

  await page.goto('/');
  await expect(page.getByText('Seguridad').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/.capturas/arranque.png' });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('el servidor manda las cabeceras de seguridad (las mismas que el bloque de Caddy)', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("connect-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('no-referrer');
});

test('la página solo carga scripts propios (ningún alojamiento inyecta nada)', async ({ page }) => {
  await page.goto('/');
  const scripts = await page.locator('script').evaluateAll((list) => list.map((s) => (s as HTMLScriptElement).src || 'en línea'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) expect(src, 'script ajeno al build').toMatch(/\/assets\/[\w-]+\.js$/);
});
