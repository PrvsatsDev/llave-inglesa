import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { expect, test, type Page } from '@playwright/test';

/** Keys repartidas (FROST, Shamir) y Taproot: fichas, mapa, cartera y análisis. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const wallet = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Descriptor de la cartera' }) });
const location = (page: Page, name: string) => page.locator('.react-flow__node-location', { hasText: name }).first();

/** La xpub del ejemplo de Frostsnap (semilla de prueba, de nadie) y su primera dirección Taproot, calculada aparte. */
const firstTaproot = (() => {
  const node = HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff)).derive('m/0/0');
  const pub = HDKey.fromExtendedKey(node.publicExtendedKey).deriveChild(0).deriveChild(0).publicKey!;
  return btc.p2tr(pub.slice(1)).address!;
})();

test('Frostsnap 2 de 3: la key FROST, sus dispositivos sin PIN, el mapa y la cartera Taproot sin descriptor que guardar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r16-frostsnap-2de3');
  await expect(page.getByText('Errores que corregir')).toHaveCount(0);
  await expect(page.getByText('FROST 2 de 3').first()).toBeVisible();
  await expect(location(page, 'Oficina').getByText('K1·2').first()).toBeVisible();
  await capture(page, 'repartidas-frostsnap');

  await expect(wallet(page)).toContainText('no hay que guardar ningún descriptor');
  await expect(page.getByTestId('descriptor')).toContainText('tr([');
  await expect(page.getByTestId('primera-direccion')).toHaveText(firstTaproot);
  await expect(wallet(page)).toContainText('ordenador cuántico');
  await wallet(page).scrollIntoViewIfNeeded();
  await capture(page, 'repartidas-cartera-taproot');

  await page.getByRole('button', { name: /FROST 2 de 3/ }).click();
  await expect(page.getByRole('radio', { name: 'FROST' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Requiere passphrase')).toHaveCount(0);
  await expect(page.getByText('Móviles emparejados')).toBeVisible();
  await capture(page, 'repartidas-ficha-key');

  await location(page, 'Casa').getByText('Frostsnap 1').click();
  await expect(page.getByText('Shares FROST que guarda')).toBeVisible();
  await expect(page.getByText(/Este modelo no tiene PIN/)).toBeVisible();
  await expect(page.getByText(/mismo fabricante/).first()).toBeVisible();
  await capture(page, 'repartidas-ficha-dispositivo');
});

test('Frostsnap: un dispositivo y su tarjeta no bastan, y el análisis lo explica', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r16-frostsnap-2de3');
  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await capture(page, 'repartidas-seguridad');
  await page.getByRole('button', { name: /^Herencia/ }).first().click();
  await capture(page, 'repartidas-herencia');
  await page.getByRole('button', { name: 'Preparar la carta' }).click();
  await expect(page.getByText(/app de Frostsnap/).first()).toBeVisible();
  await expect(page.getByText(/frostsnap-thaw/)).toBeVisible();
  await page.locator('article').screenshot({ path: 'e2e/.capturas/repartidas-carta.png' });
});

test('una key con la semilla escrita no puede ser FROST (y se dice por qué); sí Shamir, con sus shares', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('todo-en-casa');
  await page.getByRole('button', { name: /^K2/ }).first().click();
  await page.getByRole('radio', { name: 'FROST' }).click();
  await expect(page.getByRole('radio', { name: 'Semilla' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/No puede ser FROST mientras/)).toBeVisible();
  await page.getByRole('radio', { name: 'Shamir' }).click();
  await expect(page.getByRole('radio', { name: 'Shamir' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Shares que bastan')).toHaveValue('2');
  await expect(page.getByRole('button', { name: 'Quitar la share 3' })).toBeVisible();
  await capture(page, 'repartidas-shamir-nueva');
});

test('Trezor con Shamir 2 de 3: las shares en el mapa y la carta explica cómo se juntan', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r17-shamir-trezor');
  await expect(page.getByText('Errores que corregir')).toHaveCount(0);
  await expect(location(page, 'Caja en banco').getByText('K1·2').first()).toBeVisible();
  await capture(page, 'repartidas-shamir');
  await page.getByRole('button', { name: /^Herencia/ }).first().click();
  await page.getByRole('button', { name: 'Preparar la carta' }).click();
  await expect(page.getByText(/SLIP-39/).first()).toBeVisible();
});

test('single-sig en Taproot: se elige el tipo de dirección y avisa del ordenador cuántico', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('singlesig-passphrase');
  await expect(wallet(page)).not.toContainText('ordenador cuántico');
  await wallet(page).getByRole('radio', { name: /Taproot/ }).click();
  await expect(wallet(page)).toContainText('ordenador cuántico');
  await wallet(page).scrollIntoViewIfNeeded();
  await capture(page, 'repartidas-singlesig-taproot');
});

test('en inglés: la ficha de la key FROST y el mapa', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r16-frostsnap-2de3');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('FROST 2 of 3').first()).toBeVisible();
  await page.getByRole('button', { name: /FROST 2 of 3/ }).click();
  await expect(page.getByText('What it is', { exact: true })).toBeVisible();
  await expect(page.getByText('Paired phones')).toBeVisible();
  await expect(page.locator('.react-flow__node-location', { hasText: 'Office' }).getByText('stores shares').first()).toBeVisible();
  await capture(page, 'repartidas-ingles');
});
