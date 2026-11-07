import { expect, test, type Browser, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

/**
 * Een volle klas speelt Codekraker: LEERLINGEN leerlingen (standaard 5) gedurende MINUTEN minuten
 * (standaard 1), met DENKTIJD ms (standaard 2000) tussen twee acties en af en toe een fout antwoord.
 * Meet hoe lang nakijken duurt, of iemand vast komt te zitten en of er fouten op de pagina's zijn.
 */
const LEERLINGEN = Number(process.env.LEERLINGEN ?? 5);
const MINUTEN = Number(process.env.MINUTEN ?? 1);
const DENKTIJD = Number(process.env.DENKTIJD ?? 2000);
const SUPABASE = !!process.env.SUPABASE_URL;
const FOUT_KANS = 0.2;
/** Zo lang zonder nakijken = vast. */
const VAST_MS = 20_000;

interface Meting {
  antwoorden: number;
  acties: number;
  /** Tijd tussen versturen en het volgende scherm (ms). */
  wachttijden: number[];
  vast: number;
  bordStil: number;
  /** Wat de leerling zag toen de melding "reageert even niet" verscheen. */
  stilInfo: string[];
  fouten: string[];
}

const pauze = (p: Page) => p.waitForTimeout(DENKTIJD * (0.5 + Math.random()));

/** Eén leerling: speelt tot het einde zo goed als het scherm toelaat. */
async function leerling(p: Page, einde: number, m: Meting) {
  let verstuurd: number | null = null;
  // Sinds wanneer de leerling niets kan doen (wachten op nakijken).
  let wachtSinds: number | null = null;
  let stilGezien = false;
  let vastGemeld = false;
  const klaar = () => {
    if (verstuurd !== null) m.wachttijden.push(Date.now() - verstuurd);
    verstuurd = null;
    wachtSinds = null;
    vastGemeld = false;
  };
  while (Date.now() < einde) {
    const stil = (await p.locator('[data-bord-stil]').count()) > 0;
    if (stil && !stilGezien) {
      m.bordStil++;
      m.stilInfo.push(((await p.locator('main').textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').slice(0, 120));
    }
    stilGezien = stil;

    const wachtwoord = p.locator('[data-wachtwoord]');
    const invoer = p.getByLabel('Je antwoord');
    const kistje = p.getByRole('button', { name: /^Kistje \d/ });
    const verder = p.getByRole('button', { name: /Volgende vraag ▶|Niet hacken/ });
    const raden = p.locator('main button.font-mono');
    try {
      if ((await wachtwoord.count()) && (await wachtwoord.first().isEnabled())) {
        klaar();
        await wachtwoord.first().click({ timeout: 3000 });
        verstuurd = Date.now();
        m.acties++;
      } else if (await invoer.count()) {
        klaar();
        const vraag = (await p.locator('main').textContent()) ?? '';
        const [, a, b] = vraag.match(/Hoeveel is (\d+)\+(\d+)\?/) ?? [];
        const som = Number(a) + Number(b);
        await pauze(p);
        await invoer.fill(String(Math.random() < FOUT_KANS ? som + 1 : som), { timeout: 3000 });
        await p.getByRole('button', { name: 'Versturen' }).click({ timeout: 3000 });
        verstuurd = Date.now();
        m.antwoorden++;
      } else if (await kistje.count()) {
        klaar();
        await kistje.nth(Math.floor(Math.random() * (await kistje.count()))).click({ timeout: 3000 });
        verstuurd = Date.now();
        m.acties++;
      } else if (await verder.count()) {
        klaar();
        await verder.first().click({ timeout: 3000 });
      } else if ((await raden.count()) && (await raden.first().isEnabled())) {
        klaar();
        await raden.first().click({ timeout: 3000 });
        verstuurd = Date.now();
        m.acties++;
      } else {
        // Niets te doen ("even geduld" of het wachtwoord wordt nagekeken): te lang = vast.
        wachtSinds ??= verstuurd ?? Date.now();
        if (Date.now() - wachtSinds > VAST_MS && !vastGemeld) {
          m.vast++;
          vastGemeld = true;
        }
      }
    } catch {
      // Het scherm veranderde net tijdens het klikken: opnieuw kijken.
    }
    await p.waitForTimeout(200);
  }
}

const procentiel = (lijst: number[], p: number) => {
  const s = [...lijst].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

async function nieuweLeerling(browser: Browser, host: Page, code: string, nr: number): Promise<{ p: Page; fouten: string[] }> {
  // Met Supabase: elke leerling een eigen browserprofiel (eigen anonieme aanmelding); zonder: tabbladen.
  const p = SUPABASE ? await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage() : await host.context().newPage();
  const fouten: string[] = [];
  p.on('pageerror', (e) => fouten.push(e.message));
  await p.goto(`#/live?code=${code}${SUPABASE ? '' : '&demo=1'}`);
  await p.getByLabel('Je naam').fill(`Leerling ${nr}`);
  await p.getByRole('button', { name: 'Meedoen' }).click();
  await expect(p.getByText(`Hallo Leerling ${nr}!`)).toBeVisible({ timeout: 30_000 });
  return { p, fouten };
}

test(`codekraker met ${LEERLINGEN} leerlingen, ${MINUTEN} minuten`, async ({ page, browser }) => {
  const hostFouten: string[] = [];
  page.on('pageerror', (e) => hostFouten.push(e.message));
  page.on('dialog', (d) => void d.accept());
  await page.goto('./');
  if (SUPABASE) {
    test.skip(!process.env.GAST_WACHTWOORD, 'GAST_WACHTWOORD ontbreekt');
    await page.getByLabel('Gebruikersnaam').fill('Gast');
    await page.getByLabel('Wachtwoord').fill(process.env.GAST_WACHTWOORD!);
    await page.getByRole('button', { name: 'Aanmelden' }).click();
    await expect(page.getByRole('link', { name: 'Spelen' })).toBeVisible({ timeout: 30_000 });
  }
  await page.goto('#/sets');
  await page.locator('label:has-text("Openen uit bestand") input').setInputFiles('tests/e2e/fixtures/codekraker-set.json');
  await page.goto('#/spelen');
  await page.getByRole('button', { name: 'Codekraker', exact: true }).click();
  await page.getByRole('button', { name: 'Zonder klas', exact: true }).click();
  await page.getByRole('button', { name: 'Alle jaren' }).click();
  await page.getByRole('button', { name: 'Codekraker test (test)', exact: true }).click();
  await page.locator('label:text-is("Wachten na fout antwoord") + select').selectOption('0');
  await page.locator('label:text-is("Totale tijd") + select').selectOption('');
  await page.getByRole('button', { name: /Start het spel/ }).click();
  await expect(page.getByText('en geef deze code in:')).toBeVisible({ timeout: 30_000 });
  const code = (await page.locator('.tracking-\\[0\\.2em\\]').textContent())!.trim();

  const leerlingen = [];
  for (let i = 1; i <= LEERLINGEN; i++) leerlingen.push(await nieuweLeerling(browser, page, code, i));
  await page.getByRole('button', { name: /Start Codekraker/ }).click();

  const start = Date.now();
  const einde = start + MINUTEN * 60_000;
  const metingen: Meting[] = leerlingen.map((l) => ({ antwoorden: 0, acties: 0, wachttijden: [], vast: 0, bordStil: 0, stilInfo: [], fouten: l.fouten }));
  await Promise.all(leerlingen.map((l, i) => leerling(l.p, einde, metingen[i])));

  // Samenvatting.
  const alle = metingen.flatMap((m) => m.wachttijden);
  const totaal = {
    modus: SUPABASE ? 'Supabase' : 'lokaal',
    leerlingen: LEERLINGEN,
    minuten: MINUTEN,
    antwoorden: metingen.reduce((t, m) => t + m.antwoorden, 0),
    acties: metingen.reduce((t, m) => t + m.acties, 0),
    nakijken_mediaan_ms: procentiel(alle, 50),
    nakijken_p95_ms: procentiel(alle, 95),
    nakijken_max_ms: Math.max(0, ...alle),
    minste_antwoorden: Math.min(...metingen.map((m) => m.antwoorden)),
    vast: metingen.reduce((t, m) => t + m.vast, 0),
    bord_stil: metingen.reduce((t, m) => t + m.bordStil, 0),
    bord_stil_schermen: metingen.flatMap((m) => m.stilInfo).slice(0, 5),
    paginafouten: [...hostFouten, ...metingen.flatMap((m) => m.fouten)].slice(0, 10),
  };
  console.log(JSON.stringify(totaal, null, 2));
  writeFileSync('test-results/belasting.json', JSON.stringify(totaal, null, 2));

  // Opruimen: spel beëindigen en van de server wissen (niets bewaren).
  await page.getByRole('button', { name: '⏹ Beëindigen' }).click();
  await page.getByRole('button', { name: /Afsluiten \(niet bewaren\)/ }).click();

  expect(totaal.paginafouten).toEqual([]);
  // Lokaal schrijven alle tabbladen in dezelfde browseropslag, en dat is niet bestand tegen
  // gelijktijdig schrijven: daar enkel het script zelf testen. De echte meting is die met Supabase.
  if (!SUPABASE) return;
  expect(totaal.vast, 'leerlingen die meer dan 20 s op nakijken wachtten').toBe(0);
  expect(totaal.minste_antwoorden, 'elke leerling kon blijven antwoorden').toBeGreaterThan(0);
});
