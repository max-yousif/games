import { juistAntwoord } from '../lib/questions';
import { isKeuzeVraag, keuzeOpties } from '../lib/vraagtypes';
import { randomInt as defaultRandomInt, type RandomInt } from '../lib/random';
import type { CluedoOplossing, CluedoThema, KaartOpgave, Vraag } from '../lib/types';
import { isActie, leesActie as leesJson, leesBeloning, vraagIndex } from './codekraker';
import { automatischJuist, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/**
 * Cluedo: wie pleegde de moord, waar en met welk wapen? Leerlingen beantwoorden vragen in eigen
 * tempo (de vragen komen steeds opnieuw); elk juist antwoord streept één kaart weg die niet de
 * oplossing is. Wie denkt het te weten, beschuldigt: juist = opgelost, fout = even geblokkeerd.
 *
 * Zoals bij Crypto Hack: vragen hebben nummers 0, 1, 2 ..., beschuldigingen nummers vanaf
 * ACTIE_BASIS. Enkel de laptop van de leerkracht kent de oplossing en beslist welke kaart verdwijnt.
 */

export type { CluedoThema, CluedoOplossing };

export type KaartSoort = 'verdachten' | 'locaties' | 'wapens';
export const KAART_SOORTEN: KaartSoort[] = ['verdachten', 'locaties', 'wapens'];
export const SOORT_NAMEN: Record<KaartSoort, { titel: string; icoon: string; enkel: string }> = {
  verdachten: { titel: 'Verdachten', icoon: '🧑', enkel: 'de dader' },
  locaties: { titel: 'Locaties', icoon: '📍', enkel: 'de plaats' },
  wapens: { titel: 'Wapens', icoon: '🔪', enkel: 'het wapen' },
};

export interface Kaart {
  soort: KaartSoort;
  naam: string;
}

/** Na een foute beschuldiging even geen vragen of beschuldigingen (ms), als de leerkracht niets koos. */
export const STRAF_MS = 60_000;
/** Straftijd van een sessie: de gekozen straftijd (in seconden, in `wachttijd`), anders STRAF_MS. */
export const strafMsVan = (wachttijd: number | undefined) => (wachttijd ? wachttijd * 1000 : STRAF_MS);

export const STANDAARD_THEMA: CluedoThema = {
  titel: 'Moord in de leraarskamer',
  verdachten: ['Professor Pi', 'Mevrouw Sinus', 'Meneer Byte', 'Dokter Fibonacci', 'Juffrouw Vector', 'De conciërge'],
  locaties: ['ICT-lokaal', 'Refter', 'Turnzaal', 'Bibliotheek', 'Labo', 'Leraarskamer', 'Speelplaats', 'Fietsenstalling', 'Secretariaat'],
  wapens: ['Passer', 'Geodriehoek', 'Rekenmachine', 'USB-stick', 'Verlengkabel', 'Wiskundeboek'],
};

/** Cluedo met opgaven per kaart (in plaats van de vragen van de set)? */
export const metOpgaven = (t: CluedoThema) => !!t.metOpgaven || (!!t.opgaven && KAART_SOORTEN.some((s) => t.opgaven![s]?.some((o) => o?.opgave.trim() || o?.vraagId)));
/** Heeft de kaart een opgave (eigen opgave of een vraag uit de set)? Zonder = de oplossing. */
const heeftOpgave = (o: KaartOpgave) => !!(o.opgave.trim() || o.vraagId);
/** Met meerkeuzevragen uit de set: dan staan er geen uitkomsten op het blad (anders verraadt het blad het antwoord). */
export const metSetVragen = (t: CluedoThema) => !!t.opgaven && KAART_SOORTEN.some((s) => t.opgaven![s]?.some((o) => o?.vraagId));
export const opgaveVan = (t: CluedoThema, soort: KaartSoort, i: number): KaartOpgave => t.opgaven?.[soort]?.[i] ?? { opgave: '', uitkomst: '' };

/** Wat er mis is met een thema (leeg = in orde). */
export function themaProblemen(t: CluedoThema): string[] {
  const uit: string[] = [];
  if (metOpgaven(t)) {
    for (const s of KAART_SOORTEN) {
      const naam = SOORT_NAMEN[s].titel.toLowerCase();
      const zonder = t[s].filter((_, i) => !heeftOpgave(opgaveVan(t, s, i))).length;
      if (zonder > 1) uit.push(`Bij de ${naam} mag hoogstens één kaart zonder opgave zijn (dat is de oplossing).`);
      if (!metSetVragen(t) && t[s].some((_, i) => !opgaveVan(t, s, i).uitkomst.trim()))
        uit.push(`Geef bij elke kaart van de ${naam} een uitkomst, ook bij de oplossing: anders verraadt het detectiveblad de oplossing.`);
    }
  }
  for (const s of KAART_SOORTEN) {
    const lijst = t[s];
    const naam = SOORT_NAMEN[s].titel.toLowerCase();
    if (lijst.length < 2) uit.push(`Geef minstens 2 ${naam}.`);
    if (lijst.some((x) => !x.trim())) uit.push(`Geef elke kaart bij de ${naam} een naam.`);
    const opl = t.oplossing?.[OPLOSSING_VELD[s]];
    if (opl && !lijst.includes(opl)) uit.push(`De oplossing bij de ${naam} staat niet meer in de lijst.`);
    if (lijst.length > 12) uit.push(`Maximaal 12 ${naam}.`);
    if (new Set(lijst.map((x) => x.toLowerCase())).size !== lijst.length) uit.push(`Elke naam bij de ${naam} mag maar één keer voorkomen.`);
  }
  return uit;
}

/** Lijst uit een tekstvak: één naam per regel, lege regels weg. */
export const lijstUitTekst = (tekst: string) =>
  tekst
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export const alleKaarten = (t: CluedoThema): Kaart[] => KAART_SOORTEN.flatMap((soort) => t[soort].map((naam) => ({ soort, naam })));

const OPLOSSING_VELD: Record<KaartSoort, keyof CluedoOplossing> = { verdachten: 'verdachte', locaties: 'locatie', wapens: 'wapen' };

export function trekOplossing(t: CluedoThema, rand: RandomInt = defaultRandomInt): CluedoOplossing {
  // Aangeduid door de leerkracht; met opgaven de kaart zonder opgave; anders een willekeurige.
  const kies = (s: KaartSoort) => {
    const gekozen = t.oplossing?.[OPLOSSING_VELD[s]];
    if (gekozen && t[s].includes(gekozen)) return gekozen;
    const zonder = metOpgaven(t) ? t[s].filter((_, i) => !heeftOpgave(opgaveVan(t, s, i))) : [];
    return zonder.length === 1 ? zonder[0] : t[s][rand(t[s].length)];
  };
  return { verdachte: kies('verdachten'), locatie: kies('locaties'), wapen: kies('wapens') };
}

/**
 * De opgaven die leerlingen krijgen: één per kaart die niet de oplossing is. Het id verwijst naar de
 * kaart. Een kaart met een vraag uit de set krijgt die vraag (uit `setVragen`).
 */
export function opgaveVragen(t: CluedoThema, o: CluedoOplossing, setVragen: readonly Vraag[] = []): Vraag[] {
  return KAART_SOORTEN.flatMap((soort) =>
    t[soort].flatMap((naam, i) => {
      const op = opgaveVan(t, soort, i);
      if (inOplossing({ soort, naam }, o) || !heeftOpgave(op)) return [];
      if (op.vraagId) {
        const v = setVragen.find((x) => x.id === op.vraagId);
        return v ? [{ ...v, id: `cluedo:${soort}:${i}` }] : [];
      }
      if (!op.opgave.trim()) return [];
      return [{ id: `cluedo:${soort}:${i}`, categorie: '', punten: 100, type: 'open', tekst: op.opgave, antwoord: op.uitkomst, opties: [], juisteOptie: 0, uitleg: '', gelijkwaardig: true } satisfies Vraag];
    }),
  );
}

/** De kaart bij een opgave (uit het id van opgaveVragen). */
export function kaartVanOpgave(t: CluedoThema, vraagId: string): Kaart | null {
  const [, soort, i] = vraagId.split(':');
  const naam = KAART_SOORTEN.includes(soort as KaartSoort) ? t[soort as KaartSoort][Number(i)] : undefined;
  return naam ? { soort: soort as KaartSoort, naam } : null;
}

const UITLEG_SOORT: Record<string, KaartSoort> = { wie: 'verdachten', hoe: 'wapens', waar: 'locaties' };
const uitlegKaart = (v: Vraag): Kaart | null => {
  const m = /^\s*(wie|hoe|waar)\s*\?\s*(.+?)\s*$/i.exec(v.uitleg ?? '');
  return m ? { soort: UITLEG_SOORT[m[1].toLowerCase()], naam: m[2] } : null;
};

/**
 * Kaarten van vroeger (met een vraag per kaart, de kaart zonder vraag = de oplossing) naar het
 * eenvoudige formaat: aangeduide oplossing en "elke kaart een vraag" (gekoppeld via de uitleg).
 */
export function moderniseer(t: CluedoThema): CluedoThema {
  if (t.metVragen || !KAART_SOORTEN.some((s) => t.opgaven?.[s]?.some((o) => o?.vraagId))) return t;
  const zonder = (s: KaartSoort) => t[s].filter((_, i) => !heeftOpgave(opgaveVan(t, s, i)));
  const een = (s: KaartSoort) => (zonder(s).length === 1 ? zonder(s)[0] : undefined);
  return { ...t, opgaven: undefined, metVragen: true, oplossing: { verdachte: een('verdachten'), locatie: een('locaties'), wapen: een('wapens') } };
}

/** Hoeveel vragen nodig zijn als elke kaart een vraag krijgt: alle kaarten behalve de oplossing. */
export const nodigeVragen = (t: CluedoThema) => Math.max(0, alleKaarten(t).length - 3);

/**
 * Bij de start: de oplossing kiezen en elke andere kaart een vraag uit `vragen` geven. Een vraag met
 * "Wie? Naam" (Hoe?, Waar?) in de uitleg hoort bij die kaart; de rest wordt willekeurig verdeeld.
 * Het resultaat is een thema met opgaven per kaart (zoals opgaveVragen het gebruikt).
 */
export function koppelVragen(t: CluedoThema, vragen: readonly Vraag[], rand: RandomInt = defaultRandomInt): { thema: CluedoThema; oplossing: CluedoOplossing } | { fout: string } {
  const oplossing = trekOplossing({ ...t, opgaven: undefined }, rand);
  const kaarten = alleKaarten(t).filter((k) => !inOplossing(k, oplossing));
  if (vragen.length < kaarten.length) return { fout: `Elke kaart behalve de oplossing heeft een vraag nodig: ${kaarten.length} vragen, de set heeft er ${vragen.length}.` };
  const vrij = [...vragen];
  const gekoppeld = new Map<string, Vraag>();
  const sleutel = (k: Kaart) => `${k.soort}:${k.naam.toLocaleLowerCase('nl')}`;
  // Eerst de vragen die in hun uitleg zeggen bij welke kaart ze horen.
  for (const k of kaarten) {
    const i = vrij.findIndex((v) => {
      const u = uitlegKaart(v);
      return u && u.soort === k.soort && u.naam.toLocaleLowerCase('nl') === k.naam.toLocaleLowerCase('nl');
    });
    if (i >= 0) gekoppeld.set(sleutel(k), vrij.splice(i, 1)[0]);
  }
  // Dan de andere vragen willekeurig over de overige kaarten.
  for (let i = vrij.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [vrij[i], vrij[j]] = [vrij[j], vrij[i]];
  }
  for (const k of kaarten) if (!gekoppeld.has(sleutel(k))) gekoppeld.set(sleutel(k), vrij.shift()!);
  const juist = (v: Vraag) => (isKeuzeVraag(v) ? (keuzeOpties(v)[v.juisteOptie] ?? '') : v.antwoord).replace(/\$/g, '').trim();
  const opgaven = Object.fromEntries(
    KAART_SOORTEN.map((s) => [
      s,
      t[s].map((naam) => {
        const v = gekoppeld.get(sleutel({ soort: s, naam }));
        return v ? { opgave: '', uitkomst: juist(v), vraagId: v.id } : { opgave: '', uitkomst: '' };
      }),
    ]),
  ) as NonNullable<CluedoThema['opgaven']>;
  return { thema: { ...t, opgaven }, oplossing };
}

/**
 * Een thema uit de vragenset: elke vraag met in de uitleg "Wie? Naam", "Hoe? Naam" of "Waar? Naam"
 * wordt een kaart met die vraag; het juiste antwoord is de uitkomst. Per soort komt er een lege kaart
 * bij voor de oplossing (naam en uitkomst zelf invullen). Null als geen enkele vraag zo'n uitleg heeft.
 */
export function kaartenUitVragen(titel: string, vragen: readonly Vraag[]): CluedoThema | null {
  const t: CluedoThema = { titel, verdachten: [], locaties: [], wapens: [], opgaven: { verdachten: [], locaties: [], wapens: [] } };
  for (const v of vragen) {
    const m = /^\s*(wie|hoe|waar)\s*\?\s*(.+?)\s*$/i.exec(v.uitleg ?? '');
    if (!m) continue;
    const soort = UITLEG_SOORT[m[1].toLowerCase()];
    t[soort].push(m[2]);
    const juist = isKeuzeVraag(v) ? (keuzeOpties(v)[v.juisteOptie] ?? '') : v.antwoord;
    t.opgaven![soort].push({ opgave: '', uitkomst: juist.replace(/\$/g, '').trim(), vraagId: v.id });
  }
  if (!KAART_SOORTEN.some((s) => t[s].length)) return null;
  for (const s of KAART_SOORTEN) {
    t[s].push('');
    t.opgaven![s].push({ opgave: '', uitkomst: '' });
  }
  return t;
}

/**
 * Het thema voor de server: zonder opgaven (die verraden welke kaarten niet de oplossing zijn), wel
 * de uitkomsten (niet bij meerkeuzevragen: dan zou het blad het juiste antwoord verraden).
 */
export function publiekThema(t: CluedoThema): CluedoThema {
  const { opgaven: _, ...rest } = t;
  if (!metOpgaven(t)) return rest;
  if (metSetVragen(t)) return { ...rest, metOpgaven: true };
  return { ...rest, metOpgaven: true, uitkomsten: Object.fromEntries(KAART_SOORTEN.map((s) => [s, t[s].map((_, i) => opgaveVan(t, s, i).uitkomst)])) as CluedoThema['uitkomsten'] };
}

/** Een goed spreidende hash (FNV-1a met een eindmenging): gelijkaardige teksten geven heel andere getallen. */
function hash(tekst: string): number {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

const zelfdeKaart = (a: Kaart, b: Kaart) => a.soort === b.soort && a.naam === b.naam;

/** Eenvoudige willekeurige getallen met een zaad (mulberry32): elke keer dezelfde reeks. */
function zaadGenerator(zaad: string): () => number {
  let a = hash(zaad);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Welke kaart elke foute keuze wegstreept, per leerling vast bij de start (sleutel "vraagId:keuze").
 * Evenwichtig verdeeld: elke kaart kan ongeveer even vaak getroffen worden. Een gewone kaart door
 * het juiste antwoord van haar vraag en enkele foute keuzes, een kaart van de oplossing door evenveel
 * foute keuzes. Zo valt de oplossing niet op, ook niet wie gokt en kijkt wat overblijft.
 */
export function foutKaarten(t: CluedoThema, vragen: readonly Vraag[], zaad: string): Map<string, Kaart> {
  const r = zaadGenerator(zaad);
  const kaarten = alleKaarten(t);
  const sleutel = (k: Kaart) => `${k.soort}:${k.naam}`;
  const last = new Map(kaarten.map((k) => [sleutel(k), 0]));
  const fout: { sleutel: string; eigen: Kaart | null }[] = [];
  for (const v of vragen) {
    if (!isKeuzeVraag(v)) continue;
    const eigen = kaartVanOpgave(t, v.id);
    if (eigen) last.set(sleutel(eigen), (last.get(sleutel(eigen)) ?? 0) + 1);
    keuzeOpties(v).forEach((o, i) => {
      if (i !== v.juisteOptie && o.trim()) fout.push({ sleutel: `${v.id}:${i}`, eigen });
    });
  }
  // In willekeurige volgorde telkens naar een kaart met de minste treffers (niet die van de vraag zelf).
  for (let i = fout.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [fout[i], fout[j]] = [fout[j], fout[i]];
  }
  const uit = new Map<string, Kaart>();
  for (const f of fout) {
    const kandidaten = kaarten.filter((k) => !(f.eigen && zelfdeKaart(k, f.eigen)));
    const minst = Math.min(...kandidaten.map((k) => last.get(sleutel(k))!));
    const keuze = kandidaten.filter((k) => last.get(sleutel(k)) === minst);
    const k = keuze[Math.floor(r() * keuze.length)];
    last.set(sleutel(k), minst + 1);
    uit.set(f.sleutel, k);
  }
  return uit;
}

/** Welke kaart een keuze bij een meerkeuzevraag wegstreept: juist = die van de vraag, fout = volgens `fout`. */
export function kaartVoorKeuze(t: CluedoThema, v: Vraag, keuze: number, fout: ReadonlyMap<string, Kaart>): Kaart | null {
  if (keuze === v.juisteOptie) return kaartVanOpgave(t, v.id);
  return fout.get(`${v.id}:${keuze}`) ?? null;
}

/** Een antwoord op een opgave (Cluedo met opgaven): nr = plaats in de lijst opgaven. */
export interface OpgaveAntwoord {
  soort: 'opgave';
  nr: number;
  antwoord: string;
}
export const leesOpgaveAntwoord = (tekst: string): OpgaveAntwoord | null => {
  const a = leesJson(tekst) as unknown as OpgaveAntwoord | null;
  return a?.soort === 'opgave' && Number.isInteger(a.nr) && typeof a.antwoord === 'string' ? a : null;
};

const inOplossing = (k: Kaart, o: CluedoOplossing) =>
  (k.soort === 'verdachten' && k.naam === o.verdachte) || (k.soort === 'locaties' && k.naam === o.locatie) || (k.soort === 'wapens' && k.naam === o.wapen);

/** Aantal kaarten dat weggestreept kan worden (alles behalve de oplossing). */
export const aantalWeg = (t: CluedoThema) => alleKaarten(t).length - 3;

export interface Beschuldiging {
  soort: 'beschuldig';
  verdachte: string;
  locatie: string;
  wapen: string;
}

export interface VraagBeloning {
  kaart: Kaart | null;
}
export interface BeschuldigBeloning {
  juist: boolean;
  /** Te vroeg na een foute beschuldiging of al opgelost: telt niet. */
  ongeldig?: boolean;
}

export const leesBeschuldiging = (tekst: string): Beschuldiging | null => {
  const a = leesJson(tekst) as unknown as Beschuldiging | null;
  return a?.soort === 'beschuldig' ? a : null;
};

export interface CluedoSpeler {
  speler: LiveSpeler;
  /** Weggestreepte kaarten, in volgorde. */
  weg: Kaart[];
  juist: number;
  fout: number;
  opgelostMs: number | null;
  /** Tijd van de laatste foute beschuldiging. */
  strafVanaf: number | null;
  beschuldigingen: number;
}

export interface CluedoGebeurtenis {
  tijdMs: number;
  tekst: string;
  soort: 'opgelost' | 'fout' | 'kaart';
}

export interface CluedoToestand {
  spelers: Map<string, CluedoSpeler>;
  gebeurtenissen: CluedoGebeurtenis[];
}

/** Herberekent de toestand uit de beoordeelde antwoorden (in de volgorde waarin ze binnenkwamen). */
export function cluedoToestand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): CluedoToestand {
  const t: CluedoToestand = {
    spelers: new Map(spelers.map((s) => [s.id, { speler: s, weg: [], juist: 0, fout: 0, opgelostMs: null, strafVanaf: null, beschuldigingen: 0 }])),
    gebeurtenissen: [],
  };
  const gesorteerd = antwoorden.filter((a) => a.juist !== null).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr || a.id.localeCompare(b.id));
  const perOpgave = new Map<CluedoSpeler, Map<number, Kaart | null>>();
  for (const a of gesorteerd) {
    const p = t.spelers.get(a.spelerId);
    if (!p) continue;
    const naam = schermNaam(p.speler);
    if (!isActie(a.vraagNr)) {
      if (!a.juist) {
        p.fout++;
        continue;
      }
      p.juist++;
      const kaart = leesBeloning<VraagBeloning>(a.beloning)?.kaart;
      if (kaart && !p.weg.some((k) => k.soort === kaart.soort && k.naam === kaart.naam)) p.weg.push(kaart);
      continue;
    }
    // Cluedo met opgaven: een antwoord op een opgave (als actie, zodat opnieuw proberen altijd kan).
    // Per opgave telt het laatste aanvaarde antwoord (bij meerkeuze mag de leerling wijzigen).
    const op = leesOpgaveAntwoord(a.antwoord);
    if (op) {
      if (!a.juist) {
        p.fout++;
        continue;
      }
      const kaart = leesBeloning<VraagBeloning>(a.beloning)?.kaart ?? null;
      const lijst = perOpgave.get(p) ?? new Map<number, Kaart | null>();
      lijst.delete(op.nr);
      lijst.set(op.nr, kaart);
      perOpgave.set(p, lijst);
      continue;
    }
    const b = leesBeloning<BeschuldigBeloning>(a.beloning);
    if (!b || b.ongeldig) continue;
    p.beschuldigingen++;
    if (b.juist) {
      p.opgelostMs = a.tijdMs;
      t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'opgelost', tekst: `🎉 ${naam} loste de moord op!` });
    } else {
      p.strafVanaf = a.tijdMs;
      t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'fout', tekst: `❌ ${naam} beschuldigde de verkeerde persoon` });
    }
  }
  for (const [p, lijst] of perOpgave) {
    p.juist += lijst.size;
    for (const kaart of lijst.values()) if (kaart && !p.weg.some((k) => k.soort === kaart.soort && k.naam === kaart.naam)) p.weg.push(kaart);
  }
  return t;
}

