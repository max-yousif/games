import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('territorium samen: een tekening samen inkleuren, enkel lege vakjes', async ({ page }) => {
  test.setTimeout(90_000);
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '5C', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await kiesSpel(page, 'Codekraker test (test)', 'Territorium');
  await page.getByRole('button', { name: /Samen inkleuren/ }).click();
  await page.getByRole('button', { name: /Hart/ }).click();
  await page.locator('label:text-is("Wachten na fout antwoord") + select').selectOption('0');
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-instellingen.png'), fullPage: true });
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await leerling(page, code, 'Bert');
  await page.getByRole('button', { name: /Start Territorium/ }).click();
  await expect(page.getByText(/Samen inkleuren: Hart/)).toBeVisible();

  await anna.getByLabel('Je antwoord').fill('7');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  const veld = anna.locator('[data-tekenveld]');
  await expect(veld).toBeVisible();
  await expect(anna.getByText(/Kleur mee de tekening in/)).toBeVisible();
  const box = (await veld.boundingBox())!;
  await anna.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.4);
  await anna.mouse.down();
  await anna.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.4, { steps: 60 });
  await anna.waitForTimeout(1500);
  if (process.env.SCHERMAFDRUK) await anna.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-leerling.png') });
  await anna.mouse.up();
  await expect(anna.getByText(/Hoeveel is/)).toBeVisible({ timeout: 8000 });
  // Anna draagt bij; het bord toont hoeveel samen al gekleurd is.
  await expect(page.locator('li', { hasText: 'Anna' }).getByText(/^(?!0 %)[\d,.]+ %$/)).toBeVisible();
  await expect(page.getByLabel('Ingekleurd')).toBeVisible();
  await expect(anna.getByText(/samen (?!0 %)[\d,.]+ %/)).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK.replace('.png', '-bord.png') });

  await page.getByRole('button', { name: /Beëindigen/ }).click();
  await expect(page.getByText(/Samen [\d,.]+ % ingekleurd/)).toBeVisible();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK });
  await page.getByRole('button', { name: '💾 Resultaten bewaren' }).click();
  controleer();
});
