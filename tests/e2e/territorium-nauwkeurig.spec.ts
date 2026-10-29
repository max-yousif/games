import { expect, test, type Page } from '@playwright/test';
import { kiesSpel, leerling, maakKlas, startLive } from './helpers';

/** Aantal vakjes in een kleur op een canvas (midden van elk vakje). */
async function tel(p: Page, selector: string, kleur: string) {
  return p.locator(selector).first().evaluate((c: HTMLCanvasElement, k) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const r = parseInt(k.slice(1, 3), 16), g = parseInt(k.slice(3, 5), 16), b = parseInt(k.slice(5, 7), 16);
    let n = 0;
    for (let y = 0; y < 50; y++) for (let x = 0; x < 80; x++) {
      const i = ((y * 10 + 5) * c.width + (x * 10 + 5)) * 4;
      if (d[i] === r && d[i + 1] === g && d[i + 2] === b) n++;
    }
    return n;
  }, kleur);
}

test('territorium: wat je tekent, is precies wat het bord bewaart (ook snel en lang)', async ({ page }) => {
  test.setTimeout(90_000);
  await maakKlas(page, '5C', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await kiesSpel(page, 'Codekraker test (test)', 'Territorium');
  await page.getByLabel('Tekentijd per beurt').selectOption('3');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start Territorium/ }).click();
  await anna.getByLabel('Je antwoord').fill('7');
  await anna.getByRole('button', { name: 'Versturen' }).click();
  const veld = anna.locator('[data-tekenveld]');
  await expect(veld).toBeVisible();
  const box = (await veld.boundingBox())!;
  // Snelle zigzag over het hele veld, in grote sprongen.
  await anna.mouse.move(box.x + 5, box.y + 5);
  await anna.mouse.down();
  for (let i = 0; i < 40; i++) await anna.mouse.move(box.x + (i % 2 ? box.width - 5 : 5), box.y + (box.height * (i + 1)) / 42, { steps: 2 });
  await anna.mouse.up();
  const voorbeeld = await tel(anna, '[data-tekenveld]', '#e6194b');
  // Het penseel kan niet sneller dan SNELHEID: lang niet het hele veld.
  expect(voorbeeld).toBeGreaterThan(20);
  expect(voorbeeld).toBeLessThan(200);
  await expect(anna.getByText(/Hoeveel is/)).toBeVisible({ timeout: 8000 });
  await expect.poll(() => tel(page, 'canvas[aria-label="Speelveld"]', '#e6194b')).toBe(voorbeeld);
});
