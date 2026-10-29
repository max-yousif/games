import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('ordenen: items slepen in de juiste volgorde', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await maakKlas(page, '3A', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/ordenen-set.json');
  await kiesSpel(page, 'Ordenen test (test)', 'Live quiz');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start de quiz/ }).click();

  const juist = ['een', 'twee', 'drie', 'vier', 'vijf'];
  const items = anna.locator('[data-orden-item]');
  await expect(items).toHaveCount(5);
  // Telkens het juiste item naar plaats k slepen (met de muis, zonder de pijltjes).
  for (let k = 0; k < juist.length; k++) {
    const van = (await items.filter({ hasText: juist[k] }).boundingBox())!;
    const naar = (await items.nth(k).boundingBox())!;
    await anna.mouse.move(van.x + 40, van.y + van.height / 2);
    await anna.mouse.down();
    await anna.mouse.move(naar.x + 40, naar.y + naar.height / 2, { steps: 8 });
    await anna.mouse.move(naar.x + 40, naar.y + 3, { steps: 2 });
    await anna.mouse.up();
    await expect(items.nth(k)).toContainText(juist[k]);
  }
  await expect(items).toHaveText(juist.map((t) => new RegExp(t)));
  await anna.getByRole('button', { name: 'Versturen' }).click();
  await expect(anna.getByText(/Juist! \+\d+/)).toBeVisible();
  controleer();
});
