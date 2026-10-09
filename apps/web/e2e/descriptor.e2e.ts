import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { expect, test, type Page } from '@playwright/test';

/** Descriptor de la cartera: importar uno, ver la primera dirección y rechazar lo que nunca debe entrar. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

/** Tres keys de semillas de prueba (no son de nadie), como las exportaría Sparrow. */
const nodes = [1, 2, 3].map((seed) => HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? seed : i))));
const keys = nodes.map((n) => ({ fingerprint: n.fingerprint.toString(16).padStart(8, '0'), xpub: n.derive("m/48'/0'/0'/2'").publicExtendedKey }));
const descriptor = `wsh(sortedmulti(2,${keys.map((k) => `[${k.fingerprint}/48h/0h/0h/2h]${k.xpub}/<0;1>/*`).join(',')}))`;
/** La primera dirección, calculada aparte con btc-signer. */
const firstAddress = (() => {
  const pubkeys = keys.map((k) => HDKey.fromExtendedKey(k.xpub).deriveChild(0).deriveChild(0).publicKey!).sort((a, b) => Buffer.compare(a, b));
  return btc.p2wsh(btc.p2ms(2, pubkeys)).address!;
})();

const section = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Descriptor de la cartera' }) });

test('importar un descriptor rellena las keys y muestra la primera dirección para comprobarla', async ({ page }) => {
  await page.goto('/');
  await expect(section(page)).toContainText('Importa el descriptor que ya tienes');
  await section(page).getByRole('button', { name: 'Importar', exact: true }).click();
  await page.getByLabel('Descriptor a importar').fill(descriptor);
  await page.getByRole('button', { name: 'Importar descriptor' }).click();

  await expect(section(page).getByRole('status')).toContainText('Importado: K1, por orden; K2, por orden; K3, por orden.');
  await expect(page.getByTestId('primera-direccion')).toHaveText(firstAddress);
  await expect(page.getByTestId('descriptor')).toContainText(`wsh(sortedmulti(2,[${keys[0]!.fingerprint}/48'/0'/0'/2']${keys[0]!.xpub}/<0;1>/*`);
  await expect(section(page)).toContainText('Guárdalo cifrado');
  await capture(page, 'descriptor-importado');

  // La ficha de la key muestra lo importado; borrar la xpub hace que el descriptor diga qué falta.
  await page.getByRole('button', { name: /^K2/ }).first().click();
  await expect(page.getByLabel('Derivación')).toHaveValue("m/48'/0'/0'/2'");
  await expect(page.getByLabel('Xpub')).toHaveValue(keys[1]!.xpub);
  await capture(page, 'descriptor-ficha-key');
  await page.getByLabel('Xpub').fill('');
  await page.getByRole('button', { name: /Volver/ }).click();
  await expect(section(page)).toContainText('Falta la xpub de K2.');
});

test('una clave privada o unas palabras nunca se quedan: se borran y se avisa', async ({ page }) => {
  await page.goto('/');
  await section(page).getByRole('button', { name: 'Importar', exact: true }).click();
  const box = page.getByLabel('Descriptor a importar');
  await box.fill(`wpkh(${nodes[0]!.privateExtendedKey}/0/*)`);
  await page.getByRole('button', { name: 'Importar descriptor' }).click();
  await expect(page.getByRole('alert')).toContainText('clave privada');
  await expect(box).toHaveValue('');

  await box.fill('abandon '.repeat(11) + 'about');
  await page.getByRole('button', { name: 'Importar descriptor' }).click();
  await expect(page.getByRole('alert')).toContainText('frase semilla');
  await expect(box).toHaveValue('');

  // En la ficha de la key, igual.
  await page.getByRole('button', { name: /^K1/ }).first().click();
  await page.getByLabel('Xpub').fill(nodes[0]!.privateExtendedKey);
  await expect(page.getByRole('alert')).toContainText('clave privada');
  await expect(page.getByLabel('Xpub')).toHaveValue('');
  await capture(page, 'descriptor-privada');
});
