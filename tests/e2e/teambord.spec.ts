import { expect, test, type Page } from '@playwright/test';
import { bevestig, geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** De laptops per team (het team staat op de laptop zodra het spel loopt). */
async function perTeam(laptops: Page[]): Promise<Record<string, Page[]>> {
  const uit: Record<string, Page[]> = {};
  for (const p of laptops) {
    const team = (await p.locator('[data-mijn-team]').textContent())!.trim();
    (uit[team] ??= []).push(p);
  }
  return uit;
}

async function antwoord(p: Page, tekst: string) {
  await p.getByLabel('Je antwoord').fill(tekst);
  await p.getByLabel('Je antwoord').press('Enter');
}

async function openSet(page: Page, spel: string) {
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/teambord-set.json');
  await expect(page.getByText('Teams op de laptops')).toBeVisible();
  await kiesSpel(page, 'Teams op de laptops (test)', spel);
  await page.getByRole('button', { name: '💻 Op de laptops' }).click();
}

test('quizbord op de laptops: vak kiezen, meerderheid van het team, andere teams oefenen mee', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  // Vier namen: de naamvolgorde zelf aanduiden (raden lukt niet altijd).
  await page.goto('#/klassen');
  await page.getByRole('button', { name: '+ Nieuwe klas' }).click();
  await page.getByLabel('Naam van de klas').fill('5A');
  await page.getByPlaceholder(/Peeters Anna/).fill('Peeters Anna\nClaes Bert\nWouters Cas\nJanssens Chloé');
  await page.getByRole('radio', { name: 'Achternaam Voornaam' }).check();
  await page.getByRole('button', { name: '✓ 4 leerlingen toevoegen' }).click();
  await expect(page.getByRole('heading', { name: 'Leerlingen (4)' })).toBeVisible();
  await openSet(page, 'Quizbord');
  const code = await startLive(page);
  const laptops = [await leerling(page, code, 'Anna'), await leerling(page, code, 'Bert'), await leerling(page, code, 'Cas'), await leerling(page, code, 'Chloé')];
  await page.getByRole('button', { name: /Start \(4 spelers\)/ }).click();
  for (const p of laptops) await expect(p.locator('[data-mijn-team]')).toBeVisible();
  const teams = await perTeam(laptops);
  const blauw = teams['Team Blauw'];
  const rood = teams['Team Rood'];
  expect(blauw).toHaveLength(2);
  expect(rood).toHaveLength(2);

  // Eén laptop van Team Blauw kiest het vak, de andere wacht.
  await expect(page.locator('[data-kiezer]')).toContainText('kiest een vak');
  const kiezer = (await blauw[0].getByText('Jij kiest een vak').count()) ? blauw[0] : blauw[1];
  const ander = kiezer === blauw[0] ? blauw[1] : blauw[0];
  await expect(ander.getByText('kiest een vak…')).toBeVisible();
  await kiezer.locator('[data-vak="t1"]').click();

  // Iedereen krijgt de vraag; Team Rood oefent mee (fout, telt niet).
  await expect(page.locator('[data-vraagpaneel]')).toContainText('Vraag 1');
  await expect(rood[0].locator('[data-beurt]')).toContainText('Team Blauw is aan de beurt');
  await antwoord(rood[0], '5');
  await antwoord(blauw[0], '4');
  await expect(page.locator('[data-teller]')).toContainText('1/2');
  await antwoord(blauw[1], '4');
  await expect(page.locator('[data-uitslag]')).toContainText('Team Blauw: 2 van 2 juist ✓');
  await expect(blauw[0].locator('[data-team-uitslag]')).toContainText('2 van 2 juist');
  await expect(rood[0].getByText('Fout')).toBeVisible();
  await expect(rood[0].getByText('Juiste antwoord')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });

  // Team Rood: één fout antwoord is genoeg voor geen meerderheid meer.
  await page.getByRole('button', { name: 'Volgende ▶' }).click();
  const kiezerRood = (await rood[0].getByText('Jij kiest een vak').count()) ? rood[0] : rood[1];
  await expect(kiezerRood.getByText('Jij kiest een vak')).toBeVisible();
  // Het gespeelde vak is niet meer te kiezen.
  await expect(kiezerRood.locator('[data-vak="t1"]')).toBeDisabled();
  if (process.env.SCHERMAFDRUK) await kiezerRood.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-kiezen.png') });
  await kiezerRood.locator('[data-vak="t4"]').click();
  await antwoord(rood[0], '7');
  await expect(page.locator('[data-uitslag]')).toContainText('Team Rood: 0 van 2 juist ✗');
  await page.getByRole('button', { name: 'Volgende ▶' }).click();

  // Op het bord: Team Blauw heeft 100 punten. Stoppen: Team Blauw wint, ook op de laptops.
  await page.getByRole('button', { name: '⏹ Stoppen' }).click();
  await bevestig(page, /beëindigen/);
  await expect(page.getByRole('heading', { name: 'Team Blauw wint!' })).toBeVisible();
  await expect(blauw[0].getByText('🏆 Team Blauw wint!')).toBeVisible();
  await page.getByRole('button', { name: /Afsluiten \(niet bewaren\)/ }).click();
  controleer();
});

