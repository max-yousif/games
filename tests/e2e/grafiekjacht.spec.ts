import { expect, test, type Page } from '@playwright/test';
import { geenFouten, leerling, maakKlas, startLive } from './helpers';

/** De voorschriften van de doelgrafieken, uit de sessie op de laptop van de leerkracht. */
async function voorschriften(page: Page): Promise<string[]> {
  // De sessie wordt na een seconde bewaard.
  const lees = () =>
    page.evaluate(() => {
      const sessies = JSON.parse(localStorage.getItem('games.v1.sessies') ?? '[]') as { spelType: string; vragen: { antwoord: string }[] }[];
      return sessies.find((s) => s.spelType === 'grafiekjacht')?.vragen.map((v) => v.antwoord) ?? [];
    });
  await expect.poll(lees).not.toEqual([]);
  return lees();
}

async function dienIn(p: Page, voorschrift: string) {
  await p.getByLabel('Voorschrift').fill(voorschrift);
  await p.getByRole('button', { name: 'Indienen' }).click();
}

test('grafiekjacht: voorschrift zoeken, eigen grafiek, fout, overslaan en einde', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '5A', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/spelen');
  await page.getByRole('button', { name: 'Grafiekjacht', exact: true }).click();
  await page.locator('[data-klas]').first().click();
  // Geen vragenset nodig: meteen de instellingen.
  await expect(page.getByText('niet nodig')).toBeVisible();
  await page.getByLabel('Aantal grafieken').selectOption('5');
  await page.getByRole('group', { name: 'Basisfuncties' }).getByRole('button', { name: 'sin x' }).click();
  const code = await startLive(page);
  const doelen = await voorschriften(page);
  expect(doelen).toHaveLength(5);
  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  await page.getByRole('button', { name: /Start Grafiekjacht/ }).click();

  // De leerling ziet de doelgrafiek en meteen de eigen grafiek bij het typen.
  await expect(anna.locator('[data-grafiek]')).toBeVisible();
  await anna.getByLabel('Voorschrift').fill('x');
  await expect(anna.locator('[data-eigen-grafiek]')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });

  // Anna: twee keer fout, dan de oplossing tonen en verder.
  await dienIn(anna, '1000');
  await expect(anna.locator('[data-nog-niet]')).toBeVisible();
  await dienIn(anna, '-1000');
  await expect(anna.locator('[data-nog-niet]')).toContainText('2×');
  await anna.getByRole('button', { name: /Oplossing tonen en verder/ }).click();
  await expect(anna.locator('[data-vorige]')).toContainText('De oplossing was');
  await expect(anna.getByText('grafiek 2 / 5')).toBeVisible();

  // Bert: alles juist.
  for (const [i, v] of doelen.entries()) {
    await expect(bert.getByText(`grafiek ${i + 1} / 5`)).toBeVisible();
    await dienIn(bert, v);
    if (i < doelen.length - 1) await expect(bert.locator('[data-vorige]')).toContainText('Juist! +3');
  }
  await expect(bert.getByText('Alle grafieken gevonden!')).toBeVisible();
  await expect(bert.getByText('15 punten', { exact: true })).toBeVisible();

  // Op het bord: de voortgang.
  await expect(page.locator('[data-voortgang]', { hasText: 'Bert' })).toContainText('15');
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });

  // Anna maakt af; iedereen klaar = einde, met de oplossingen.
  for (const [i, v] of doelen.entries()) {
    if (i === 0) continue;
    await expect(anna.getByText(`grafiek ${i + 1} / 5`)).toBeVisible();
    await dienIn(anna, v);
  }
  await expect(page.getByRole('heading', { name: 'De grafieken' })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'Anna' })).toContainText('4 / 5');
  await expect(page.locator('tr', { hasText: 'Anna' })).toContainText('12');
  await expect(anna.getByText('Het spel is gedaan!').or(anna.getByText('Alle grafieken gevonden!'))).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-einde.png'), fullPage: true });
  controleer();
});