const beoordeeld = (a: LiveAntwoord, juist: boolean, beloning: unknown): Beoordeling => ({ id: a.id, juist, punten: 0, beloning: beloning === null ? null : JSON.stringify(beloning) });

/** Kijkt nieuwe antwoorden en beschuldigingen na; elke beslissing houdt rekening met de vorige. */
export function cluedoBeoordelingen(
  vragen: readonly Vraag[],
  thema: CluedoThema,
  oplossing: CluedoOplossing,
  spelers: readonly LiveSpeler[],
  antwoorden: readonly LiveAntwoord[],
  rand: RandomInt = defaultRandomInt,
  strafMs = STRAF_MS,
): Beoordeling[] {
  const lijst = antwoorden.filter((a) => a.juist !== null);
  // Een leerling die net aansloot en nog niet in de lijst staat: later nakijken, niet afkeuren.
  const bekend = new Set(spelers.map((s) => s.id));
  const open = antwoorden.filter((a) => a.juist === null && bekend.has(a.spelerId)).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr);
  const uit: Beoordeling[] = [];
  const foutPer = new Map<string, Map<string, Kaart>>();
  for (const a of open) {
    const p = cluedoToestand(spelers, lijst).spelers.get(a.spelerId);
    let b: Beoordeling;
    if (!p) b = beoordeeld(a, false, null);
    else if (!isActie(a.vraagNr)) {
      const v = vragen[vraagIndex(a.spelerId, a.vraagNr, vragen.length)];
      const juist = !!v && automatischJuist(v, a.antwoord);
      if (!juist) b = beoordeeld(a, false, v ? { oplossing: juistAntwoord(v) } : null);
      else {
        const over = alleKaarten(thema).filter((k) => !inOplossing(k, oplossing) && !p.weg.some((w) => w.soort === k.soort && w.naam === k.naam));
        b = beoordeeld(a, true, { kaart: over.length ? over[rand(over.length)] : null } satisfies VraagBeloning);
      }
    } else if (leesOpgaveAntwoord(a.antwoord)) {
      const op = leesOpgaveAntwoord(a.antwoord)!;
      const v = vragen[op.nr];
      const teVroeg = p.strafVanaf !== null && a.tijdMs - p.strafVanaf < strafMs - 2000;
      if (v && isKeuzeVraag(v)) {
        // Meerkeuze: elk antwoord wordt aanvaard en streept een kaart weg; de leerling ziet niet of het juist was.
        const keuze = Number(op.antwoord);
        const geldig = !teVroeg && p.opgelostMs === null && Number.isInteger(keuze) && keuze >= 0 && keuze < keuzeOpties(v).length;
        // Per leerling vast bij de start (met de oplossing in het zaad: de leerling kan het niet nabootsen).
        if (!foutPer.has(a.spelerId)) foutPer.set(a.spelerId, foutKaarten(thema, vragen, `${a.spelerId}:${oplossing.verdachte}:${oplossing.locatie}:${oplossing.wapen}`));
        b = beoordeeld(a, geldig, geldig ? ({ kaart: kaartVoorKeuze(thema, v, keuze, foutPer.get(a.spelerId)!) } satisfies VraagBeloning) : null);
      } else {
        const juist = !!v && !teVroeg && p.opgelostMs === null && automatischJuist(v, op.antwoord);
        b = beoordeeld(a, juist, juist ? ({ kaart: kaartVanOpgave(thema, v.id) } satisfies VraagBeloning) : null);
      }
    } else {
      const x = leesBeschuldiging(a.antwoord);
      const teVroeg = p.strafVanaf !== null && a.tijdMs - p.strafVanaf < strafMs - 2000;
      if (!x || p.opgelostMs !== null || teVroeg) b = beoordeeld(a, false, { juist: false, ongeldig: true } satisfies BeschuldigBeloning);
      else {
        const juist = x.verdachte === oplossing.verdachte && x.locatie === oplossing.locatie && x.wapen === oplossing.wapen;
        b = beoordeeld(a, juist, { juist } satisfies BeschuldigBeloning);
      }
    }
    uit.push(b);
    lijst.push({ ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null });
  }
  return uit;
}

/** Ranglijst: eerst wie opgelost heeft (snelste eerst), dan wie het meest wegstreepte. */
export function cluedoStand(t: CluedoToestand): StandRij[] {
  return [...t.spelers.values()]
    .map((p) => ({ id: p.speler.id, naam: schermNaam(p.speler), punten: p.weg.length, juist: p.juist, tijdMs: p.opgelostMs }))
    .sort(
      (a, b) =>
        (a.tijdMs ?? Infinity) - (b.tijdMs ?? Infinity) || b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'),
    );
}

