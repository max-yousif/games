import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('escape room: sloten openen, foute code, ontsnappen', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '4B', ['Anna Peeters', 'Bert Claes']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/escape-set.json');
  await expect(page.getByText('Ontsnap uit het wiskundelokaal')).toBeVisible();
  await kiesSpel(page, 'Ontsnap uit het wiskundelokaal (test)', 'Escape room');
  await page.locator('div', { has: page.locator('label', { hasText: 'Wachten na fout antwoord' }) }).locator('select').last().selectOption('0');
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start de escape room/ }).click();
  const slot = (n: number) => anna.locator('main button', { hasText: `Slot ${n}` });

  await slot(1).click();
  await anna.getByLabel('Je antwoord').fill('8');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText('Dat was fout. Probeer opnieuw!')).toBeVisible();
  await anna.getByLabel('Je antwoord').fill('7');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText(/Slot open! Je cijfer/)).toBeVisible();
  await expect(slot(2)).toBeVisible({ timeout: 6000 });
  await slot(2).click();
  await anna.getByRole('button', { name: /32/ }).click();
  await expect(slot(3)).toBeVisible({ timeout: 6000 });
  await slot(3).click();
  await anna.getByRole('button', { name: /^A\s*Waar/ }).click();
  await expect(anna.getByText('Alle sloten zijn open!')).toBeVisible({ timeout: 6000 });

  const cijfers = (await anna.locator('.font-mono.text-4xl.font-bold').allTextContents()).map((t) => t.trim()).join('');
  expect(cijfers).toMatch(/^\d{3}$/);
  const fout = String((Number(cijfers) + 1) % 1000).padStart(3, '0');
  await anna.getByLabel('Code').fill(fout);
  await anna.getByRole('button', { name: 'Ontsnappen' }).click();
  await expect(anna.getByText(/Die code was fout/)).toBeVisible();
  await anna.getByLabel('Code').fill(cijfers);
  await anna.getByRole('button', { name: 'Ontsnappen' }).click();
  await expect(anna.getByText('Je bent ontsnapt!')).toBeVisible();

  await expect(page.getByText('1 / 1 ontsnapt')).toBeVisible();
  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText(/ontsnapt!/).first()).toBeVisible();
  controleer();
});
