import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** Beantwoordt een vraag juist en bekijkt welke kaart wegvalt. */
async function juist(p: Page) {
  await p.getByLabel('Je antwoord').fill('7');
  await p.getByRole('button', { name: 'Versturen' }).click();
  await expect(p.getByText(/is niet (de dader|de plaats|het wapen)!|Alle andere kaarten zijn al weg/)).toBeVisible();
  await p.getByRole('button', { name: 'Volgende vraag ▶' }).click();
}

test('cluedo: eigen thema, kaarten wegstrepen, beschuldigen, ranglijst en oplossing', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '5B', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await kiesSpel(page, 'Codekraker test (test)', 'Cluedo');
  await page.locator('label:text-is("Wachten na fout antwoord") + select').selectOption('0');

  // Een klein thema voor dit spel: 2 + 2 + 2 kaarten, dus 3 juiste antwoorden om alles weg te strepen.
  await page.getByText(/Verdachten, locaties en wapens voor dit spel/).click();
  await page.getByLabel('Titel van de zaak').fill('Diefstal in het labo');
  await page.getByLabel(/Verdachten \(/).fill('Ann\nBob');
  await page.getByLabel(/Locaties \(/).fill('Keuken\nTuin');
  await page.getByLabel(/Wapens \(/).fill('Mes\nTouw');
  await expect(page.getByText('3 juiste antwoorden nodig')).toBeVisible();
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  await page.getByRole('button', { name: /Start Cluedo/ }).click();
  await expect(anna.getByText('🔎 Diefstal in het labo')).toBeVisible();

  // Fout antwoord: niets weg.
  await anna.getByLabel('Je antwoord').fill('8');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByLabel('Je antwoord')).toBeVisible();
  await expect(anna.locator('[data-weg]')).toHaveCount(0);

  for (let i = 0; i < 3; i++) await juist(anna);
  await expect(anna.locator('[data-weg]')).toHaveCount(3);
  await juist(bert);

  // Het bord toont de voortgang, niet de oplossing.
  await expect(page.locator('li', { hasText: 'Anna' }).getByText('3 / 3 weg')).toBeVisible();
  await expect(page.locator('li', { hasText: 'Bert' }).getByText('1 / 3 weg')).toBeVisible();
  if (process.env.SCHERMAFDRUK) {
    await anna.setViewportSize({ width: 1366, height: 768 });
    await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });
    await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });
  }

  // Wat overblijft, is de oplossing: het formulier staat al op de overgebleven kaarten.
  await anna.getByRole('button', { name: '🔎 Beschuldig!' }).click();
  await anna.getByRole('button', { name: 'Beschuldig!', exact: true }).click();
  await expect(anna.getByText('Opgelost!')).toBeVisible();
  await expect(page.getByText(/Anna loste de moord op/)).toBeVisible();
  await expect(page.locator('li', { hasText: 'Anna' }).getByText(/^🎉 \d+:\d\d$/)).toBeVisible();

  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText('De oplossing', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('de dader')).toBeVisible();
  await expect(bert.getByText('Het spel is gedaan!')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK });
  await page.getByRole('button', { name: '✓ Afsluiten' }).click();
  controleer();
});
