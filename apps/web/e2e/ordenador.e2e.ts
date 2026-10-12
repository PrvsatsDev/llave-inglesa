import { expect, test, type Page } from '@playwright/test';

/** Ordenador de firma: en una ubicación o encima de una persona; uno de uso general resta 2 de seguridad. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const location = (page: Page, name: string) => page.locator('.react-flow__node-location', { hasText: name }).first();
const securityRow = (page: Page, text: string | RegExp) => page.locator('table tr', { hasText: text });

test('sin ordenador, Seguridad recuerda que falta y no resta nada', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await expect(page.getByText(/No consta con qué ordenador o móvil firmas/)).toBeVisible();
  await expect(securityRow(page, 'Se firma con un ordenador')).toHaveCount(0);
});

test('un portátil de uso general en casa aparece en el mapa y resta 2; dedicado, nada', async ({ page }) => {
  await page.goto('/');
  await location(page, 'Casa').locator('header').click();
  await page.getByRole('button', { name: 'Ordenador de firma', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Dónde está' })).toHaveValue('l:casa');
  await page.getByRole('textbox', { name: 'Nombre' }).fill('Portátil con Sparrow');
  await expect(location(page, 'Casa').getByText('Portátil con Sparrow')).toBeVisible();
  await expect(location(page, 'Casa').getByText('uso general · con la cartera')).toBeVisible();
  await capture(page, 'ordenador-ficha');

  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await expect(securityRow(page, 'Se firma con un ordenador o móvil de uso general')).toContainText('−2');
  await expect(page.getByText(/No consta con qué ordenador/)).toHaveCount(0);
  await capture(page, 'ordenador-seguridad');

  await location(page, 'Casa').getByText('Portátil con Sparrow').click();
  await page.getByRole('radio', { name: 'Dedicado' }).click();
  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await expect(securityRow(page, 'Se firma con un ordenador')).toHaveCount(0);
});

test('un móvil va con la persona: se añade desde su ficha y sale en su tarjeta', async ({ page }) => {
  await page.goto('/');
  const yo = page.locator('.react-flow__node-person', { hasText: 'Yo' }).first();
  await yo.click();
  await page.getByRole('button', { name: 'Móvil de firma', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Dónde está' })).toHaveValue('p:yo');
  await expect(page.getByText(/Va siempre con su dueño/)).toBeVisible();
  await expect(yo.getByText('Móvil de Yo')).toBeVisible();
  await capture(page, 'ordenador-movil');
  // En el índice del Esquema, el formulario de añadir también lo ofrece.
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Dispositivo', exact: true }).first().click();
  await expect(page.getByRole('radio', { name: 'Ordenador de firma' })).toBeVisible();
  await capture(page, 'ordenador-anadir');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await yo.click();
  await page.locator('.react-flow__node-person').getByText('Móvil de Yo').click();
  // Guardarlo en casa lo saca de la tarjeta de la persona.
  await page.getByRole('combobox', { name: 'Dónde está' }).selectOption({ label: 'Guardado en Casa' });
  await expect(yo.getByText('Móvil de Yo')).toHaveCount(0);
  await expect(location(page, 'Casa').getByText('Móvil de Yo')).toBeVisible();
});

test('malware en el portátil: ataca el BitBox02 con firmware afectado si se le conecta; por QR, no', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Documento abierto o ejemplo').selectOption('r08-2de3-todo-en-casa');
  await location(page, 'Casa').getByText('BitBox02').first().click();
  await page.getByRole('textbox', { name: 'Firmware instalado' }).fill('9.20.0');
  await location(page, 'Casa').locator('header').click();
  await page.getByRole('button', { name: 'Ordenador de firma', exact: true }).click();
  await expect(page.getByText(/Tiene un fallo explotable desde un ordenador con malware \(BitBox02 2026\)/)).toBeVisible();
  await capture(page, 'ordenador-conectados');

  // En Simular, el malware sale como ataque y marca el portátil y el BitBox02.
  await page.getByRole('tab', { name: 'Simular' }).or(page.getByRole('button', { name: 'Simular' })).first().click();
  const attack = page.getByLabel('Un ataque');
  await attack.selectOption((await attack.locator('option', { hasText: 'Malware en Nuevo ordenador' }).first().getAttribute('value'))!);
  await expect(location(page, 'Casa').getByText('Con malware')).toBeVisible();
  await expect(location(page, 'Casa').getByText('Atacado desde el ordenador')).toBeVisible();
  await capture(page, 'ordenador-malware');

  // Usado solo por QR: se desmarca y el BitBox02 ya no se puede atacar desde ahí.
  await location(page, 'Casa').getByText('Nuevo ordenador').click();
  await page.getByRole('checkbox', { name: /BitBox02/ }).uncheck();
  await expect(page.getByRole('button', { name: 'Sin indicar' })).toBeVisible();
  await page.getByRole('tab', { name: 'Simular' }).or(page.getByRole('button', { name: 'Simular' })).first().click();
  await expect(location(page, 'Casa').getByText('Atacado desde el ordenador')).toHaveCount(0);
});
