import { HDKey } from '@scure/bip32';
import { expect, test, type Page } from '@playwright/test';

/** Editor libre de la política y descriptores de Liana con una key en varias ramas (<2;3>). */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const policy = (page: Page) => page.getByRole('group', { name: 'Política de gasto' });

test('árbol libre: un 2 de 3 con una rama de recuperación en la que vuelve a firmar K1', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('distribuido-2de3');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await page.getByLabel('Forma').selectOption('free');
  await expect(policy(page)).toBeVisible();
  await page.locator('aside').first().screenshot({ path: 'e2e/.capturas/arbol-inicio.png' });

  // Un grupo nuevo: como K1, K2 y K3 ya están en la raíz, se crea K4.
  await policy(page).getByRole('button', { name: 'Grupo', exact: true }).last().click();
  const branch = policy(page).getByRole('group', { name: 'Grupo' });
  await expect(branch).toBeVisible();
  // Una espera en el grupo: K4 tras 6 meses, y la raíz pasa a ser el multisig ampliable.
  await branch.getByRole('button', { name: 'Espera', exact: true }).click();
  await expect(page.getByText('2 de 4 (K1, K2, K3, K4 tras 6 meses)').first()).toBeVisible();
  // K1 también firma en la rama con espera (en el descriptor irá con <2;3>).
  await branch.getByLabel('Key', { exact: true }).selectOption('k1');
  await expect(page.getByText('2 de 4 (K1, K2, K3, K1 tras 6 meses)').first()).toBeVisible();
  await expect(page.getByText('Errores que corregir')).toHaveCount(0);
  // La espera de la rama se cambia en su hoja.
  await branch.getByLabel('Espera', { exact: true }).fill('3');
  await expect(page.getByText('2 de 4 (K1, K2, K3, K1 tras 3 meses)').first()).toBeVisible();
  await page.locator('aside').first().screenshot({ path: 'e2e/.capturas/arbol-rama.png' });

  // Quitar la key de la rama la quitaría entera; quitar la raíz entera no se puede.
  await branch.getByRole('button', { name: 'Quitar' }).first().click();
  await expect(policy(page).getByRole('group', { name: 'Grupo' })).toHaveCount(0);
  await expect(page.getByRole('paragraph').filter({ hasText: /^2 de 3$/ }).first()).toBeVisible();
});

/** Tres keys de semillas de prueba (no son de nadie). */
const keys = [1, 2, 3].map((seed) => {
  const n = HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? seed : i)));
  return `[${n.fingerprint.toString(16).padStart(8, '0')}/48'/0'/0'/2']${n.derive("m/48'/0'/0'/2'").publicExtendedKey}`;
});
// Como lo escribe Liana: 2 de 2 ya, o 2 de 3 tras 1 año; K1 y K2 repiten con <2;3> en la rama con espera.
const [a, b, c] = keys;
const liana = `wsh(or_d(multi(2,${a}/<0;1>/*,${b}/<0;1>/*),and_v(v:thresh(2,pkh(${a}/<2;3>/*),a:pkh(${b}/<2;3>/*),a:pkh(${c}/<0;1>/*)),older(52560))))`;
const section = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Descriptor de la cartera' }) });

test('un descriptor de Liana con <2;3>: se usa su política y se escribe tal cual', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('todo-en-casa');
  await section(page).getByRole('button', { name: 'Importar', exact: true }).click();
  await page.getByLabel('Descriptor a importar').fill(liana);
  await page.getByRole('button', { name: 'Importar descriptor' }).click();
  await expect(page.getByRole('alert')).toContainText('El descriptor es 2 de 2 (#1, #2), o 2 de 3 (#1, #2, #3) tras 1 año y el esquema 2 de 3');
  await capture(page, 'liana-otra-politica');
  await page.getByRole('button', { name: 'Usar la política del descriptor' }).click();
  await expect(section(page).getByRole('status')).toContainText('Importado');
  await expect(page.getByText('2 de 2 (K1, K2), o 2 de 3 (K1, K2, K3) tras 1 año').first()).toBeVisible();
  await expect(page.getByTestId('descriptor')).toContainText(liana.replace(/'/g, "'"));
  await expect(page.getByLabel('Forma')).toHaveValue('free');
  // Las formas de gastar, en llano: lo que Liana llama vía principal y vía de recuperación.
  const stages = page.getByText('Formas de gastar').locator('..');
  await expect(stages).toContainText('En cualquier momento: K1 y K2');
  await expect(stages).toContainText('Si llevan 1 año sin moverse: 2 cualesquiera de K1, K2 y K3');
  await policy(page).scrollIntoViewIfNeeded();
  await page.locator('aside').first().screenshot({ path: 'e2e/.capturas/liana-arbol.png' });
  await section(page).scrollIntoViewIfNeeded();
  await capture(page, 'liana-importado');
});
