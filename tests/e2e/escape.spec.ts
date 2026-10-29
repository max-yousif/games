import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** Een slot openen en een antwoord kiezen (de vraag staat bij elke leerling achter een ander slot). */
async function kies(p: Page, slot: number, antwoorden: Record<string, string>) {
  await p.locator('main button', { hasText: `Slot ${slot}` }).click();
  const vraag = (await p.locator('main .rounded-2xl.bg-surface').first().textContent()) ?? '';
  const antwoord = Object.entries(antwoorden).find(([deel]) => vraag.includes(deel))![1];
  if (await p.getByLabel('Je antwoord').count()) {
    await p.getByLabel('Je antwoord').fill(antwoord);
    await p.getByRole('button', { name: 'Versturen' }).click();
  } else await p.getByRole('button', { name: antwoord, exact: true }).click();
  // Altijd een cijfer, ook bij een fout antwoord: niets verraadt of het juist was.
  await expect(p.getByRole('button', { name: '← Terug naar de sloten' })).toBeHidden({ timeout: 6000 });
  await expect(p.locator('main button', { hasText: `Slot ${slot}` })).toContainText(/\d/);
}

test('escape room: elk antwoord geeft een cijfer, foute code = straftijd, juiste code = ontsnapt', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '4B', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/escape-set.json');
  await expect(page.getByText('Ontsnap uit het wiskundelokaal')).toBeVisible();
  await kiesSpel(page, 'Ontsnap uit het wiskundelokaal (test)', 'Escape room');
  await expect(page.getByLabel('Straftijd na foute code')).toHaveValue('60');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  await page.getByRole('button', { name: /Start de escape room/ }).click();

  // Anna: één fout antwoord. De code testen kan pas als alle sloten een cijfer hebben.
  await expect(anna.getByRole('button', { name: '🔓 Test de code' })).toBeDisabled();
  await kies(anna, 1, { '2^5': '16', 'sqrt': 'Waar', '3+4': '7' });
  await kies(anna, 2, { '2^5': '16', 'sqrt': 'Waar', '3+4': '7' });
  await kies(anna, 3, { '2^5': '16', 'sqrt': 'Waar', '3+4': '7' });
  await anna.getByRole('button', { name: '🔓 Test de code' }).click();
  await expect(anna.getByText(/Er zit nog ergens een fout/)).toBeVisible();
  await expect(anna.getByText(/Straftijd: nog \d+ s/)).toBeVisible();
  // Tijdens de straftijd: vragen bekijken mag, antwoorden niet.
  await anna.locator('main button', { hasText: 'Slot 1' }).click();
  await expect(anna.getByText(/je kan pas over \d+ s weer antwoorden/)).toBeVisible();
  await expect(anna.getByLabel('Je antwoord')).toHaveCount(0);
  for (const knop of await anna.locator('main button[aria-pressed]').all()) await expect(knop).toBeDisabled();
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-straf.png') });
  await anna.getByRole('button', { name: '← Terug naar de sloten' }).click();

  // Bert: alles juist en ontsnapt.
  await kies(bert, 1, { '2^5': '32', 'sqrt': 'Waar', '3+4': '7' });
  await kies(bert, 2, { '2^5': '32', 'sqrt': 'Waar', '3+4': '7' });
  await kies(bert, 3, { '2^5': '32', 'sqrt': 'Waar', '3+4': '7' });
  if (process.env.SCHERMAFDRUK) await bert.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });
  await bert.getByRole('button', { name: '🔓 Test de code' }).click();
  await expect(bert.getByText('Je bent ontsnapt!')).toBeVisible();

  await expect(page.getByText('1 / 2 ontsnapt')).toBeVisible();
  // Het bord verraadt niet wat juist is: enkel ingevulde sloten en foute codes.
  await expect(page.locator('tr', { hasText: 'Anna' }).getByText('✗1')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });
  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText(/ontsnapt!/).first()).toBeVisible();
  controleer();
});
