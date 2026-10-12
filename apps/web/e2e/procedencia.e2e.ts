import { expect, test, type Page } from '@playwright/test';

/** Procedencia del dispositivo: de segunda mano es una vía de robo; montado en casa (si se puede), no. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const location = (page: Page, name: string) => page.locator('.react-flow__node-location', { hasText: name }).first();

test('un Keystone de segunda mano puede llegar manipulado: la ficha lo explica y sale en las vías de robo', async ({ page }) => {
  await page.goto('/');
  await location(page, 'Casa').getByText('Keystone 3 Pro').first().click();
  await expect(page.getByText(/Sin indicar no resta/)).toBeVisible();
  // El Keystone no se puede montar en casa: no se ofrece.
  await expect(page.getByRole('radio', { name: 'Montado en casa' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Dónde se compró' }).selectOption({ label: 'Segunda mano o reacondicionado' });
  await expect(page.getByText(/Pudo llegarte manipulado \(de segunda mano o reacondicionado\): es una vía de robo de esfuerzo 1,5/)).toBeVisible();
  await capture(page, 'procedencia-ficha');
  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await expect(page.getByText('Dispositivo manipulado: Keystone 3 Pro').first()).toBeVisible();
});

test('el SeedSigner se puede montar en casa, y entonces no pregunta más', async ({ page }) => {
  await page.goto('/');
  await location(page, 'Casa').getByText('SeedSigner').first().click();
  await page.getByRole('combobox', { name: 'Dónde se compró' }).selectOption({ label: 'Segunda mano o reacondicionado' });
  await page.getByRole('radio', { name: 'Montado en casa' }).click();
  await expect(page.getByText(/el fabricante no toca el aparato/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Dónde se compró' })).toHaveCount(0);
  await capture(page, 'procedencia-diy');
});
