import { expect, test } from '@playwright/test';
import { bevestig, kiesSpel, leerling, maakKlas, startLive } from './helpers';

test('laptop van de leerkracht weg: leerlingen zien een melding, daarna wordt alles nagekeken', async ({ page }) => {
  test.setTimeout(90_000);
  await maakKlas(page, '4B', ['Peeters Anna', 'Claes Bert']);
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/escape-set.json');
  await kiesSpel(page, 'Ontsnap uit het wiskundelokaal (test)', 'Escape room');
  const code = await startLive(page);
  const anna = await leerling(page, code, 'Anna');
  await page.getByRole('button', { name: /Start de escape room/ }).click();
  await expect(anna.locator('main button', { hasText: 'Slot 1' })).toBeVisible();

  // Pauzeren tijdens een live spel: eerst bevestigen, dan kijkt niemand na.
  const sessie = page.url();
  await page.getByRole('button', { name: '⏸ Pauzeren' }).click();
  await bevestig(page, /niets nagekeken/);

  await anna.locator('main button', { hasText: 'Slot 1' }).click();
  if (await anna.getByLabel('Je antwoord').count()) {
    await anna.getByLabel('Je antwoord').fill('1');
    await anna.getByRole('button', { name: 'Versturen' }).click();
  } else await anna.locator('main button[aria-pressed]').first().click();
  await expect(anna.locator('[data-bord-stil]')).toBeVisible({ timeout: 20_000 });

  // De leerkracht keert terug: het antwoord wordt nagekeken en de melding verdwijnt.
  await page.goto(sessie);
  await expect(anna.locator('[data-bord-stil]')).toBeHidden({ timeout: 10_000 });
  await expect(anna.locator('main button', { hasText: 'Slot 1' })).toContainText(/\d/);
});
