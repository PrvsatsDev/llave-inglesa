import { expect, test, type Page } from '@playwright/test';

/** Multisig sin ningún backup del descriptor: problema grave, en rojo y primero, sin pausar el análisis. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test('quitar todos los descriptores de un multisig es un problema grave', async ({ page }) => {
  await page.goto('/');
  // «Todo a mano en casa» tiene un descriptor impreso en cada ubicación: se borran los tres.
  for (let i = 0; i < 3; i++) {
    await page.locator('.react-flow__node-location').getByText('Descriptor impreso').first().click();
    await page.getByRole('button', { name: 'Eliminar backup' }).click();
  }
  await expect(page.getByText('Problemas graves y avisos')).toBeVisible();
  await expect(page.getByText(/Multisig sin ningún backup del descriptor/)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Esquema/ }).or(page.getByRole('button', { name: /^Esquema/ })).first().getByTitle(/1 problema grave/)).toBeVisible();
  // El análisis sigue: la herencia resta por no tener descriptor.
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await capture(page, 'sin-descriptor');
});
