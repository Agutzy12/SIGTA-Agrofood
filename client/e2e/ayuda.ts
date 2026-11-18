import { expect, type Page } from '@playwright/test';

/** Entra con el acceso rápido de un rol desde la pantalla de ingreso. */
export async function ingresarComo(page: Page, cargo: RegExp) {
  await page.goto('/ingresar');
  await page.getByRole('button', { name: cargo }).click();
  await expect(page.getByRole('heading', { name: 'Panel de producción' })).toBeVisible();
}

/** Cierra la sesión, entra con otro usuario por el acceso rápido y vuelve a la misma pantalla. */
export async function cambiarUsuario(page: Page, cargo: RegExp) {
  const pantalla = new URL(page.url()).pathname;
  await page.evaluate(() => localStorage.removeItem('sigta_token'));
  await ingresarComo(page, cargo);
  await page.goto(pantalla);
}
