import { expect, test } from '@playwright/test';
import { geenFouten } from './helpers';

/** Een kort wav-bestand (0,2 s stilte). */
function wav(): Buffer {
  const n = 1600;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

test('muziek: stijlen kiezen, beluisteren, eigen nummer toevoegen en verwijderen', async ({ page }) => {
  const controleer = geenFouten(page);
  page.on('dialog', (d) => void d.accept());
  await page.goto('#/spelen');
  await page.getByRole('button', { name: /Geluid/ }).click();
  const wacht = page.getByLabel('Wachtmuziek (wachtruimte)');
  await expect(wacht).toHaveValue('mix');
  await expect(wacht.locator('option')).toHaveCount(14);

  // Beluisteren en stoppen.
  await page.getByRole('button', { name: '▶ Beluister' }).first().click();
  await expect(page.getByRole('button', { name: '⏹ Stop' })).toBeVisible();
  await page.getByRole('button', { name: '⏹ Stop' }).click();

  // Eigen nummer toevoegen en kiezen.
  await page.locator('input[type=file][accept="audio/*"]').setInputFiles({ name: 'Mijn klasnummer.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.getByText('Mijn klasnummer', { exact: true })).toBeVisible();
  await wacht.selectOption({ label: '🎵 Mijn klasnummer' });
  await expect(wacht).toHaveValue(/^eigen:/);

  // Blijft bewaard na herladen.
  await page.reload();
  await page.getByRole('button', { name: /Geluid/ }).click();
  await expect(page.getByText('Mijn klasnummer', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Wachtmuziek (wachtruimte)')).toHaveValue(/^eigen:/);

  // Geen muziekbestand: een duidelijke melding.
  await page.locator('input[type=file][accept="audio/*"]').setInputFiles({ name: 'notities.txt', mimeType: 'text/plain', buffer: Buffer.from('hallo') });
  await expect(page.getByText('notities.txt is geen muziekbestand.')).toBeVisible();

  await page.getByRole('button', { name: 'Mijn klasnummer verwijderen' }).click();
  await expect(page.getByText('Nog geen eigen nummers.')).toBeVisible();
  controleer();
});
