import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('live quiz: bijnaam, antwoorden, verlaten en terugkeren, nieuw spel', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '3A', ['Anna Peeters', 'Bert Claes', 'Chloé Janssens']);
  await kiesSpel(page, 'Algebra: merkwaardige producten en ontbinden (3e jaar (5 u))', 'Live quiz');
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna Peeters');
  await anna.getByLabel('Bijnaam').fill('Pi');
  await anna.getByRole('button', { name: 'Opslaan' }).click();
  await expect(anna.getByText('Op het bord:')).toContainText('Pi');
  await expect(page.getByText('Pi', { exact: true })).toBeVisible();

  const bert = await leerling(page, code, 'Bert Claes');
  bert.on('dialog', (d) => void d.accept());
  // De naam van een klasgenoot mag geen bijnaam zijn.
  await bert.getByLabel('Bijnaam').fill('Anna Peeters');
  await bert.getByRole('button', { name: 'Opslaan' }).click();
  await expect(bert.getByText(/Die bijnaam kan niet/)).toBeVisible();

  await page.getByRole('button', { name: /Start de quiz \(2 spelers\)/ }).click();
  await anna.getByRole('button', { name: /^B/ }).click();
  await expect(anna.getByText('Antwoord verstuurd!')).toBeVisible();

  // Reageren terwijl ze wacht: de emoji zweeft over het bord, met haar bijnaam.
  await anna.getByRole('button', { name: 'geit' }).click();
  await expect(page.locator('.reactie-zweef', { hasText: '🐐' })).toBeVisible();
  await expect(page.locator('.reactie-zweef', { hasText: 'Pi' })).toBeVisible();

  // Bert verlaat het spel en keert terug met dezelfde naam.
  await bert.getByRole('button', { name: 'Verlaten' }).click();
  await expect(bert.getByText(/Je hebt het spel verlaten/)).toBeVisible();
  await bert.getByRole('button', { name: 'Bert Claes', exact: true }).click();
  await expect(bert.getByText('Vraag 1 / 16')).toBeVisible();
  await bert.getByRole('button', { name: /^A/ }).click();

  // Iedereen geantwoord: het antwoord verschijnt vanzelf, met de bijnaam in de tussenstand.
  await expect(page.getByText('Tussenstand')).toBeVisible();
  await expect(page.locator('ol').getByText('Pi')).toBeVisible();
  await expect(anna.getByText(/Juist! \+\d+/)).toBeVisible();
  await expect(bert.getByText('Helaas, fout')).toBeVisible();

  // Vraag 2 (open): Bert antwoordt met de wiskunde-editor.
  await page.getByRole('button', { name: /Volgende vraag/ }).click();
  await expect(bert.getByText('Vraag 2 / 16')).toBeVisible();
  await bert.getByRole('button', { name: /Wiskunde-editor uit/ }).click();
  const veld = bert.locator('math-field');
  await expect(veld).toBeVisible();
  await veld.click();
  await bert.keyboard.type('4a');
  await bert.getByRole('button', { name: 'x²' }).click();
  await veld.click();
  await bert.keyboard.press('End');
  await bert.keyboard.type('-20a+25');
  await bert.keyboard.press('Enter');
  await expect(bert.getByText('Antwoord verstuurd!')).toBeVisible();
  await anna.getByLabel('Je antwoord').fill('16a^2');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(bert.getByText(/Juist! \+\d+/)).toBeVisible();
  await expect(anna.getByText('Helaas, fout')).toBeVisible();

  await page.getByRole('button', { name: /Nu stoppen/ }).click();
  await expect(page.getByRole('button', { name: /Afsluiten en gegevens/ })).toBeVisible();
  await expect(anna.getByText(/Je eindigde op plaats/)).toBeVisible();
  await anna.getByRole('button', { name: 'Nieuw spel meespelen' }).click();
  await expect(anna.getByLabel('Code')).toBeVisible();
  controleer();
});
