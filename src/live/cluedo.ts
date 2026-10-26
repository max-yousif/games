import { randomInt as defaultRandomInt, type RandomInt } from '../lib/random';
import type { CluedoOplossing, CluedoThema, Vraag } from '../lib/types';
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

/** Na een foute beschuldiging even geen vragen of beschuldigingen (ms). */
export const STRAF_MS = 60_000;

export const STANDAARD_THEMA: CluedoThema = {
  titel: 'Moord in de leraarskamer',
  verdachten: ['Professor Pi', 'Mevrouw Sinus', 'Meneer Byte', 'Dokter Fibonacci', 'Juffrouw Vector', 'De conciërge'],
  locaties: ['ICT-lokaal', 'Refter', 'Turnzaal', 'Bibliotheek', 'Labo', 'Leraarskamer', 'Speelplaats', 'Fietsenstalling', 'Secretariaat'],
  wapens: ['Passer', 'Geodriehoek', 'Rekenmachine', 'USB-stick', 'Verlengkabel', 'Wiskundeboek'],
};

/** Wat er mis is met een thema (leeg = in orde). */
export function themaProblemen(t: CluedoThema): string[] {
  const uit: string[] = [];
  for (const s of KAART_SOORTEN) {
    const lijst = t[s];
    const naam = SOORT_NAMEN[s].titel.toLowerCase();
    if (lijst.length < 2) uit.push(`Geef minstens 2 ${naam}.`);
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

export function trekOplossing(t: CluedoThema, rand: RandomInt = defaultRandomInt): CluedoOplossing {
  return { verdachte: t.verdachten[rand(t.verdachten.length)], locatie: t.locaties[rand(t.locaties.length)], wapen: t.wapens[rand(t.wapens.length)] };
}

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
): Beoordeling[] {
  const lijst = antwoorden.filter((a) => a.juist !== null);
  // Een leerling die net aansloot en nog niet in de lijst staat: later nakijken, niet afkeuren.
  const bekend = new Set(spelers.map((s) => s.id));
  const open = antwoorden.filter((a) => a.juist === null && bekend.has(a.spelerId)).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr);
  const uit: Beoordeling[] = [];
  for (const a of open) {
    const p = cluedoToestand(spelers, lijst).spelers.get(a.spelerId);
    let b: Beoordeling;
    if (!p) b = beoordeeld(a, false, null);
    else if (!isActie(a.vraagNr)) {
      const v = vragen[vraagIndex(a.spelerId, a.vraagNr, vragen.length)];
      const juist = !!v && automatischJuist(v, a.antwoord);
      if (!juist) b = beoordeeld(a, false, null);
      else {
        const over = alleKaarten(thema).filter((k) => !inOplossing(k, oplossing) && !p.weg.some((w) => w.soort === k.soort && w.naam === k.naam));
        b = beoordeeld(a, true, { kaart: over.length ? over[rand(over.length)] : null } satisfies VraagBeloning);
      }
    } else {
      const x = leesBeschuldiging(a.antwoord);
      const teVroeg = p.strafVanaf !== null && a.tijdMs - p.strafVanaf < STRAF_MS - 2000;
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

