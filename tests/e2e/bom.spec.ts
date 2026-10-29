import { expect, test } from '@playwright/test';
import { geenFouten, kiesSpel, maakKlas } from './helpers';

test('bom doorgeven: vragen kiezen, juist geeft door, ontploffing beslist', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await page.clock.install();
  await maakKlas(page, '3A', ['Peeters Anna', 'Claes Bert', 'Janssens Chloé', 'Mertens Dries']);
  await kiesSpel(page, 'Algebra: merkwaardige producten en ontbinden (3e jaar (5 u))', 'Bom doorgeven');

  // Enkel meerkeuzevragen: open vragen uit (de set zelf blijft gelijk).
  await page.getByText(/Vragen kiezen voor dit spel/).click();
  await page.getByRole('button', { name: /Open vraag \(\d+\/\d+\)/ }).click();
  await expect(page.getByText(/Vragen kiezen voor dit spel \((\d+) van 16\)/)).toBeVisible();
  await expect(page.getByText('(16 van 16)')).toHaveCount(0);

  await page.locator('label:text-is("Tijd tot de bom ontploft") + select').selectOption('kort');
  await page.getByRole('button', { name: /Start het spel/ }).click();

  const houder = page.locator('text=De bom ligt bij').locator('xpath=following-sibling::div').first();
  // Wie in het team zit, staat altijd op het scherm.
  await expect(page.locator('[data-teamleden] span')).not.toHaveCount(0);
  const eerste = (await houder.textContent())!.trim();
  if (process.env.SCHERMAFDRUK) await page.screenshot({ path: process.env.SCHERMAFDRUK });
  await page.getByRole('button', { name: /Steek de lont aan/ }).click();
  await page.keyboard.press(' ');
  await page.keyboard.press('j');
  await expect(page.getByText('✓ Juist! De bom gaat door…')).toBeVisible();
  await page.clock.runFor(1500);
  await expect(houder).not.toHaveText(eerste);

  // De bom ontploft (na hoogstens 45 s): dat telt voor het team, het spel gaat verder.
  for (let i = 0; i < 50 && !(await page.getByText('BOEM!').isVisible()); i++) await page.clock.runFor(1000);
  await expect(page.getByText(/De bom ontplofte bij/)).toBeVisible();
  await expect(page.getByLabel('1 keer ontploft')).toBeVisible();

  // Alle overige vragen beantwoorden (juist): na de laatste vraag volgt de eindstand.
  await page.getByRole('button', { name: /Volgende ronde/ }).click();
  for (let i = 0; i < 20 && !(await page.getByText(/wint!|Gelijkspel/).isVisible()); i++) {
    await page.keyboard.press(' ');
    await page.keyboard.press('j');
    await page.clock.runFor(1000);
  }
  await expect(page.getByText(/wint!/)).toBeVisible();
  await expect(page.getByText('💥 1')).toBeVisible();
  controleer();
});
