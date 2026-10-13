import { expect, test, type Page } from '@playwright/test';

/** Timelocks: la política se lee con su espera, y el análisis cuenta los retrasos y lo que cuesta renovar. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test('la key de recuperación de la heredera: retraso en vez de pérdida, y renovar cuesta usabilidad', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r13-recuperacion-heredera');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await expect(page.getByText('Errores que corregir')).toHaveCount(0);
  await capture(page, 'timelock-r13');
  await page.getByRole('button', { name: /^Resiliencia/ }).first().click();
  await expect(page.getByText(/Retraso más probable/)).toBeVisible();
  await capture(page, 'timelock-resiliencia');
  await page.getByRole('button', { name: /^Usabilidad/ }).first().click();
  await expect(page.getByText(/renovar el timelock/)).toBeVisible();
  await capture(page, 'timelock-usabilidad');
});

test('2 de 3 que se relaja: la herencia dice cuánto esperan los herederos', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r14-2de3-se-relaja');
  await expect(page.getByText('2 de 3, o 1 de 3 tras 1 año').first()).toBeVisible();
  await page.getByRole('button', { name: /^Herencia/ }).first().click();
  await expect(page.getByText(/tras esperar 1 año a que venza el timelock/).first()).toBeVisible();
  // También la vía sin esperar, yendo además al banco.
  await expect(page.getByText(/Sin esperar al timelock, también se recupera yendo a 2 ubicaciones/)).toBeVisible();
  await capture(page, 'timelock-herencia');
  // La carta cuenta la espera y la alternativa.
  await page.getByRole('button', { name: 'Preparar la carta' }).click();
  await expect(page.getByRole('heading', { name: 'Sin esperar' })).toBeVisible();
  await expect(page.getByText(/sin moverse \(lo explican los pasos\)/)).toBeVisible();
  await page.locator('article').screenshot({ path: 'e2e/.capturas/timelock-carta.png' });
});

test('plantillas: un 2 de 3 pasa a decreciente, con su espera y su renovación, y luego a herencia simple', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('distribuido-2de3');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await page.getByLabel('Forma').selectOption('decaying');
  await expect(page.getByText('2 de 3, o 1 de 3 tras 6 meses').first()).toBeVisible();
  await page.getByLabel('Espera').fill('12');
  await expect(page.getByText('2 de 3, o 1 de 3 tras 12 meses').first()).toBeVisible();
  await expect(page.getByText(/51840 bloques/)).toBeVisible();
  await page.getByLabel('Mueves las monedas cada').fill('180');
  await expect(page.getByText(/Las mueves antes de que venza la espera/)).toBeVisible();
  await page.locator('aside').first().screenshot({ path: 'e2e/.capturas/plantilla-decreciente.png' });

  // Herencia simple: la última key pasa a ser la de recuperación y en el mapa lleva su espera.
  await page.getByLabel('Forma').selectOption('inheritance');
  await expect(page.getByText('2 de 2 (K1, K2), o K3 tras 12 meses').first()).toBeVisible();
  await page.getByLabel('Key de recuperación').selectOption('k1');
  await expect(page.getByText('2 de 2 (K2, K3), o K1 tras 12 meses').first()).toBeVisible();
  await expect(page.locator('.react-flow').getByText('12 meses').first()).toBeVisible();
  await capture(page, 'plantilla-herencia');
});

test('2 de 3 que se amplía: la key extra lleva su espera en el mapa', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r15-2de3-se-amplia');
  await expect(page.getByLabel('Forma')).toHaveValue('expanding');
  await expect(page.getByLabel('Key extra')).toHaveValue('k4');
  await capture(page, 'plantilla-ampliable');
});
