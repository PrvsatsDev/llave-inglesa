import { expect, test, type Page } from '@playwright/test';

/** La guía de uso: se abre desde Archivo, la bienvenida y «Acerca de», y actúa sobre el mapa sin cerrarse. */

const capture = (page: Page, name: string) => page.screenshot({ path: `e2e/.capturas/${name}.png` });
const guide = (page: Page) => page.getByRole('complementary', { name: 'Panel' });

test('desde la bienvenida, «Primeros pasos»: abrir el ejemplo y simular sin salir de la guía', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Guía de 5 minutos/ }).click();
  await expect(guide(page).getByRole('heading', { name: 'Primeros pasos' })).toBeVisible();
  await capture(page, 'guia-capitulo');

  await page.getByRole('button', { name: 'Abrir «Todo a mano en casa»' }).click();
  await expect(page.getByRole('button', { name: /Abrir «Todo a mano en casa»/ })).toContainText('abierto');

  await page.getByRole('button', { name: /Simular una llave inglesa a Yo en Casa/ }).click();
  await expect(page.getByText('La usa el atacante').first()).toBeVisible();
  // Sigue en la guía, con el botón marcado.
  await expect(guide(page).getByRole('heading', { name: 'Primeros pasos' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Simular una llave inglesa/ })).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'guia-simulando');

  // Volver: al índice y, después, a la sección en la que se estaba.
  await page.keyboard.press('Escape');
  await expect(guide(page).getByRole('button', { name: /Primeros pasos/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide(page).getByRole('heading', { name: 'Primeros pasos' })).toHaveCount(0);
  await expect(page.getByText('Política de gasto')).toBeVisible();
});

test('las cifras de la guía coinciden con las tarjetas', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Archivo' }).click();
  await page.getByRole('menuitem', { name: 'Guía de uso' }).click();
  await page.getByRole('button', { name: /Primeros pasos/ }).click();
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
  const card = await page.getByRole('button', { name: /^Seguridad/ }).innerText();
  const security = card.match(/\d+/)![0];
  await expect(guide(page).getByText(new RegExp(`^${security} ·`)).first()).toBeVisible();
});

test('«Acerca de» lleva a la guía', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Acerca de llave-inglesa' }).click();
  await page.getByRole('button', { name: 'Guía de uso' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(guide(page).getByRole('button', { name: /Primeros pasos/ })).toBeVisible();
  await capture(page, 'guia-indice');
});

test('si sales de la guía desde un capítulo, Archivo → Guía de uso te devuelve a él', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true })));
  await page.goto('/');
  const openFromMenu = async () => {
    await page.getByRole('button', { name: 'Archivo' }).click();
    await page.getByRole('menuitem', { name: 'Guía de uso' }).click();
  };
  await openFromMenu();
  await page.getByRole('button', { name: /Primeros pasos/ }).click();
  // Pulsar una nota saca de la guía…
  await page.getByRole('button', { name: /^Seguridad/ }).click();
  await expect(guide(page).getByRole('heading', { name: 'Primeros pasos' })).toHaveCount(0);
  // …y el menú devuelve al mismo capítulo.
  await openFromMenu();
  await expect(guide(page).getByRole('heading', { name: 'Primeros pasos' })).toBeVisible();
  // Volver al índice a propósito: la próxima vez se abre en el índice.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await openFromMenu();
  await expect(guide(page).getByRole('button', { name: /Primeros pasos/ })).toBeVisible();
});

