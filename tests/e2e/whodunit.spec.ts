import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('whodunit: oefening geeft een roddel, foute en juiste tabel', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '6A', ['Peeters Anna', 'Claes Bert']);
  await kiesSpel(page, 'Whodunit: de nacht van de 50 dagen (5e–6e jaar)', 'Whodunit');
  await page.locator('div', { has: page.locator('label', { hasText: 'Wachten na fout antwoord' }) }).locator('select').last().selectOption('0');
  // Per 2 op één laptop: Anna en Bert vormen één groepje.
  await page.locator('label:text-is("Werken") + select').selectOption('2');
  await expect(page.getByLabel('Teamnaam')).toHaveValue('Groepje 1');
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna & Bert');
  await page.getByRole('button', { name: /Start de whodunit/ }).click();
  await expect(anna.getByText('50 dagen om nooit te vergeten!')).toBeVisible();

  // Oefening 1 juist: roddel 1 verschijnt.
  await anna.getByRole('button', { name: /^✏️ Oefening 1 / }).click();
  await anna.getByLabel('Je antwoord').fill('y = π/2');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText('De bierdrinker hing heel de avond aan de paal.')).toBeVisible();
  await expect(anna.getByText('1 / 12')).toBeVisible();

  // Tabel: eerst fout (Fien en Lars omgewisseld), daarna juist.
  const oplossing = [
    ['Naam', ['Fien', 'Lars', 'Mats', 'Noor']],
    ['Drankje', ['Cava', 'Bier', 'Cocktails', 'Wijn']],
    ['Outfit', ['Dierenonesie', 'Overall', 'Bontjas', 'Geruit hemd']],
    ['Stunt', ['Gevochten met de turnleraar', 'Gepaaldanst met de leraar Frans', 'Midnightsnack met de directeur', 'In slaap gevallen in de lerarenkamer']],
  ] as const;
  const kolommen = ['1e', '2e', '3e', '4e'];
  for (const [rij, waarden] of oplossing) for (const [k, w] of waarden.entries()) await anna.getByLabel(`${rij} ${kolommen[k]}`).selectOption(w);
  await anna.getByLabel('Naam 1e').selectOption('Lars');
  await anna.getByLabel('Naam 2e').selectOption('Fien');
  await anna.getByRole('button', { name: 'Controleer mijn oplossing' }).click();
  await expect(anna.getByText(/Je vorige oplossing klopte niet/)).toBeVisible();
  await anna.getByLabel('Naam 1e').selectOption('Fien');
  await anna.getByLabel('Naam 2e').selectOption('Lars');
  await anna.getByRole('button', { name: 'Controleer mijn oplossing' }).click();
  await expect(anna.getByText('Raadsel opgelost!')).toBeVisible();

  await expect(page.getByText('🕵️ 1 / 1 opgelost')).toBeVisible();
  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText('Iedereen loste het raadsel op!')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'De oplossing' })).toBeVisible();
  await expect(anna.getByText(/Opgelost in/)).toBeVisible();

  // Afsluiten zonder opslaan: de resultaten worden niet bewaard.
  await page.getByRole('button', { name: 'Afsluiten zonder opslaan' }).click();
  await expect(page.getByRole('heading', { name: 'Klasspelen' })).toBeVisible();
  await page.goto('#/resultaten');
  await expect(page.getByText('Nog geen gespeelde spellen.')).toBeVisible();
  // Zonder opslaan telt ook niet mee in de statistiek van de vragenset.
  await page.goto('#/sets');
  await expect(page.locator('div.flex-col', { hasText: 'Whodunit: de nacht van de 50 dagen' }).getByText('▶ nog niet gespeeld')).toBeVisible();
  controleer();
});
