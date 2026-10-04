import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Recorridos de uso en el build de producción. Las capturas quedan en e2e/.capturas para revisarlas. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });

/** La app no debe dar ningún error de JavaScript ni de CSP durante un recorrido. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

// Los recorridos empiezan con la bienvenida ya vista (solo si este navegador aún no tiene preferencias,
// para no pisar lo que guarde la propia prueba antes de recargar). La bienvenida tiene sus pruebas en bienvenida.e2e.ts.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

const scoreCard = (page: Page, metric: string) => page.getByRole('button', { name: new RegExp(`^${metric}`) }).first();

test('cada ejemplo carga, se analiza y no tiene errores de modelo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const picker = page.getByLabel('Documento abierto o ejemplo');
  const examples = await picker.locator('optgroup option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(examples.length).toBeGreaterThanOrEqual(3);
  for (const id of examples) {
    await picker.selectOption(id);
    await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
    await expect(page.getByText('Errores que corregir')).toHaveCount(0);
  }
  // La galería se muestra con su descripción, que explica qué enseña cada esquema.
  await picker.selectOption('r02-foto-en-la-nube');
  await expect(page.getByText('El error clásico: basta con hackear la cuenta.').first()).toBeVisible();
  await capture(page, 'galeria');
  expect(errors).toEqual([]);
});

test('simular el robo más barato desde el análisis', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await scoreCard(page, 'Seguridad').click();
  await page.getByTitle('Simular en el mapa').first().click();
  await expect(page.getByText('La usa el atacante').first()).toBeVisible();
  await capture(page, 'simular-robo');
  expect(errors).toEqual([]);
});

test('simular un incendio y probar que la placa tampoco resiste', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Simular' }).or(page.getByRole('button', { name: 'Simular' })).first().click();
  const disaster = page.getByLabel('Una desgracia');
  const fire = await disaster.locator('option', { hasText: 'Incendio en Casa' }).first().getAttribute('value');
  await disaster.selectOption(fire!);
  await expect(page.getByText('Resiste').first()).toBeVisible();
  await page.getByRole('button', { name: '¿Y si no resiste?' }).first().click();
  await expect(page.getByText(/Pérdida de Placa/).first()).toBeVisible();
  await capture(page, 'simular-incendio');
  expect(errors).toEqual([]);
});

test('plegar y desplegar el panel no rompe la interfaz', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Plegar el panel' }).click();
  await page.getByRole('button', { name: 'Desplegar el panel' }).click();
  await expect(page.getByRole('button', { name: 'Plegar el panel' })).toBeVisible();
  await expect(page.getByText('Algo ha fallado')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('añadir un dispositivo desde el Esquema avisa de que nadie sabe su PIN', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Dispositivo', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  // Se abre la ficha del dispositivo nuevo; los avisos están en la raíz del Esquema.
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Nadie sabe el PIN de Nuevo dispositivo/)).toBeVisible();
  await capture(page, 'nuevo-dispositivo');
  expect(errors).toEqual([]);
});

test('exportar sin cifrar y volver a abrir el fichero', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Archivo' }).click();
  await page.getByRole('menuitem', { name: /Exportar sin cifrar/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar de todos modos' }).click();
  const file = info.outputPath('exportado.json');
  await (await download).saveAs(file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  expect(json.format).toBe('llave-inglesa');

  await page.getByRole('button', { name: 'Archivo' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /Abrir fichero/ }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByLabel('Documento abierto o ejemplo')).toContainText(json.name);
  expect(errors).toEqual([]);
});

test('guardar cifrado en el navegador y reabrirlo tras recargar', async ({ page }) => {
  const errors = watchErrors(page);
  const password = 'una frase larga para la prueba 42';
  await page.goto('/');
  await page.getByRole('button', { name: 'Archivo' }).click();
  await page.getByRole('menuitem', { name: /Guardar en este navegador/ }).click();
  await page.getByLabel('Contraseña').fill(password);
  await page.getByLabel('Repítela').fill(password);
  await page.getByRole('button', { name: 'Cifrar' }).click();
  await expect(page.getByText('Guardado', { exact: true })).toBeVisible();

  // Al arrancar con un documento guardado, la app ofrece abrirlo directamente.
  await page.reload();
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByLabel('Documento abierto o ejemplo')).toContainText('navegador');
  expect(errors).toEqual([]);
});

for (const [name, width, height] of [
  ['tableta', 820, 1000],
  ['movil', 390, 844],
] as const) {
  test(`en ${name} la cabecera cabe y no hay scroll horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const header = await page.getByRole('banner').boundingBox();
    expect(header!.height).toBeLessThanOrEqual(60);
    await capture(page, name);
  });
}

test('en móvil avisa de que está pensada para pantalla grande; cerrado, no vuelve', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const notice = page.getByRole('note').filter({ hasText: 'Pensada para pantalla grande' });
  await expect(notice).toBeVisible();
  await capture(page, 'movil-aviso');
  await notice.getByRole('button', { name: 'Entendido' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await expect(page.getByText('Pensada para pantalla grande')).toHaveCount(0);
});

test('en escritorio no hay aviso de móvil', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await expect(page.getByText('Pensada para pantalla grande')).toBeHidden();
});

test('una key que mezcla RNG y dados explica que la mezcla no se puede verificar', async ({ page }) => {
  await page.goto('/');
  // En «Todo a mano en casa», K1 mezcla el RNG de la Coldcard con 99 dados.
  await page.getByRole('button', { name: /^K1/ }).first().click();
  await expect(page.getByText(/Mezclando un RNG con tus tiradas, normalmente no se puede verificar/)).toBeVisible();
  // Un campo opcional vacío (fingerprint) no se marca como error.
  await expect(page.getByLabel('Fingerprint')).not.toHaveClass(/invalid/);
  await capture(page, 'pista-mezcla');
});
