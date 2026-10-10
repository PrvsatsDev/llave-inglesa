import { expect, test } from '@playwright/test';

/** Idioma: se detecta del navegador, se cambia con ES | EN, se recuerda y cambiarlo no pierde nada. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('llave-inglesa:panel')) localStorage.setItem('llave-inglesa:panel', JSON.stringify({ welcomeSeen: true }));
  });
});

test.describe('con el navegador en inglés', () => {
  test.use({ locale: 'en-US' });

  test('arranca en inglés, sin errores', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByText('Security').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await page.screenshot({ path: 'e2e/.capturas/ingles.png' });
    expect(errors).toEqual([]);
  });

  test('ES cambia a español, conserva el trabajo y se recuerda al recargar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Setup' }).first().click();
    // Un cambio sin guardar y una ficha abierta: el cambio de idioma no los pierde.
    await page.getByText('Setup name and description').click();
    await page.getByLabel('Setup name').fill('Prueba de idioma');
    // La ubicación se llama «Casa»: los nombres del ejemplo son datos, no interfaz.
    await page.getByRole('button', { name: /^Casa/ }).first().click();
    await expect(page.getByText('Who has access')).toBeVisible();

    await page.getByRole('button', { name: 'Español' }).click();
    await expect(page.getByText('Quién puede entrar')).toBeVisible();
    await expect(page.getByText('Sin guardar')).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).click();
    await page.getByText('Nombre y descripción del esquema').click();
    await expect(page.getByLabel('Nombre del esquema')).toHaveValue('Prueba de idioma');
    expect(await page.locator('html').getAttribute('lang')).toBe('es');

    await page.reload();
    await expect(page.getByText('Seguridad').first()).toBeVisible();
  });
});

test('con el navegador en español arranca en español; EN cambia la interfaz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Security').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simulate' })).toBeVisible();
});
