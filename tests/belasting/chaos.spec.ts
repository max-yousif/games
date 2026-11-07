import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

/**
 * Belastingstest met "onnozele" leerlingen, voor elk live spel. Instellingen via omgeving:
 *   SPEL        codekraker | escape | detectivezaak | territorium | puzzel | grafiekjacht | whodunit | quiz
 *   LEERLINGEN  aantal leerlingen (standaard 5)
 *   MINUTEN     duur (standaard 1)
 *   TEMPO       gemiddelde ms tussen twee acties van een leerling (standaard 3000)
 *   CHAOS       0 = braaf, 1 = normaal onnozel (standaard), 2 = heel onnozel
 * Leerlingen klikken op alles (ook vijf keer snel na elkaar), typen onzin, herladen, gaan even
 * offline, openen een tweede tabblad en verlaten het spel om terug te komen. Gemeten wordt of
 * iemand vastzit (melding "reageert even niet" > 10 s), fouten op de pagina's, foutmeldingen,
 * en of het bord van de leerkracht trager wordt of steeds meer geheugen gebruikt.
 */
const SPEL = process.env.SPEL ?? 'codekraker';
const LEERLINGEN = Number(process.env.LEERLINGEN ?? 5);
const MINUTEN = Number(process.env.MINUTEN ?? 1);
const TEMPO = Number(process.env.TEMPO ?? 3000);
const CHAOS = Number(process.env.CHAOS ?? 1);
const SUPABASE = !!process.env.SUPABASE_URL;

/** Antwoorden die de leerlingen kennen (vragen uit de testsets). */
function juistAntwoord(vraag: string): string | null {
  const som = vraag.match(/Hoeveel is (\d+)\+(\d+)\?/);
  if (som) return String(Number(som[1]) + Number(som[2]));
  if (vraag.includes('2^5') || vraag.includes('2^{5}')) return '32';
  if (vraag.includes('3+4')) return '7';
  return null;
}

const ONZIN = ['', '   ', 'idk', '🤡🤡🤡', 'x'.repeat(1999), '<img src=x onerror=alert(1)>', "'; drop table live_antwoorden; --", '1e309', 'NaN', '\\frac{', '((((', '-0', '٣', '7 7 7'];
const VOORSCHRIFTEN = ['x^2', '(x-2)^2+1', '-|x|', 'sqrt(x+3)', '2^x', '1/x', 'sin(2x)', 'x^3-1', '|x+1|-2', '0,5x^2', 'y=', '(((', '🤡'];
const kans = (p: number) => Math.random() < p * CHAOS;
const kies = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

interface Meting {
  acties: number;
  antwoorden: number;
  spam: number;
  herladen: number;
  offline: number;
  tabbladen: number;
  verlaten: number;
  /** Melding "reageert even niet": aantal keer, en hoe vaak langer dan 10 s (= vast). */
  bordStil: number;
  vast: number;
  /** Foutmeldingen in beeld (tekst → aantal). */
  meldingen: Record<string, number>;
  paginafouten: string[];
  dialogen: string[];
  /** Ontvangen gegevens van de server (live verbinding + opvragingen), in bytes. */
  bytes: number;
}

const nieuweMeting = (): Meting => ({ acties: 0, antwoorden: 0, spam: 0, herladen: 0, offline: 0, tabbladen: 0, verlaten: 0, bordStil: 0, vast: 0, meldingen: {}, paginafouten: [], dialogen: [], bytes: 0 });

/** Telt wat een laptop van de server ontvangt (zonder de website zelf). */
function telVerkeer(p: Page, teller: { bytes: number }) {
  p.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      teller.bytes += typeof f.payload === 'string' ? Buffer.byteLength(f.payload) : f.payload.length;
    }),
  );
  p.on('response', (r) => {
    if (!['fetch', 'xhr'].includes(r.request().resourceType())) return;
    void r.body().then(
      (b) => (teller.bytes += b.length),
      () => {},
    );
  });
}