test('vier op een rij op de laptops: juist, dan kiest een teamlid de kolom', async ({ page }) => {
  test.setTimeout(60_000);
  const controleer = geenFouten(page);
  await maakKlas(page, '5B', ['Peeters Anna', 'Claes Bert']);
  await openSet(page, 'Vier op een rij');
  const code = await startLive(page);
  const laptops = [await leerling(page, code, 'Anna'), await leerling(page, code, 'Bert')];
  await page.getByRole('button', { name: /Start \(2 spelers\)/ }).click();
  for (const p of laptops) await expect(p.locator('[data-mijn-team]')).toBeVisible();
  const teams = await perTeam(laptops);
  const [blauw] = teams['Team Blauw'];
  const [rood] = teams['Team Rood'];

  await expect(blauw.locator('[data-beurt]')).toContainText('Jouw team is aan de beurt');
  await antwoord(blauw, '4');
  await expect(page.locator('[data-uitslag]')).toContainText('Team Blauw: 1 van 1 juist ✓');
  await page.getByRole('button', { name: 'Volgende ▶' }).click();
  await blauw.getByRole('button', { name: 'Kolom 4' }).click();
  // De schijf valt op het bord; daarna is Team Rood aan de beurt.
  await expect(page.locator('.disc-drop')).toBeVisible();
  await expect(rood.locator('[data-beurt]')).toContainText('Jouw team is aan de beurt');
  controleer();
});

test('bom op de laptops: het team met de bom antwoordt, juist geeft de bom door', async ({ page }) => {
  test.setTimeout(60_000);
  const controleer = geenFouten(page);
  await maakKlas(page, '5C', ['Peeters Anna', 'Claes Bert']);
  await openSet(page, 'Bom doorgeven');
  await page.getByText('Tijd tot de bom ontploft').locator('..').locator('select').selectOption('lang');
  const code = await startLive(page);
  const laptops = [await leerling(page, code, 'Anna'), await leerling(page, code, 'Bert')];
  await page.getByRole('button', { name: /Start \(2 spelers\)/ }).click();
  await page.getByRole('button', { name: /Steek de lont aan/ }).click();
  for (const p of laptops) await expect(p.locator('[data-mijn-team]')).toBeVisible();
  const teams = await perTeam(laptops);
  const [blauw] = teams['Team Blauw'];
  const [rood] = teams['Team Rood'];

  await expect(blauw.locator('[data-beurt]')).toContainText('Jouw team is aan de beurt');
  await antwoord(blauw, '4');
  await expect(page.getByText('✓ Juist! De bom gaat door…')).toBeVisible();
  // De bom ligt nu bij Team Rood, met een nieuwe vraag.
  await expect(rood.locator('[data-beurt]')).toContainText('Jouw team is aan de beurt');
  await expect(page.getByText('De bom ligt bij')).toBeVisible();
  controleer();
});
