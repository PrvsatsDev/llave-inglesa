import { expect, test, type Page } from '@playwright/test';

/** Eliminar con Supr lo seleccionado, con las mismas reglas que el botón; una ubicación con objetos pide confirmación. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const map = (page: Page) => page.locator('.react-flow');

test('Supr elimina el backup seleccionado en el mapa, y se puede deshacer', async ({ page }) => {
  await page.goto('/');
  const plate = map(page).getByText('Arandelas K3');
  await plate.click();
  await expect(page.getByRole('button', { name: 'Eliminar backup' })).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(plate).toHaveCount(0);
  // La ficha se cierra.
  await expect(page.getByRole('button', { name: 'Eliminar backup' })).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(plate).toBeVisible();
});

test('en un campo de texto, Supr no elimina nada', async ({ page }) => {
  await page.goto('/');
  await map(page).getByText('Arandelas K3').click();
  await page.getByLabel('Nombre').first().focus();
  await page.keyboard.press('Delete');
  await expect(map(page).getByText('Arandelas K3')).toBeVisible();
});

test('lo que no se puede eliminar con el botón tampoco con Supr: el único titular', async ({ page }) => {
  await page.goto('/');
  await page.locator('.react-flow__node-person', { hasText: 'Yo' }).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node-person', { hasText: 'Yo' })).toBeVisible();
});

test('una ubicación con objetos pide confirmación, con Supr y con su botón', async ({ page }) => {
  await page.goto('/');
  const parents = page.locator('.react-flow__node-location', { hasText: 'Casa de mis padres' });
  await parents.getByText('Casa de mis padres', { exact: true }).click();
  await page.keyboard.press('Delete');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('¿Eliminar Casa de mis padres?');
  await expect(dialog).toContainText('los 2 objetos que contiene');
  await capture(page, 'eliminar-confirmar');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(parents).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar ubicación y sus 2 objetos' }).click();
  await dialog.getByRole('button', { name: 'Eliminar ubicación y sus 2 objetos' }).click();
  await expect(parents).toHaveCount(0);
});

test('arrastrar un backup a otra ubicación lo lleva allí (en escritorio), y se puede deshacer', async ({ page }) => {
  await page.goto('/');
  const bank = page.locator('.react-flow__node-location', { hasText: 'Caja del banco' });
  const parents = page.locator('.react-flow__node-location', { hasText: 'Casa de mis padres' });
  await parents.getByText('Arandelas K3').dragTo(bank);
  await expect(bank.getByText('Arandelas K3')).toBeVisible();
  await expect(parents.getByText('Arandelas K3')).toHaveCount(0);
  await capture(page, 'arrastrar-backup');
  await page.keyboard.press('Control+z');
  await expect(parents.getByText('Arandelas K3')).toBeVisible();
});
