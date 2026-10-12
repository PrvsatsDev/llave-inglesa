import { expect, test, type Page } from '@playwright/test';

/** Entropía propia: la ficha de la key dice si llega a los 128 bits del estándar, y el motor la trata en consecuencia. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test('pocas tiradas: la ficha avisa y la seguridad se hunde; sin número, se avisa en el Esquema', async ({ page }) => {
  await page.goto('/');
  // K2 de «Todo a mano en casa»: solo 99 dados, en un SeedSigner.
  await page.getByRole('button', { name: /^K2/ }).first().click();
  await expect(page.getByText(/≈ 255 bits de entropía propia: llega al estándar/)).toBeVisible();

  const rolls = page.locator('input[type="number"]').first();
  await rolls.fill('20');
  await expect(page.getByText(/Solo ≈ 51 bits de entropía propia, menos de los 128 del estándar/)).toBeVisible();
  const security = page.getByRole('button', { name: /^Seguridad/ }).first();
  // Es un 2 de 3: con K2 adivinada (0,5) aún falta otra key, la de una intrusión en casa (1,5).
  await expect(security).toContainText('esfuerzo 2');
  await page.getByText(/Solo ≈ 51 bits/).scrollIntoViewIfNeeded();
  await capture(page, 'entropia-pocas-tiradas');

  await rolls.fill('');
  await expect(page.getByText(/Indica cuántas tiradas/)).toBeVisible();
  await capture(page, 'entropia-ficha-sin-numero');
  await page.keyboard.press('Escape');
  await expect(page.getByText(/sin indicar cuántas tiradas: no cuentan como entropía/)).toBeVisible();
  await capture(page, 'entropia-sin-numero');
});

test('«+ Fuente» lleva el cursor a las tiradas de la fuente nueva', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^K2/ }).first().click();
  await page.getByRole('button', { name: 'Fuente', exact: true }).click();
  await expect(page.locator('input[type="number"]').nth(1)).toBeFocused();
  await page.keyboard.type('60');
  await expect(page.getByText(/≈ 411 bits de entropía propia: llega al estándar/)).toBeVisible();
});
