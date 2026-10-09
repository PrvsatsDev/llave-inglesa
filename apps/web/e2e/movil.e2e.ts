import { expect, test, type Page } from '@playwright/test';

/** Pantalla de teléfono: panel y mapa en pestañas. Las capturas quedan en e2e/.capturas. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Panel o mapa' });
const map = (page: Page) => page.getByRole('main', { name: 'Mapa de custodia' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test('panel y mapa van en pestañas; tocar un nodo del mapa abre su ficha en el panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  await expect(map(page)).toBeHidden();
  // En móvil la columna no se pliega.
  await expect(page.getByRole('button', { name: 'Plegar el panel' })).toBeHidden();

  await tabs(page).getByRole('button', { name: /^Mapa/ }).click();
  await expect(map(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
  // La leyenda empieza plegada para no tapar el mapa.
  await expect(page.getByText('accede siempre')).toBeHidden();
  await expect(page.locator('.react-flow__node-location').first()).toBeInViewport();
  await capture(page, 'movil-mapa');

  await page.locator('.react-flow__node-location').filter({ hasText: 'Casa' }).first().click({ position: { x: 24, y: 14 } });
  await expect(panel(page)).toBeVisible();
  await expect(map(page)).toBeHidden();
  await expect(page.getByLabel('Nombre')).toHaveValue('Casa');
  await expect(page.getByRole('button', { name: /Volver/ })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await capture(page, 'movil-ficha');
});

test('simular desde el panel avisa en la pestaña del mapa, sin saltar sola', async ({ page }) => {
  await page.goto('/');
  const mapTab = tabs(page).getByRole('button', { name: /^Mapa/ });
  await expect(mapTab).not.toContainText('nuevo');
  await page.getByRole('button', { name: /^Seguridad/ }).first().click();
  await page.getByTitle('Simular en el mapa').first().click();
  await expect(mapTab).toContainText('nuevo');
  await expect(map(page)).toBeHidden();
  await capture(page, 'movil-aviso-mapa');

  await mapTab.click();
  await expect(mapTab).not.toContainText('nuevo');
  await expect(page.getByText('Simulando ataque')).toBeVisible();
  await capture(page, 'movil-simulacion');
});

test('el mapa va en vertical: cada ejemplo cabe a lo ancho, legible y sin nodos montados', async ({ page }) => {
  await page.goto('/');
  await tabs(page).getByRole('button', { name: /^Mapa/ }).click();
  const picker = page.getByLabel('Documento abierto o ejemplo');
  const examples = await picker.locator('optgroup option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  for (const id of examples) {
    await picker.selectOption(id);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    const zoom = await page.locator('.react-flow__viewport').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
    expect(zoom, id).toBeGreaterThan(0.5);
    const boxes = await page.locator('.react-flow__node').evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().toJSON() as DOMRect));
    for (const [i, a] of boxes.entries()) {
      expect(a.left, id).toBeGreaterThanOrEqual(0);
      expect(a.right, id).toBeLessThanOrEqual(390);
      for (const b of boxes.slice(i + 1)) {
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap, `${id}: nodos montados`).toBe(false);
      }
    }
  }
  // Una ubicación dentro de otra queda debajo de ella, con la flecha hacia arriba.
  await picker.selectOption('r10-2de3-custodio');
  await capture(page, 'movil-mapa-vertical');
});

test('en tableta en vertical también hay pestañas, y en escritorio no', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('/');
  await expect(tabs(page)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(tabs(page)).toBeHidden();
  await expect(map(page)).toBeVisible();
  await expect(panel(page)).toBeVisible();
});

test.describe('con pantalla táctil', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('pellizcar o arrastrar con un dedo sobre un nodo mueve el mapa, no el nodo', async ({ page }) => {
    await page.goto('/');
    await tabs(page).getByRole('button', { name: /^Mapa/ }).click();
    const node = page.locator('.react-flow__node-location').first();
    const box = (await node.boundingBox())!;
    const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
    const viewport = () => page.locator('.react-flow__viewport').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform));
    const position = () => node.evaluate((e) => (e as HTMLElement).style.transform);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });

    const before = { view: await viewport(), node: await position() };
    // Pellizco: dos dedos que se separan encima del nodo.
    await touch('touchStart', [[cx - 10, cy], [cx + 10, cy]]);
    for (let d = 15; d <= 40; d += 5) await touch('touchMove', [[cx - d, cy], [cx + d, cy]]);
    await touch('touchEnd', []);
    await expect.poll(async () => (await viewport()).a).toBeGreaterThan(before.view.a * 1.3);

    // Un dedo que arrastra encima del nodo desplaza el mapa.
    const zoomed = await viewport();
    await touch('touchStart', [[cx, cy]]);
    for (let d = 10; d <= 60; d += 10) await touch('touchMove', [[cx + d, cy + d]]);
    await touch('touchEnd', []);
    await expect.poll(async () => (await viewport()).e).toBeGreaterThan(zoomed.e + 30);
    expect(await position()).toBe(before.node);
  });
});