function bewaak(p: Page, m: Meting) {
  telVerkeer(p, m);
  p.on('pageerror', (e) => m.paginafouten.push(e.message.slice(0, 200)));
  p.on('dialog', (d) => {
    // Bevestigen (verlaten) is normaal; een alert zou betekenen dat ingetypte code uitgevoerd werd.
    if (d.type() !== 'confirm') m.dialogen.push(`${d.type()}: ${d.message().slice(0, 80)}`);
    void d.accept();
  });
}

/** Aanmelden met de code en een naam (ook na herladen of verlaten). */
async function meldAan(p: Page, code: string, naam: string) {
  if (await p.getByLabel('Code').isVisible().catch(() => false)) {
    await p.getByLabel('Code').fill(code);
    await p.getByRole('button', { name: /Verder|Zoek|Meedoen/ }).first().click();
  }
  const veld = p.getByLabel('Je naam');
  if (await veld.isVisible().catch(() => false)) {
    await veld.fill(naam);
    await p.getByRole('button', { name: 'Meedoen' }).click();
  }
}

/** Eén slimme of onnozele actie op het scherm van een leerling. */
async function doeIets(p: Page, m: Meting) {
  const main = p.locator('main');
  const invoer = p.getByLabel('Je antwoord');
  const voorschrift = p.getByLabel('Voorschrift');
  const knoppen = main.locator('button:enabled');
  if (await invoer.isVisible().catch(() => false)) {
    const vraag = (await main.textContent()) ?? '';
    const juist = juistAntwoord(vraag);
    const tekst = juist !== null && !kans(0.25) ? juist : kans(0.5) ? kies(ONZIN) : String(Math.floor(Math.random() * 20));
    await invoer.fill(tekst, { timeout: 2000 });
    await invoer.press('Enter', { timeout: 2000 });
    m.antwoorden++;
    return;
  }
  if (await voorschrift.isVisible().catch(() => false)) {
    // Grafiekjacht: soms de oplossing tonen, anders iets proberen.
    const verder = p.getByRole('button', { name: /Oplossing tonen en verder/ });
    if ((await verder.isVisible().catch(() => false)) && Math.random() < 0.5) await verder.click({ timeout: 2000 });
    else {
      await voorschrift.fill(kies(VOORSCHRIFTEN), { timeout: 2000 });
      await voorschrift.press('Enter', { timeout: 2000 });
      m.antwoorden++;
    }
    return;
  }
  const canvas = main.locator('canvas:not([aria-label="Speelveld"])');
  if (await canvas.count()) {
    // Territorium: wild tekenen.
    const bb = await canvas.last().boundingBox();
    if (bb) {
      await p.mouse.move(bb.x + Math.random() * bb.width, bb.y + Math.random() * bb.height);
      await p.mouse.down();
      for (let i = 0; i < 15; i++) await p.mouse.move(bb.x + Math.random() * bb.width, bb.y + Math.random() * bb.height, { steps: 2 });
      await p.mouse.up();
      m.acties++;
      return;
    }
  }
  const keuzes = main.locator('select:enabled');
  if ((await keuzes.count()) && Math.random() < 0.5) {
    // Whodunit-tabel of beschuldiging: willekeurig invullen.
    const s = keuzes.nth(Math.floor(Math.random() * (await keuzes.count())));
    const opties = await s.locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value).filter(Boolean));
    if (opties.length) await s.selectOption(kies(opties), { timeout: 2000 });
    m.acties++;
    return;
  }
  const n = await knoppen.count();
  if (!n) return;
  const knop = knoppen.nth(Math.floor(Math.random() * n));
  if (kans(0.15)) {
    // Vijf keer snel na elkaar op dezelfde knop.
    for (let i = 0; i < 5; i++) await knop.click({ timeout: 1000, force: true }).catch(() => {});
    m.spam++;
  } else await knop.click({ timeout: 2000 });
  m.acties++;
}

