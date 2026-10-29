import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('cluedo met meerkeuzevragen: kaarten uit de uitleg, elke keuze streept stil een kaart weg', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '6A', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/cluedo-meerkeuze.json');
  await kiesSpel(page, 'Cluedo meerkeuze (test)', 'Cluedo');
  await page.getByText(/Verdachten, locaties en wapens voor dit spel/).click();
  await page.getByRole('button', { name: /Kaarten maken uit de vragenset \(3 vragen/ }).click();
  // Per soort een lege kaart voor de oplossing: naam (en eventueel een uitkomst als val) invullen.
  await page.getByLabel('Verdachten 2: naam').fill('Bob');
  await page.getByLabel('Verdachten 2: uitkomst').fill('-\\frac{\\pi}{4}');
  await page.getByLabel('Locaties 2: naam').fill('Tuin');
  await page.getByLabel('Wapens 2: naam').fill('Touw');
  await expect(page.getByText(/Geef elke kaart/)).toHaveCount(0);
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-editor.png'), fullPage: true });
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start/ }).click();

  await expect(anna.locator('[data-opgave]')).toHaveCount(3);
  // Geen uitkomsten op het blad (die zouden het antwoord verraden).
  await expect(anna.getByLabel('Detectiveblad').locator('.katex')).toHaveCount(0);
  const opgave = (tex: string) => anna.locator('[data-opgave]', { hasText: tex });
  // Fout antwoord dat de uitkomst van Bob is: Bob (de dader!) wordt weggestreept, zonder melding.
  await opgave('\\frac{1}{x}').getByRole('button').first().click();
  await anna.getByRole('button', { name: '$-\\frac{\\pi}{4}$', exact: true }).click();
  await expect(anna.locator('li[data-weg]', { hasText: 'Bob' })).toBeVisible();
  await expect(anna.getByText(/niet juist|fout/i)).toHaveCount(0);
  // Wijzigen naar het juiste antwoord: Bob komt terug, Ann verdwijnt.
  await opgave('\\frac{1}{x}').getByRole('button').first().click();
  await anna.getByRole('button', { name: '$\\ln|x|+C$', exact: true }).click();
  await expect(anna.locator('li[data-weg]', { hasText: 'Ann' })).toBeVisible();
  await expect(anna.locator('li[data-weg]', { hasText: 'Bob' })).toHaveCount(0);
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png'), fullPage: true });

  await anna.getByRole('button', { name: '🔎 Beschuldig!' }).click();
  await anna.getByLabel('Dader').selectOption('Bob');
  await anna.getByLabel('Plaats').selectOption('Tuin');
  await anna.getByLabel('Wapen').selectOption('Touw');
  await anna.getByRole('button', { name: 'Beschuldig!', exact: true }).click();
  await expect(anna.getByText('Opgelost!')).toBeVisible();
  controleer();
});
