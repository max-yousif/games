import { expect, type Page } from '@playwright/test';

/** Maakt een klas aan met de gegeven namen. */
export async function maakKlas(page: Page, naam: string, leerlingen: string[]) {
  await page.goto('#/klassen');
  await page.getByRole('button', { name: '+ Nieuwe klas' }).click();
  await page.getByLabel('Naam van de klas').fill(naam);
  await page.getByPlaceholder(/Peeters Anna/).fill(leerlingen.join('\n'));
  await page.getByRole('button', { name: `✓ ${leerlingen.length} leerlingen toevoegen` }).click();
  await expect(page.getByRole('heading', { name: `Leerlingen (${leerlingen.length})` })).toBeVisible();
  // Terug naar het overzicht: de klas staat er met het aantal leerlingen.
  await page.getByRole('button', { name: '← Alle klassen' }).click();
  await expect(page.getByRole('button', { name: `${naam} ${leerlingen.length}` })).toBeVisible();
}

/** Kiest een speltype op de pagina Spelen (met de eerste klas) en zet de demo-modus aan voor live spellen. */
export async function kiesSpel(page: Page, set: string, spel: string) {
  await page.goto('#/spelen');
  // Stap 1 spel, stap 2 klas (de eerste klas, of zonder klas), stap 3 vragenset.
  await page.getByRole('button', { name: spel, exact: true }).click();
  const klas = page.locator('[data-klas]').first();
  if (await klas.count()) await klas.click();
  else await page.getByRole('button', { name: 'Zonder klas', exact: true }).click();
  // Alle jaren tonen: de klas in de test hoort niet altijd bij het jaar van de set.
  await page.getByRole('button', { name: 'Alle jaren' }).click();
  await page.getByRole('button', { name: set, exact: true }).click();
  await expect(page.getByRole('button', { name: /Start het spel/ })).toBeVisible();
}

/** Start het spel en geeft de deelnamecode terug (live spellen). */
export async function startLive(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Start het spel/ }).click();
  await expect(page.getByText('en geef deze code in:')).toBeVisible();
  return (await page.locator('.tracking-\\[0\\.2em\\]').textContent())!.trim();
}

/** Opent een leerlingenscherm in een nieuw tabblad en meldt aan met een naam uit de lijst. */
export async function leerling(page: Page, code: string, naam: string): Promise<Page> {
  const p = await page.context().newPage();
  await p.goto(`#/live?code=${code}&demo=1`);
  await p.getByRole('button', { name: naam, exact: true }).click();
  await expect(p.getByText(`Hallo ${naam}!`)).toBeVisible();
  return p;
}

/** Faalt de test bij een JavaScript-fout op de pagina. */
export function geenFouten(page: Page) {
  const fouten: string[] = [];
  page.on('pageerror', (e) => fouten.push(e.message));
  return () => expect(fouten).toEqual([]);
}
