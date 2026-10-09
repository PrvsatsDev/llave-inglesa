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

test('nada de la app choca con la CSP (ni siquiera intentos que se capturan, como el eval de zod)', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (e) => seen.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  await page.goto('/');
  await expect(page.getByText('Seguridad').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)).toEqual([]);
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

test('la vista previa del enlace tiene título, descripción e imagen, y la imagen se sirve', async ({ page, request }) => {
  await page.goto('/');
  const meta = (selector: string) => page.locator(`head meta[${selector}]`).getAttribute('content');
  expect(await meta('property="og:title"')).toBe('llave-inglesa');
  expect(await meta('name="description"')).toContain('Simula tu custodia de Bitcoin');
  expect(await meta('name="twitter:card"')).toBe('summary_large_image');
  // X exige una URL absoluta; aquí se comprueba que su ruta existe en el build.
  const image = new URL((await meta('property="og:image"'))!);
  expect(image.protocol).toBe('https:');
  const res = await request.get(image.pathname);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toBe('image/png');
});

test('robots.txt deja pasar a todos los rastreadores', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);
  expect(await res.text()).toBe('User-agent: *\nAllow: /\n');
});