/** Een leerling die speelt tot het einde, met af en toe iets onnozels. */
async function leerling(ctx: BrowserContext, p: Page, code: string, naam: string, einde: number, m: Meting) {
  let stilSinds: number | null = null;
  let vastGemeld = false;
  const tabs: Page[] = [];
  while (Date.now() < einde) {
    try {
      // Vastzitten: de melding "reageert even niet" blijft staan.
      if (await p.locator('[data-bord-stil]').isVisible().catch(() => false)) {
        if (stilSinds === null) {
          stilSinds = Date.now();
          m.bordStil++;
        } else if (Date.now() - stilSinds > 10_000 && !vastGemeld) {
          m.vast++;
          vastGemeld = true;
        }
      } else {
        stilSinds = null;
        vastGemeld = false;
      }
      for (const t of await p.locator('main p.bg-red-50').allTextContents()) {
        const k = t.trim().replace(/\d+/g, 'N').slice(0, 60);
        if (k) m.meldingen[k] = (m.meldingen[k] ?? 0) + 1;
      }
      await meldAan(p, code, naam);

      if (kans(0.004)) {
        await p.reload();
        m.herladen++;
      } else if (SUPABASE && kans(0.002)) {
        // Wifi even weg.
        await ctx.setOffline(true);
        await p.waitForTimeout(5000 + Math.random() * 25_000);
        await ctx.setOffline(false);
        m.offline++;
      } else if (SUPABASE && kans(0.002) && tabs.length === 0) {
        // Een tweede tabblad met hetzelfde spel, dat ook meespeelt.
        const t = await ctx.newPage();
        bewaak(t, m);
        await t.goto(`#/live?code=${code}`);
        tabs.push(t);
        m.tabbladen++;
      } else if (kans(0.001)) {
        await p.getByRole('button', { name: 'Verlaten' }).click({ timeout: 2000 });
        m.verlaten++;
      } else await doeIets(p, m);
      for (const t of tabs) await doeIets(t, m).catch(() => {});
      if (tabs.length && kans(0.01)) await tabs.pop()!.close();
    } catch {
      // Het scherm veranderde tijdens de actie: gewoon verder.
    }
    await p.waitForTimeout(TEMPO * (0.3 + Math.random() * 1.4) / Math.max(1, CHAOS));
  }
}

/** Het spel klaarzetten op de laptop van de leerkracht. */
async function zetKlaar(page: Page) {
  const zonderKlas = async () => page.getByRole('button', { name: 'Zonder klas', exact: true }).click();
  const kiesSet = async (titel: string) => {
    await page.getByRole('button', { name: 'Alle jaren' }).click();
    await page.getByRole('button', { name: titel, exact: true }).click();
  };
  const select = (label: string) => page.locator(`label:text-is("${label}") + select`);
  const testset = async (bestand: string) => {
    await page.goto('#/sets');
    await page.locator('label:has-text("Openen uit bestand") input').setInputFiles(`tests/e2e/fixtures/${bestand}`);
    await page.waitForTimeout(500);
  };
  const naam: Record<string, string> = {
    codekraker: 'Codekraker',
    escape: 'Escape room',
    detectivezaak: 'Detectivezaak',
    territorium: 'Territorium',
    puzzel: 'Puzzel',
    grafiekjacht: 'Grafiekjacht',
    whodunit: 'Whodunit',
    quiz: 'Live quiz',
  };
  if (!naam[SPEL]) throw new Error(`Onbekend spel: ${SPEL}`);
  if (SPEL === 'escape') await testset('escape-set.json');
  else if (['codekraker', 'detectivezaak', 'territorium', 'puzzel'].includes(SPEL)) await testset('codekraker-set.json');
  await page.goto('#/spelen');
  await page.getByRole('button', { name: naam[SPEL], exact: true }).click();
  await zonderKlas();
  if (SPEL === 'escape') await kiesSet('Ontsnap uit het wiskundelokaal (test)');
  else if (SPEL === 'whodunit') await kiesSet('Whodunit: de nacht van de 50 dagen (5e–6e jaar)');
  else if (SPEL === 'quiz') await kiesSet('Algebra: merkwaardige producten en ontbinden (3e jaar (5 u))');
  else if (SPEL !== 'grafiekjacht') await kiesSet('Codekraker test (test)');
  if (await select('Totale tijd').count()) await select('Totale tijd').selectOption('');
  if (await select('Wachten na fout antwoord').count()) await select('Wachten na fout antwoord').selectOption('0');
  if (SPEL === 'puzzel') {
    await page.getByLabel('Foto voor de puzzel').setInputFiles('tests/e2e/fixtures/puzzel.png');
    await page.getByLabel('Aantal stukjes').selectOption('30');
  }
  if (SPEL === 'grafiekjacht') await page.getByLabel('Aantal grafieken').selectOption('15');
  if (SPEL === 'quiz') await select('Timer per vraag').selectOption('30');
  await page.getByRole('button', { name: /Start het spel/ }).click();
  await expect(page.getByText('en geef deze code in:')).toBeVisible({ timeout: 30_000 });
  return (await page.locator('.tracking-\\[0\\.2em\\]').textContent())!.trim();
}

