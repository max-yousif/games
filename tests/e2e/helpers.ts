import { expect, type Page } from '@playwright/test';

/** Maakt een klas aan met de gegeven namen. */
export async function maakKlas(page: Page, naam: string, leerlingen: string[]) {
  await page.goto('#/klassen');
  await page.getByRole('button', { name: '+ Nieuwe klas' }).click();
  await page.locator('input[value^="Klas "]').fill(naam);
  await page.getByPlaceholder(/Anna Peeters/).fill(leerlingen.join('\n'));
  await page.getByRole('button', { name: 'Toevoegen', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(`${naam}\\s*${leerlingen.length}`) })).toBeVisible();
}

/** Kiest een speltype op de pagina Spelen (met de eerste klas) en zet de demo-modus aan voor live spellen. */
export async function kiesSpel(page: Page, set: string, spel: string) {
  await page.goto('#/spelen');
  await page.getByRole('combobox').first().selectOption({ label: set });
  await page.getByRole('button', { name: new RegExp(`^\\S*\\s*${spel}`) }).click();
  const demo = page.getByLabel(/Demo in deze browser/);
  if ((await demo.count()) && (await demo.isEnabled()) && !(await demo.isChecked())) await demo.check();
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
  await expect(p.getByText(`Hallo ${naam.split(' ')[0]}!`)).toBeVisible();
  return p;
}

/** Faalt de test bij een JavaScript-fout op de pagina. */
export function geenFouten(page: Page) {
  const fouten: string[] = [];
  page.on('pageerror', (e) => fouten.push(e.message));
  return () => expect(fouten).toEqual([]);
}
