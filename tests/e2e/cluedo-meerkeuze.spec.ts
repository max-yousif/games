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
  await page.getByRole('button', { name: /Namen uit de vragenset/ }).click();
  await expect(page.getByLabel('Elke kaart krijgt een eigen vraag', { exact: false })).toBeChecked();
  // Alle kaarten ingeven en per soort de oplossing aanduiden; de andere kaarten krijgen een vraag.
  for (const [soort, titel, naam] of [['verdachte', 'Verdachten', 'Bob'], ['locatie', 'Locaties', 'Tuin'], ['wapen', 'Wapens', 'Touw']]) {
    await page.getByRole('button', { name: `+ ${soort}`, exact: true }).click();
    await page.getByLabel(`${titel} 2: naam`).fill(naam);
  }
  for (const naam of ['Bob', 'Tuin', 'Touw']) await page.getByLabel(`${naam} is de oplossing`).check();
  await expect(page.getByText(/Geef elke kaart|vragen nodig/)).toHaveCount(0);
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-editor.png'), fullPage: true });
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start/ }).click();

  await expect(anna.locator('[data-opgave]')).toHaveCount(3);
  // Geen uitkomsten op het blad (die zouden het antwoord verraden).
  await expect(anna.getByLabel('Detectiveblad').locator('.katex')).toHaveCount(0);
  const opgave = (tex: string) => anna.locator('[data-opgave]', { hasText: tex });
  // Fout antwoord: stil een andere kaart weg (geen melding).
  await opgave('\\frac{1}{x}').getByRole('button').first().click();
  await anna.getByRole('button', { name: '$x+C$', exact: true }).click();
  await expect(anna.locator('li[data-weg]')).toHaveCount(1);
  await expect(anna.locator('li[data-weg]', { hasText: 'Ann' })).toHaveCount(0);
  await expect(anna.getByText(/niet juist|fout/i)).toHaveCount(0);
  // Nooit de oplossing.
  for (const naam of ['Bob', 'Tuin', 'Touw']) await expect(anna.locator('li[data-weg]', { hasText: naam })).toHaveCount(0);
  // Wijzigen naar het juiste antwoord: Ann verdwijnt, de andere kaart komt terug.
  await opgave('\\frac{1}{x}').getByRole('button').first().click();
  await anna.getByRole('button', { name: '$\\ln|x|+C$', exact: true }).click();
  await expect(anna.locator('li[data-weg]', { hasText: 'Ann' })).toBeVisible();
  await expect(anna.locator('li[data-weg]')).toHaveCount(1);
  // Het blad bedekken: de namen enkel zichtbaar als je erop wijst.
  await anna.getByRole('button', { name: '🙈 Bedekken' }).click();
  await expect(anna.getByLabel('Detectiveblad')).toHaveAttribute('data-bedekt', 'true');
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png'), fullPage: true });

  await anna.getByRole('button', { name: '🔎 Beschuldig!' }).click();
  await anna.getByLabel('Dader').selectOption('Bob');
  await anna.getByLabel('Plaats').selectOption('Tuin');
  await anna.getByLabel('Wapen').selectOption('Touw');
  await anna.getByRole('button', { name: 'Beschuldig!', exact: true }).click();
  await expect(anna.getByText('Opgelost!')).toBeVisible();
  controleer();
});