interface HostMeting {
  t: number;
  /** Hoe lang het bord nodig heeft om één beeld te tekenen (ms): groot = traag. */
  beeldMs: number;
  geheugenMb: number;
  meldingen: number;
}

async function meetBord(page: Page, start: number): Promise<HostMeting> {
  const t0 = Date.now();
  const geheugen = await page.evaluate(
    () =>
      new Promise<number>((ok) =>
        requestAnimationFrame(() => ok(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e6)),
      ),
  );
  const meldingen = await page.getByText(/Nakijken mislukt|Er ging iets mis/).count();
  return { t: Math.round((Date.now() - start) / 1000), beeldMs: Date.now() - t0, geheugenMb: Math.round(geheugen), meldingen };
}

test(`${SPEL} met ${LEERLINGEN} leerlingen, ${MINUTEN} minuten, chaos ${CHAOS}`, async ({ page, browser }) => {
  test.setTimeout(0);
  const hostFouten: string[] = [];
  const hostVerkeer = { bytes: 0 };
  telVerkeer(page, hostVerkeer);
  page.on('pageerror', (e) => hostFouten.push(e.message.slice(0, 200)));
  page.on('dialog', (d) => void d.accept());
  await page.goto('./');
  if (SUPABASE) {
    test.skip(!process.env.GAST_WACHTWOORD, 'GAST_WACHTWOORD ontbreekt');
    await page.getByLabel('Gebruikersnaam').fill('Gast');
    await page.getByLabel('Wachtwoord').fill(process.env.GAST_WACHTWOORD!);
    await page.getByRole('button', { name: 'Aanmelden' }).click();
    await expect(page.getByRole('link', { name: 'Spelen' })).toBeVisible({ timeout: 30_000 });
  }
  const code = await zetKlaar(page);

  const spelers: { ctx: BrowserContext; p: Page; naam: string; m: Meting }[] = [];
  for (let i = 1; i <= LEERLINGEN; i++) {
    const ctx = SUPABASE ? await (browser as Browser).newContext({ viewport: { width: 1366, height: 768 } }) : page.context();
    const p = await ctx.newPage();
    const m = nieuweMeting();
    bewaak(p, m);
    await p.goto(`#/live?code=${code}${SUPABASE ? '' : '&demo=1'}`);
    await p.getByLabel('Je naam').waitFor({ timeout: 30_000 });
    await meldAan(p, code, `Leerling ${i}`);
    await expect(p.getByText(`Hallo Leerling ${i}!`)).toBeVisible({ timeout: 30_000 });
    spelers.push({ ctx, p, naam: `Leerling ${i}`, m });
  }
  await page.getByRole('button', { name: /^▶ Start/ }).click();

  const start = Date.now();
  const einde = start + MINUTEN * 60_000;
  const bord: HostMeting[] = [await meetBord(page, start)];
  const bordMeten = (async () => {
    while (Date.now() < einde) {
      await page.waitForTimeout(30_000);
      // Live quiz: de leerkracht toont het antwoord en gaat verder.
      if (SPEL === 'quiz') await page.getByRole('button', { name: /Toon antwoord|Volgende vraag/ }).first().click({ timeout: 2000 }).catch(() => {});
      bord.push(await meetBord(page, start).catch(() => ({ t: -1, beeldMs: -1, geheugenMb: -1, meldingen: -1 })));
    }
  })();
  await Promise.all([bordMeten, ...spelers.map((s) => leerling(s.ctx, s.p, code, s.naam, einde, s.m))]);

  const som = (f: (m: Meting) => number) => spelers.reduce((t, s) => t + f(s.m), 0);
  const meldingen: Record<string, number> = {};
  for (const s of spelers) for (const [k, v] of Object.entries(s.m.meldingen)) meldingen[k] = (meldingen[k] ?? 0) + v;
  const eerste = bord.slice(0, 3);
  const laatste = bord.slice(-3);
  const gem = (l: HostMeting[], f: (h: HostMeting) => number) => Math.round(l.reduce((t, h) => t + f(h), 0) / Math.max(1, l.length));
  const totaal = {
    spel: SPEL,
    modus: SUPABASE ? 'Supabase' : 'lokaal',
    leerlingen: LEERLINGEN,
    minuten: MINUTEN,
    chaos: CHAOS,
    antwoorden: som((m) => m.antwoorden),
    acties: som((m) => m.acties),
    spam: som((m) => m.spam),
    herladen: som((m) => m.herladen),
    offline: som((m) => m.offline),
    tweede_tabblad: som((m) => m.tabbladen),
    verlaten: som((m) => m.verlaten),
    melding_reageert_niet: som((m) => m.bordStil),
    vast: som((m) => m.vast),
    bord_beeld_ms_begin: gem(eerste, (h) => h.beeldMs),
    bord_beeld_ms_einde: gem(laatste, (h) => h.beeldMs),
    bord_beeld_ms_max: Math.max(...bord.map((h) => h.beeldMs)),
    bord_geheugen_mb_begin: gem(eerste, (h) => h.geheugenMb),
    bord_geheugen_mb_einde: gem(laatste, (h) => h.geheugenMb),
    bord_foutmeldingen: Math.max(...bord.map((h) => h.meldingen)),
    // Verkeer: per leerling per minuut, en voor een les van 50 minuten met 25 leerlingen + het bord.
    verkeer_kb_per_leerling_per_minuut: Math.round(som((m) => m.bytes) / LEERLINGEN / MINUTEN / 1024),
    verkeer_kb_bord_per_minuut: Math.round(hostVerkeer.bytes / MINUTEN / 1024),
    verkeer_mb_les_25_leerlingen_50_minuten: Math.round(((som((m) => m.bytes) / LEERLINGEN) * 25 + hostVerkeer.bytes) / MINUTEN * 50 / 1024 / 1024),
    meldingen_bij_leerlingen: Object.fromEntries(Object.entries(meldingen).sort((a, b) => b[1] - a[1]).slice(0, 8)),
    dialogen: spelers.flatMap((s) => s.m.dialogen).slice(0, 5),
    paginafouten: [...hostFouten, ...spelers.flatMap((s) => s.m.paginafouten)].slice(0, 10),
  };
  console.log(JSON.stringify(totaal, null, 2));
  writeFileSync(`test-results/belasting-${SPEL}.json`, JSON.stringify({ ...totaal, bord }, null, 2));

  // Opruimen: beëindigen en van de server wissen (niets bewaren).
  await page.getByRole('button', { name: /⏹ Beëindigen|Beëindigen/ }).first().click({ timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: /Afsluiten \(niet bewaren\)/ }).click({ timeout: 15_000 }).catch(() => {});

  expect(totaal.paginafouten, 'fouten op de pagina').toEqual([]);
  expect(totaal.dialogen, 'ingetypte code mag nooit uitgevoerd worden').toEqual([]);
  // Lokaal schrijven alle tabbladen in dezelfde browseropslag: enkel het script testen.
  if (!SUPABASE) return;
  expect(totaal.vast, 'leerlingen die meer dan 20 s op nakijken wachtten').toBe(0);
  expect(totaal.bord_foutmeldingen, 'foutmeldingen op het bord').toBe(0);
});
