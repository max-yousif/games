import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

const JUIST: Record<string, string> = { '2^5': '32', sqrt: 'Waar', '3+4': '7' };

/** Beantwoordt de huidige vraag, juist of fout. */
async function beantwoord(p: Page, juist: boolean) {
  await expect(p.locator('main .katex').first()).toBeVisible();
  const vraag = (await p.locator('main').textContent()) ?? '';
  const antwoord = Object.entries(JUIST).find(([deel]) => vraag.includes(deel))![1];
  if (await p.getByLabel('Je antwoord').count()) {
    await p.getByLabel('Je antwoord').fill(juist ? antwoord : '999');
    await p.getByRole('button', { name: 'Versturen' }).click();
  } else if (juist) await p.getByRole('button', { name: antwoord, exact: true }).click();
  else await p.getByRole('button', { name: antwoord === 'Waar' ? 'Onwaar' : '16', exact: true }).click();
}

test('puzzel: foto kiezen, stukjes verdienen, leggen, verkeerd en juist, einde met de foto', async ({ page }) => {
  test.setTimeout(120_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '4B', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/escape-set.json');
  await expect(page.getByText('Ontsnap uit het wiskundelokaal')).toBeVisible();
  await kiesSpel(page, 'Ontsnap uit het wiskundelokaal (test)', 'Puzzel');

  // Zonder foto kan het niet; de foto blijft bij de vragenset.
  await expect(page.getByRole('button', { name: /Start het spel/ })).toBeDisabled();
  await page.getByLabel('Foto voor de puzzel').setInputFiles('tests/e2e/fixtures/puzzel.png');
  await expect(page.locator('[data-puzzelfoto]')).toBeVisible();
  await page.getByLabel('Aantal stukjes').selectOption('9');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start de puzzel/ }).click();

  // Fout: het juiste antwoord zien, dan verder.
  await beantwoord(anna, false);
  await anna.getByRole('button', { name: 'Volgende vraag ▶' }).click();

  // Negen juiste antwoorden = negen stukjes.
  for (let i = 1; i <= 9; i++) {
    await beantwoord(anna, true);
    await expect(anna.locator('[data-stuk]')).toHaveCount(i);
  }
  await expect(anna.getByText('Je hebt alle stukjes! Leg de puzzel af.')).toBeVisible();
  await expect(page.locator('[data-voortgang]', { hasText: 'Anna' })).toContainText('9/9');

  // Twee stukjes verwisseld: nog niet af.
  await anna.locator('[data-stuk="0"]').dragTo(anna.locator('[data-plaats="1"]'));
  await anna.locator('[data-stuk="1"]').dragTo(anna.locator('[data-plaats="0"]'));
  for (let s = 2; s < 9; s++) await anna.locator(`[data-stuk="${s}"]`).dragTo(anna.locator(`[data-plaats="${s}"]`));
  await expect(anna.getByText('Sommige stukjes liggen nog verkeerd.')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });
  // Juist leggen: een gelegd stukje naar een andere plaats slepen wisselt ze.
  await anna.locator('[data-gelegd="0"]').dragTo(anna.locator('[data-plaats="0"]'));
  await expect(anna.getByText('De puzzel is af!')).toBeVisible();

  // Iedereen klaar: einde, met de foto op het bord.
  await expect(page.getByRole('img', { name: 'De puzzel' })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'Anna' })).toContainText('9 / 9');
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-einde.png') });
  controleer();
});
