import { expect, test, type Page } from '@playwright/test';
import { geenFouten, maakKlas } from './helpers';

const SET = 'Algebra: merkwaardige producten en ontbinden (3e jaar (5 u))';

async function kies(page: Page, spel: string, klas: string | null) {
  await page.goto('#/');
  await page.goto('#/spelen');
  await page.getByRole('button', { name: spel, exact: true }).click();
  if (klas) await page.locator('[data-klas]', { hasText: klas }).click();
  else await page.getByRole('button', { name: 'Zonder klas', exact: true }).click();
  await page.getByRole('button', { name: 'Alle jaren' }).click();
  await page.getByRole('button', { name: SET, exact: true }).click();
  await expect(page.getByRole('button', { name: /Start het spel/ })).toBeVisible();
}

const teams = (page: Page) => page.locator('label:text-is("Aantal teams") + select');
const timer = (page: Page) => page.locator('label:text-is("Timer per vraag") + select');

test('instellingen onthouden per spel en klas', async ({ page }) => {
  const controleer = geenFouten(page);
  await maakKlas(page, '4A', ['Peeters Anna', 'Claes Bert', 'Janssens Chloé', 'Mertens Dries']);
  await maakKlas(page, '5B', ['Wouters Emma', 'Maes Finn', 'Jacobs Gust']);

  await kies(page, 'Quizbord', '4A');
  await expect(teams(page)).toHaveValue('2');
  await teams(page).selectOption('4');
  await timer(page).selectOption('60');
  await page.getByRole('button', { name: /Start het spel/ }).click();
  await expect(page.getByRole('button', { name: /Stoppen/ })).toBeVisible();

  await kies(page, 'Quizbord', '5B');
  // Nog niets voor 5B: de laatste instellingen van het quizbord.
  await expect(teams(page)).toHaveValue('4');
  await teams(page).selectOption('3');
  await timer(page).selectOption('');
  await page.getByRole('button', { name: /Start het spel/ }).click();
  await expect(page.getByRole('button', { name: /Stoppen/ })).toBeVisible();

  await kies(page, 'Quizbord', '4A');
  await expect(teams(page)).toHaveValue('4');
  await expect(timer(page)).toHaveValue('60');
  // Ook de leerlingen zijn meteen over 4 teams verdeeld.
  await expect(page.getByRole('textbox', { name: 'Teamnaam' })).toHaveCount(4);

  await kies(page, 'Quizbord', '5B');
  await expect(teams(page)).toHaveValue('3');
  await expect(timer(page)).toHaveValue('');

  // Na herladen nog altijd onthouden; een ander spel heeft zijn eigen instellingen.
  await page.reload();
  await kies(page, 'Bom doorgeven', '4A');
  await expect(teams(page)).toHaveValue('2');
  controleer();
});
