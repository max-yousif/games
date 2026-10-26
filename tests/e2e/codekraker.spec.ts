import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** Beantwoordt een vraag juist, opent een kistje en gaat door (hackkans overslaan). */
async function ronde(p: Page) {
  await p.getByLabel('Je antwoord').fill('7');
  await p.getByRole('button', { name: 'Versturen' }).click();
  await expect(p.getByText('✅ Juist! Kies een kistje')).toBeVisible();
  await p.getByRole('button', { name: 'Kistje 2' }).click();
  const verder = p.getByRole('button', { name: /Volgende vraag ▶|Niet hacken, volgende vraag/ });
  await expect(verder).toBeVisible();
  await verder.click();
  await expect(p.getByLabel('Je antwoord')).toBeVisible();
}

test('codekraker: wachtwoord, vragen, kistjes, ranglijst en einde', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '5A', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await kiesSpel(page, 'Codekraker test (test)', 'Crypto Hack');
  await page.locator('label:text-is("Wachten na fout antwoord") + select').selectOption('0');
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  // Reacties in de wachtruimte verschijnen ook hier op het bord, en kunnen uit.
  await anna.getByRole('button', { name: 'geit' }).click();
  await expect(page.locator('.reactie-zweef', { hasText: '🐐' })).toBeVisible();
  await expect(page.getByRole('button', { name: '😀 Reacties aan' })).toBeVisible();
  await page.getByRole('button', { name: /Start Crypto Hack/ }).click();

  // Eerst een geheim wachtwoord kiezen.
  // Elke leerling kiest uit 3 eigen woorden.
  await expect(anna.locator('[data-wachtwoord]')).toHaveCount(3);
  await anna.locator('[data-wachtwoord]').first().click();
  await bert.locator('[data-wachtwoord]').last().click();
  await expect(anna.getByTitle('Je geheime wachtwoord')).toBeVisible();

  // Fout antwoord: geen kistje, volgende vraag.
  await anna.getByLabel('Je antwoord').fill('8');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByLabel('Je antwoord')).toBeVisible();

  for (let i = 0; i < 3; i++) await ronde(anna);
  await ronde(bert);

  // Het bord toont beide leerlingen met hun munten en aantal juist.
  await expect(page.locator('li', { hasText: 'Anna' }).getByText('3 ✓')).toBeVisible();
  await expect(page.locator('li', { hasText: 'Bert' }).getByText('1 ✓')).toBeVisible();

  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText(/Meeste juiste antwoorden: Anna/)).toBeVisible();
  await expect(anna.getByText('Het spel is gedaan!')).toBeVisible();
  await page.getByRole('button', { name: '✓ Afsluiten' }).click();
  controleer();
});
