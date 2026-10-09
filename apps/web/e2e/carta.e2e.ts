import { expect, test, type Page } from '@playwright/test';

/** Carta para los herederos: solo lo que usan, nombres reales y mensaje al vuelo que no se guardan. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test('la carta lleva solo lo que usan los herederos, con los nombres reales escritos al vuelo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Herencia/ }).first().click();
  await page.getByRole('button', { name: 'Preparar la carta' }).click();
  const sheet = page.getByRole('dialog', { name: 'Carta para los herederos' });
  const letter = sheet.locator('article');

  await expect(letter.getByRole('heading', { level: 1 })).toHaveText('Para Pareja');
  await expect(letter).toContainText('tras el fallecimiento de Yo');
  await expect(letter).toContainText('necesita 2 de sus 3 llaves');
  await expect(letter).toContainText('Placa de metal K1: la frase semilla de K1.');
  await expect(letter).toContainText('Descriptor impreso: el descriptor de la cartera');
  // Las arandelas de K3 no hacen falta, pero llegan a ellas: van de reserva. El Coldcard (sin su PIN) no sale.
  await expect(letter).toContainText('Arandelas K3 (de reserva): la frase semilla de K3.');
  await expect(letter).toContainText('Lo marcado «de reserva» no hace falta');
  await expect(letter).not.toContainText('Coldcard');
  await expect(sheet).not.toContainText('no llegan a ninguna copia del descriptor');
  await expect(sheet).toContainText('impresora tuya conectada por cable o sin red');
  await capture(page, 'carta');

  await sheet.getByLabel('Nombre real de Pareja').fill('Lucía');
  await sheet.getByLabel('Nombre real de Caja del banco').fill('Caja 214, sucursal de la calle Mayor');
  await sheet.getByLabel('Mensaje personal').fill('Tómatelo con calma.');
  await expect(letter.getByRole('heading', { level: 1 })).toHaveText('Para Lucía');
  await expect(letter.getByRole('heading', { name: 'Caja 214, sucursal de la calle Mayor' })).toBeVisible();
  await expect(letter).toContainText('Tómatelo con calma.');
  await capture(page, 'carta-nombres');

  // Lo escrito al vuelo no queda en ningún sitio: ni en el navegador, ni al volver a abrirla.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('Lucía');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: 'Preparar la carta' }).click();
  await expect(letter.getByRole('heading', { level: 1 })).toHaveText('Para Pareja');
  await expect(sheet.getByLabel('Mensaje personal')).toHaveValue('');

  // Al imprimir solo sale la carta.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(sheet.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeHidden();
  await page.pdf({ path: 'e2e/.capturas/carta.pdf', preferCSSPageSize: true });
});

test('si los herederos no recuperan los fondos no hay carta', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r06-passphrase-solo-memoria');
  await page.getByRole('button', { name: /^Herencia/ }).first().click();
  await expect(page.getByText('no consigue recuperar los fondos').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparar la carta' })).toHaveCount(0);
});
