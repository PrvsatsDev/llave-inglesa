import { expect, test } from '@playwright/test';

test('la app arranca sin errores y sin hacer peticiones de red', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:') && external.push(r.url()));

  await page.goto('/');
  await expect(page.getByText('Seguridad').first()).toBeVisible();
  await page.screenshot({ path: 'e2e/.capturas/arranque.png' });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
