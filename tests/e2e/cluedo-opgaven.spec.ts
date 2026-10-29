import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('cluedo met opgaven per kaart: een gelijkwaardige uitkomst streept die kaart weg', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '6A', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/cluedo-integralen.json');
  await kiesSpel(page, 'Integralen Cluedo (test)', 'Cluedo');
  // De editor toont per kaart de opgave en de uitkomst; kaarten zonder opgave zijn de oplossing.
  await expect(page.getByLabel('Met een eigen opgave per kaart', { exact: false })).toBeChecked();
  await expect(page.getByText('geen opgave: de oplossing')).toHaveCount(3);
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-editor.png'), fullPage: true });
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start/ }).click();

  // Drie opgaven (de oplossing heeft er geen); het blad toont alle uitkomsten.
  await expect(anna.locator('[data-opgave]')).toHaveCount(3);
  await expect(anna.getByText('Opgaven (0 / 3)')).toBeVisible();
  // De LaTeX-bron staat mee in de tekst van de formule (KaTeX).
  const opgave = (tex: string) => anna.locator('[data-opgave]', { hasText: tex });

  // Fout: geen kaart weg.
  await opgave('x\\ln x').getByRole('button').first().click();
  await anna.getByLabel('Je antwoord').fill('ln(x)');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText('✗ niet juist')).toBeVisible();
  // Juist, in een andere schrijfwijze dan de leerkracht: Ann is niet de dader.
  await anna.getByLabel('Je antwoord').fill('ln(ln(x))');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText('Opgaven (1 / 3)')).toBeVisible();
  await expect(anna.locator('li[data-weg]', { hasText: 'Ann' })).toBeVisible();
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png'), fullPage: true });

  // Beschuldigen: de kaarten zonder opgave.
  await anna.getByRole('button', { name: '🔎 Beschuldig!' }).click();
  await anna.getByLabel('Dader').selectOption('Bob');
  await anna.getByLabel('Plaats').selectOption('Keuken');
  await anna.getByLabel('Wapen').selectOption('Touw');
  await anna.getByRole('button', { name: 'Beschuldig!', exact: true }).click();
  await expect(anna.getByText('Opgelost!')).toBeVisible();
  controleer();
});
