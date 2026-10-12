import { expect, test, type Page } from '@playwright/test';

/** Dónde vive cada persona: la ficha, el mapa y el esfuerzo de la llave inglesa por asalto. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

/** Simula a la vez los ataques indicados, por su texto. */
async function simulate(page: Page, attacks: string[]) {
  await page.getByRole('tab', { name: 'Simular' }).or(page.getByRole('button', { name: 'Simular' })).first().click();
  const first = page.getByLabel('Un ataque');
  await first.selectOption((await first.locator('option', { hasText: attacks[0] }).first().getAttribute('value'))!);
  for (const attack of attacks.slice(1)) {
    const add = page.locator('select', { has: page.locator('option', { hasText: 'Añadir otro suceso a la vez' }) });
    await add.selectOption({ label: attack });
  }
}

const effortRow = (page: Page, text: string | RegExp) => page.locator('table tr', { hasText: text });

test('el mapa dice dónde vive cada persona', async ({ page }) => {
  await page.goto('/');
  const pareja = page.locator('.react-flow__node-person', { hasText: 'Pareja' });
  await expect(pareja.getByTitle('Vive en Casa', { exact: true })).toBeVisible();
});

test('dos personas en el mismo sitio son un solo asalto', async ({ page }) => {
  await page.goto('/');
  await simulate(page, ['Llave inglesa a Yo en Casa', 'Llave inglesa a Pareja en Casa']);
  await expect(effortRow(page, 'Llave inglesa a Pareja en Casa')).toContainText('(en el mismo asalto)');
  await expect(effortRow(page, 'Total')).toContainText('3,5');
  await capture(page, 'asalto-mismo-sitio');
});

test('llevar a la misma persona al banco es el mismo secuestro', async ({ page }) => {
  await page.goto('/');
  await simulate(page, ['Llave inglesa a Yo en Casa', 'Llave inglesa a Yo en Caja del banco']);
  await expect(effortRow(page, 'Llave inglesa a Yo en Caja del banco')).toContainText('(en el mismo asalto; hay que llevarle al banco)');
  // El +1 del banco ya incluye llevarle: no se suma ni se menciona el de no vivir allí.
  await expect(effortRow(page, 'Llave inglesa a Yo en Caja del banco')).not.toContainText('no vive');
  // 3,5 + 1 por llevarle al banco + 1 por un sitio más.
  await expect(effortRow(page, 'Total')).toContainText('5,5');
  await capture(page, 'asalto-traslado');
});

test('si no vive allí, la ficha lo dice y llevarle cuesta más', async ({ page }) => {
  await page.goto('/');
  await page.locator('.react-flow__node-person', { hasText: 'Pareja' }).click();
  const home = page.getByRole('combobox', { name: 'Vive en' });
  await expect(home.locator('option')).toHaveText(['Sin indicar', 'Casa', 'Casa de mis padres']);
  await home.selectOption({ label: 'Casa de mis padres' });
  await expect(page.getByText(/exige llevarle allí/)).toBeVisible();
  await capture(page, 'vive-en-ficha');
  await home.selectOption({ label: 'Sin indicar' });
  await expect(page.getByText(/se le puede coaccionar en cualquier sitio sin recargo/)).toBeVisible();
  await home.selectOption({ label: 'Casa de mis padres' });

  await simulate(page, ['Llave inglesa a Yo en Casa', 'Llave inglesa a Pareja en Casa']);
  await expect(effortRow(page, 'Llave inglesa a Pareja en Casa')).toContainText('donde no vive: hay que llevarle');
  await expect(effortRow(page, 'Total')).toContainText('4');
  await capture(page, 'asalto-no-vive-alli');
});
