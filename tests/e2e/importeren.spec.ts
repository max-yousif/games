import { expect, test } from '@playwright/test';
import { geenFouten } from './helpers';

test('vragen importeren: snelformaat en geplakte tabel, dark mode', async ({ page }) => {
  const controleer = geenFouten(page);
  await page.goto('#/sets');
  await page.getByRole('link', { name: /Vragen importeren/ }).first().click();

  // Snelformaat: voorbeeld met elk soort vraag; één vraag uitvinken.
  await page.getByRole('button', { name: 'Voorbeeld invullen' }).click();
  await expect(page.getByText('6 geselecteerd')).toBeVisible();
  await page.getByLabel('Vraag 2 importeren').uncheck();
  await page.getByLabel('Titel').fill('Mijn import');
  await page.getByRole('button', { name: '✓ 5 vragen importeren' }).click();
  await expect(page.locator('input[value="Mijn import"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mijn import' })).toBeVisible();

  // Geplakte cellen uit Excel (tabs), toevoegen aan dezelfde set.
  await page.getByRole('link', { name: /Vragen importeren/ }).click();
  await page.getByLabel('Vragen', { exact: true }).fill('Hoeveel is 2+2?\t4\t3\t5\nHoofdstad van België?\tBrussel');
  await expect(page.getByText('Welke kolom is wat?')).toBeVisible();
  await expect(page.getByText('2 geselecteerd')).toBeVisible();
  await page.getByRole('button', { name: '✓ 2 vragen importeren' }).click();
  await page.goto('#/sets');
  await expect(page.getByText('7 vragen')).toBeVisible();

  // Dark mode: één klik op de themaknop (systeem → donker).
  await page.getByRole('button', { name: /Thema:/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  controleer();
});
