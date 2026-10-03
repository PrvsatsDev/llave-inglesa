import { expect, test } from '@playwright/test';

const welcome = (page: import('@playwright/test').Page) => page.getByRole('dialog').filter({ hasText: 'Pon a prueba la custodia' });

test('la primera visita muestra la bienvenida; "Ver un ejemplo" la cierra y no vuelve', async ({ page }) => {
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toContainText('Nunca escribas frases semilla');
  // Enter hace lo esperado: el foco empieza en «Ver un ejemplo», no en el ✕.
  await expect(page.getByRole('button', { name: 'Ver un ejemplo' })).toBeFocused();
  // La versión, para compararla con la Release.
  await expect(welcome(page)).toContainText(/v\d+\.\d+\.\d+/);
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

test('se cierra con Esc o con ✕ y se queda en el ejemplo', async ({ page }) => {
  await page.goto('/');
  await expect(welcome(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(welcome(page)).toBeHidden();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await welcome(page).getByRole('button', { name: 'Cerrar' }).click();
  await expect(welcome(page)).toBeHidden();
  await expect(page.getByLabel('Documento abierto o ejemplo')).toContainText('Todo a mano en casa');
});

test('la bienvenida dice quién la hace (X y Nostr), sin pedir donaciones', async ({ page }) => {
  await page.goto('/');
  const dialog = welcome(page);
  await expect(dialog).toContainText('Hecha por Psats');
  await expect(dialog.getByRole('link', { name: 'X', exact: true })).toHaveAttribute('href', 'https://x.com/prvSats');
  await expect(dialog.getByRole('link', { name: 'Nostr' })).toHaveAttribute('href', /^https:\/\/primal\.net\/p\/npub1/);
  await expect(dialog).not.toContainText('walletofsatoshi');
  await expect(dialog).not.toContainText('Silent payments');
});

test('«Acerca de» se abre con el logo y desde Archivo, con el código y la dirección Lightning', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Escape');
  const about = page.getByRole('dialog').filter({ hasText: 'Código abierto' });
  await page.getByRole('button', { name: 'Acerca de llave-inglesa' }).click();
  await expect(about).toBeVisible();
  await expect(about.getByRole('button', { name: 'Ver un ejemplo' })).toHaveCount(0);
  await expect(about.getByRole('link', { name: 'unluckyhand034@walletofsatoshi.com' })).toHaveAttribute('href', 'lightning:unluckyhand034@walletofsatoshi.com');
  await expect(about.getByRole('link', { name: 'Código en GitHub' })).toHaveAttribute('href', 'https://github.com/PrvsatsDev/llave-inglesa');
  await expect(about).toContainText('Silent payments');
  await expect(about.getByTitle(/^sp1qqdlem.*uvul77$/)).toBeVisible();
  await expect(about.getByRole('button', { name: 'Copiar la dirección Silent payments' })).toBeVisible();
  for (const name of ['X', 'Nostr', 'Código en GitHub']) await expect(about.getByRole('link', { name, exact: true })).toHaveAttribute('rel', 'noopener noreferrer');
  await page.locator('dialog').screenshot({ path: 'e2e/.capturas/acerca-de.png' });
  await about.getByRole('button', { name: 'Cerrar' }).click();
  await expect(about).toBeHidden();
  await page.getByRole('button', { name: 'Archivo' }).click();
  await page.getByRole('menuitem', { name: 'Acerca de llave-inglesa' }).click();
  await expect(about).toBeVisible();
});
