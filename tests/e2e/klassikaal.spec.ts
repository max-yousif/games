import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, maakKlas } from './helpers';

test('quizbord: klas, meerkeuze juist, open vraag fout, eindstand en Excel', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '3A', ['Peeters Anna', 'Claes Bert', 'Janssens Chloé', 'Mertens Dries']);
  await kiesSpel(page, 'Algebra: merkwaardige producten en ontbinden (3e jaar (5 u))', 'Quizbord');
  await page.getByRole('button', { name: /Start het spel/ }).click();

  // Merkwaardige producten 100: meerkeuze, juiste antwoord B.
  await page.getByRole('button', { name: '100', exact: true }).first().click();
  // De vraag verschijnt pas wanneer gekozen is wie antwoordt.
  await expect(page.getByRole('heading', { name: 'Wie beantwoordt deze vraag?' })).toBeVisible();
  await expect(page.getByText('Werk uit')).toHaveCount(0);
  // Teams zijn willekeurig: kies de eerste leerling van het team dat aan de beurt is (alleen: dubbele punten).
  await page.locator('aside button').filter({ hasNotText: /Hele team|Willekeurig/ }).first().click();
  await expect(page.getByText(/alleen, zonder overleggen: ×2/)).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.getByText('Enter = juist')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('span.font-mono', { hasText: /^200\s*punten$/ }).first()).toBeVisible();

  // Merkwaardige producten 200: open vraag, fout.
  await page.getByRole('button', { name: '200', exact: true }).first().click();
  // Willekeurig: de naam verschijnt even groot, daarna de vraag.
  await page.keyboard.press('w');
  await expect(page.getByText('🎲 Deze vraag is voor')).toBeVisible();
  await expect(page.getByText('🎲 Deze vraag is voor')).toBeHidden();
  await page.keyboard.press(' ');
  await page.keyboard.press('f');

  await page.getByRole('button', { name: /Stoppen/ }).click();
  await expect(page.getByText(/wint!|Gelijkspel/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Resultaten exporteren/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);

  // Resultaten bewaren: ze staan bij Resultaten en het spel telt mee.
  await page.getByRole('button', { name: '💾 Resultaten bewaren' }).click();
  await expect(page.getByRole('heading', { name: 'Klasspelen' })).toBeVisible();

  // Resultaten per leerling over alle spellen: wie de meerkeuzevraag juist had, staat er met 100%.
  await page.goto('#/resultaten');
  await page.getByRole('tab', { name: 'Per leerling' }).click();
  await expect(page.getByRole('heading', { name: '3A' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '100%' }).first()).toBeVisible();

  // De vragenset telt het spel en de 4 spelers.
  await page.goto('#/sets');
  await expect(page.locator('[data-set]', { hasText: 'Algebra: merkwaardige producten' }).getByText('▶ 1× gespeeld · 4 spelers')).toBeVisible();
  controleer();
});
