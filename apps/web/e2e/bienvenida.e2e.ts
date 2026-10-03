import { expect, test } from '@playwright/test';

const welcome = (page: import('@playwright/test').Page) => page.getByRole('dialog').filter({ hasText: 'Pon a prueba la custodia' });

test('la primera visita muestra la bienvenida; "Ver un ejemplo" la cierra y no vuelve', async ({ page }) => {
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toContainText('Nunca escribas frases semilla');
  await page.screenshot({ path: 'e2e/.capturas/bienvenida.png' });
  await page.getByRole('button', { name: 'Ver un ejemplo' }).click();
  await expect(welcome(page)).toBeHidden();
  await page.reload();
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await expect(welcome(page)).toBeHidden();
});

test('"Empezar de cero" abre un esquema en blanco', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar de cero' }).click();
  await expect(page.getByLabel('Documento abierto o ejemplo')).toContainText('Mi esquema');
});

test('Esc la cierra y el logo la vuelve a abrir', async ({ page }) => {
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(welcome(page)).toBeHidden();
  await page.getByRole('button', { name: 'Qué es llave-inglesa' }).click();
  await expect(welcome(page)).toBeVisible();
});
