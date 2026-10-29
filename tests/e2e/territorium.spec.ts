import { expect, test, type Page } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** Beantwoordt een vraag juist en tekent een lijn op het veld (van links naar rechts op hoogte y). */
async function juistEnTeken(p: Page, y: number) {
  await expect(p.getByText(/Hoeveel is \d\+\d\?/)).toBeVisible();
  await p.getByLabel('Je antwoord').fill('7');
  await p.getByRole('button', { name: 'Versturen' }).click();
  const veld = p.locator('[data-tekenveld]');
  await expect(veld).toBeVisible();
  const box = (await veld.boundingBox())!;
  // Het tekenveld ligt over het hele scherm: scrollen kan niet.
  const voor = await p.evaluate(() => window.scrollY);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.wheel(0, 600);
  expect(await p.evaluate(() => window.scrollY)).toBe(voor);
  await expect(p.getByText(/Teken zo snel mogelijk/)).toBeVisible();
  await p.mouse.move(box.x + box.width * 0.1, box.y + box.height * y);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width * (0.1 + i * 0.03), box.y + box.height * y);
  await p.mouse.up();
  await expect(p.getByText(/Teken zo snel mogelijk/)).toBeHidden();
  // Na de tekentijd gaat de tekening vanzelf door.
  await expect(p.getByText(/Hoeveel is \d\+\d\?/)).toBeVisible({ timeout: 8000 });
}

test('territorium: juist antwoord, tekenen, gebied op het bord, streak en einde', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '5C', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await kiesSpel(page, 'Codekraker test (test)', 'Territorium');
  await page.locator('label:text-is("Wachten na fout antwoord") + select').selectOption('0');
  await expect(page.getByLabel('Tekentijd per beurt')).toHaveValue('5');
  await page.getByLabel('Tekentijd per beurt').selectOption('3');
  const code = await startLive(page);

  const anna = await leerling(page, code, 'Anna');
  const bert = await leerling(page, code, 'Bert');
  await page.getByRole('button', { name: /Start Territorium/ }).click();

  // Fout antwoord: geen tekenbeurt.
  await anna.getByLabel('Je antwoord').fill('8');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByLabel('Je antwoord')).toBeVisible();
  await expect(anna.locator('[data-tekenveld]')).toHaveCount(0);

  await juistEnTeken(anna, 0.3);
  await juistEnTeken(bert, 0.7);
  // Anna heeft gebied op het bord en op haar eigen scherm.
  await expect(page.locator('li', { hasText: 'Anna' }).getByText(/^[1-9][\d,.]* %$/)).toBeVisible();
  await expect(anna.getByText(/^[1-9][\d,.]* %$/).first()).toBeVisible();

  // Tweede juist antwoord na elkaar: een streak en een groter penseel.
  await juistEnTeken(anna, 0.5);
  await expect(anna.getByText(/🔥 2 na elkaar/)).toBeVisible();
  await expect(page.locator('li', { hasText: 'Anna' }).getByText('🔥2')).toBeVisible();
  if (process.env.SCHERMAFDRUK) {
    await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });
    await anna.getByLabel('Je antwoord').fill('7');
    await anna.getByRole('button', { name: 'Versturen' }).click();
    await expect(anna.locator('[data-tekenveld]')).toBeVisible();
    await anna.setViewportSize({ width: 1280, height: 800 });
    await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });
    await anna.getByRole('button', { name: 'Niet tekenen' }).click();
  }

  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByRole('cell', { name: 'Anna' })).toBeVisible();
  await expect(bert.getByText('Het spel is gedaan!')).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK });
  await page.getByRole('button', { name: '✓ Afsluiten' }).click();
  controleer();
});
