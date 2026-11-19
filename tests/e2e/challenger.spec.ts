import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

const JUIST: Record<string, [string, string]> = { '2^5': ['32', '16'], sqrt: ['Waar', 'Onwaar'], '3+4': ['7', '999'] };

/** Beantwoordt de vraag op het scherm, juist of fout. */
async function antwoord(p: Page, juist: boolean) {
  await expect(p.locator('main .katex').first()).toBeVisible();
  const vraag = (await p.locator('main').textContent()) ?? '';
  const [goed, fout] = Object.entries(JUIST).find(([deel]) => vraag.includes(deel))![1];
  const tekst = juist ? goed : fout;
  if (await p.getByLabel('Je antwoord').count()) {
    await p.getByLabel('Je antwoord').fill(tekst);
    await p.getByRole('button', { name: 'Versturen' }).click();
  } else await p.getByRole('button', { name: tekst, exact: true }).click();
}

test('challenger: GET OUT, hart kwijt, comeback, hulplijnen en einde', async ({ page }) => {
  test.setTimeout(120_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '4B', ['Peeters Anna', 'Claes Bert', 'Wouters Cas']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/escape-set.json');
  await expect(page.getByText('Ontsnap uit het wiskundelokaal')).toBeVisible();
  await kiesSpel(page, 'Ontsnap uit het wiskundelokaal (test)', 'Challenger');
  await page.getByLabel('Harten').selectOption('2');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  const cas = await leerling(page, code, 'Cas');
  await page.getByRole('button', { name: /Start Challenger/ }).click();

  // Anna wordt de challenger.
  await page.locator('[data-kandidaat]', { hasText: 'Anna' }).click();
  await expect(page.getByText('Anna neemt het op tegen de klas!')).toBeVisible();
  await page.getByRole('button', { name: '▶ Eerste vraag' }).click();

  // Vraag 1: Bert juist, Cas fout, Anna (met "Wat denkt de klas?") juist: GET OUT, Cas!
  await expect(anna.getByText('De klas antwoordt eerst')).toBeVisible();
  await antwoord(bert, true);
  await antwoord(cas, false);
  await expect(page.getByText(/Anna, antwoord op je laptop/)).toBeVisible();
  await page.getByRole('button', { name: /Wat denkt de klas\?/ }).click();
  await expect(page.locator('[data-peiling]')).toContainText('50 %');
  await expect(anna.getByText('Wat denkt de klas?')).toBeVisible();
  await antwoord(anna, true);
  await expect(page.locator('[data-uitslag]')).toContainText('GET OUT, Cas!', { timeout: 10_000 });
  await expect(cas.locator('[data-uitroep]')).toContainText('GET OUT!');
  await expect(cas.locator('[data-uitroep]')).toContainText('Cas');
  await expect(cas.locator('[data-rol]')).toContainText('Comeback Zone');
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });
  if (process.env.SCHERMAFDRUK) await cas.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-getout.png') });
  // De hulplijn is op.
  await expect(page.getByRole('button', { name: /Wat denkt de klas\?/ })).toBeDisabled();

  // Vraag 2: Bert en Cas juist, Anna fout: een hart minder.
  await page.getByRole('button', { name: 'Volgende vraag ▶' }).click();
  await antwoord(bert, true);
  await antwoord(cas, true);
  await expect(page.getByText(/Anna, antwoord op je laptop/)).toBeVisible();
  await antwoord(anna, false);
  await expect(page.locator('[data-uitslag]')).toContainText('verliest een hart', { timeout: 10_000 });
  await expect(anna.locator('[data-resultaat]')).toBeVisible();

  // Vraag 3: Cas weer juist (2 na elkaar): COMEBACK. Anna met tweede kans, twee keer fout: harten op, de klas wint.
  await page.getByRole('button', { name: 'Volgende vraag ▶' }).click();
  await antwoord(bert, true);
  await antwoord(cas, true);
  await expect(page.getByText(/Anna, antwoord op je laptop/)).toBeVisible();
  await page.getByRole('button', { name: /Tweede kans/ }).click();
  await expect(anna.getByText('Laatste antwoord').or(anna.locator('main .katex').first())).toBeVisible();
  await antwoord(anna, false);
  await expect(anna.getByText('Je tweede kans!')).toBeVisible({ timeout: 10_000 });
  await antwoord(anna, false);
  await expect(page.locator('[data-uitslag]')).toContainText('COMEBACK voor Cas!', { timeout: 10_000 });
  await expect(page.locator('[data-uitslag]')).toContainText('De klas wint!');
  await expect(cas.locator('[data-uitroep]')).toContainText('COMEBACK!');

  // Tussenstand en einde.
  await page.getByRole('button', { name: 'Tussenstand ▶' }).click();
  await expect(page.getByRole('heading', { name: 'Tussenstand' })).toBeVisible();
  await page.getByRole('button', { name: '🏁 Spel beëindigen' }).click();
  await expect(page.locator('[data-weetjes]')).toContainText('Meeste GET OUTs in één beurt');
  await expect(bert.getByText(/Plaats 1/)).toBeVisible();
  controleer();
});
