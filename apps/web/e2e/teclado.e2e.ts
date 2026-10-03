import { expect, test } from '@playwright/test';

/** Todo lo que se hace con el ratón se puede hacer con el teclado. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
  await page.goto('/');
  await expect(page.getByText(/análisis exhaustivo/)).toBeVisible();
});

test('Tab recorre la interfaz y todo lo enfocado se ve', async ({ page }) => {
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Tab');
    const visible = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return true;
      const cs = getComputedStyle(e);
      // Contorno, sombra o el tirador del panel (que se marca con su propio fondo).
      return (cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px') || cs.boxShadow !== 'none' || e.getAttribute('role') === 'separator';
    });
    expect(visible, `pulsación ${i + 1}`).toBe(true);
  }
});

test('Enter sobre un nodo del mapa abre su ficha', async ({ page }) => {
  await page.locator('.react-flow__node').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
});

test('el menú Archivo se maneja con flechas, Tab y Esc', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Archivo' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Nuevo esquema' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Abrir fichero/ })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toBeHidden();
});

test('simular una vía del análisis y volver, solo con teclado', async ({ page }) => {
  await page.getByRole('button', { name: /^Seguridad/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByTitle('Simular en el mapa').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('La usa el atacante').first()).toBeVisible();
  // Esc vuelve a la lista de vías; la simulación sigue en el mapa (así se pueden comparar).
  await page.keyboard.press('Escape');
  await expect(page.getByText('Formas más baratas de robar')).toBeVisible();
  await expect(page.getByText('La usa el atacante').first()).toBeVisible();
});
