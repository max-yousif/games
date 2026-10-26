import { randomInt as defaultRandomInt, type RandomInt } from '../lib/random';
import type { Vraag } from '../lib/types';
import { automatischJuist, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/**
 * Codekraker (naar Crypto Hack van Blooket): leerlingen beantwoorden vragen in eigen tempo. Na een
 * juist antwoord kiezen ze een kistje met munten, een vermenigvuldiger, een firewall of een kans om
 * te hacken: wie het wachtwoord van een medespeler raadt, steelt een deel van diens munten.
 *
 * Alles gebeurt met de gewone live-antwoorden (escape-modus): vragen krijgen nummers 0, 1, 2 ...
 * (de vragen komen steeds opnieuw), acties (wachtwoord, kistje, doelwit, raden) nummers vanaf
 * ACTIE_BASIS. De laptop van de leerkracht beslist over elke actie; de uitkomst staat in de
 * beloning, zodat de stand altijd opnieuw berekend kan worden uit de antwoorden.
 */

export const ACTIE_BASIS = 10_000;
/** Bovengrens van de nummers (aantal_vragen op de server). */
export const AANTAL_NUMMERS = 20_000;
/** Duur van een firewall (ms). */
export const FIREWALL_MS = 120_000;

export const WOORDEN = ['sinus', 'vector', 'priem', 'matrix', 'pi', 'limiet', 'cosinus', 'fractal'];

export interface CodekrakerInstellingen {
  hacken: boolean;
}

export type Actie =
  | { soort: 'wachtwoord'; woord: string }
  | { soort: 'kist'; vraag: number; keuze: number }
  | { soort: 'doel'; kist: number; doel: string }
  | { soort: 'raad'; doelActie: number; woord: string };

export type Uitkomst = 'munten' | 'x2' | 'x3' | 'firewall' | 'hack' | 'pech';

export interface KistBeloning {
  uitkomst: Uitkomst;
  /** Munten erbij (of eraf bij pech), al vermenigvuldigd. */
  bedrag: number;
}

export interface DoelBeloning {
  doel: string;
  doelNaam: string;
  opties?: string[];
  fout?: 'firewall' | 'geen_wachtwoord' | 'onbekend';
}

export interface RaadBeloning {
  gelukt: boolean;
  bedrag: number;
  doel: string;
  doelNaam: string;
  nieuwWoord?: string;
}

export const isActie = (nr: number) => nr >= ACTIE_BASIS;

/** Welke vraag een leerling bij nummer nr krijgt: elke leerling begint op een andere plaats. */
export function vraagIndex(spelerId: string, nr: number, aantal: number): number {
  let h = 0;
  for (const c of spelerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (nr + (h % aantal)) % aantal;
}

export function leesActie(tekst: string): Actie | null {
  try {
    const a = JSON.parse(tekst) as Actie;
    return a && typeof a === 'object' && 'soort' in a ? a : null;
  } catch {
    return null;
  }
}

export function leesBeloning<T>(b: string | null): T | null {
  if (!b) return null;
  try {
    return JSON.parse(b) as T;
  } catch {
    return null;
  }
}

export interface Gebeurtenis {
  tijdMs: number;
  tekst: string;
  soort: 'hack' | 'mislukt' | 'groot' | 'firewall' | 'pech';
}

export interface SpelerToestand {
  speler: LiveSpeler;
  munten: number;
  juist: number;
  fout: number;
  wachtwoord: string | null;
  firewallTot: number;
  /** Vermenigvuldiger voor het volgende muntenkistje. */
  mult: number;
  /** Vragen die juist waren en nog een kistje opleveren. */
  openKisten: number[];
  /** Kistjes met een hackkans die nog niet gebruikt werd. */
  hackKansen: number[];
  /** Doelwit-acties met wachtwoordopties die nog geraden moeten worden. */
  openDoelen: { nr: number; doel: string }[];
  melding: { tekst: string; tijdMs: number } | null;
}

export interface Toestand {
  spelers: Map<string, SpelerToestand>;
  gebeurtenissen: Gebeurtenis[];
}

const naamVan = (t: Toestand, id: string) => {
  const s = t.spelers.get(id)?.speler;
  return s ? schermNaam(s) : '?';
};
const fmt = (n: number) => n.toLocaleString('nl-BE');

/** Herberekent de stand uit alle beoordeelde antwoorden (in de volgorde waarin ze binnenkwamen). */
export function codekrakerToestand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): Toestand {
  const t: Toestand = {
    spelers: new Map(
      spelers.map((s) => [
        s.id,
        { speler: s, munten: 0, juist: 0, fout: 0, wachtwoord: null, firewallTot: 0, mult: 1, openKisten: [], hackKansen: [], openDoelen: [], melding: null },
      ]),
    ),
    gebeurtenissen: [],
  };
  const gesorteerd = antwoorden.filter((a) => a.juist !== null).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr || a.id.localeCompare(b.id));
  for (const a of gesorteerd) pasToe(t, a);
  return t;
}

function pasToe(t: Toestand, a: LiveAntwoord) {
  const p = t.spelers.get(a.spelerId);
  if (!p) return;
  if (!isActie(a.vraagNr)) {
    if (a.juist) {
      p.juist++;
      p.openKisten.push(a.vraagNr);
    } else p.fout++;
    return;
  }
  if (!a.juist) return;
  const actie = leesActie(a.antwoord);
  if (!actie) return;
  switch (actie.soort) {
    case 'wachtwoord':
      p.wachtwoord = actie.woord;
      break;
    case 'kist': {
      const b = leesBeloning<KistBeloning>(a.beloning);
      p.openKisten = p.openKisten.filter((n) => n !== actie.vraag);
      if (!b) break;
      if (b.uitkomst === 'munten') {
        p.munten += b.bedrag;
        p.mult = 1;
        if (b.bedrag >= 10_000) t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'groot', tekst: `💰 ${schermNaam(p.speler)} vond ${fmt(b.bedrag)} munten!` });
      } else if (b.uitkomst === 'x2' || b.uitkomst === 'x3') p.mult = b.uitkomst === 'x2' ? 2 : 3;
      else if (b.uitkomst === 'firewall') {
        p.firewallTot = a.tijdMs + FIREWALL_MS;
        t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'firewall', tekst: `🛡️ ${schermNaam(p.speler)} zette een firewall op` });
      } else if (b.uitkomst === 'hack') p.hackKansen.push(a.vraagNr);
      else if (b.uitkomst === 'pech') {
        p.munten = Math.max(0, p.munten + b.bedrag);
        if (b.bedrag < 0) t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'pech', tekst: `💸 ${schermNaam(p.speler)} had pech: ${fmt(b.bedrag)}` });
      }
      break;
    }
    case 'doel': {
      const b = leesBeloning<DoelBeloning>(a.beloning);
      if (b?.opties) {
        p.hackKansen = p.hackKansen.filter((n) => n !== actie.kist);
        p.openDoelen.push({ nr: a.vraagNr, doel: b.doel });
      }
      break;
    }
    case 'raad': {
      const b = leesBeloning<RaadBeloning>(a.beloning);
      p.openDoelen = p.openDoelen.filter((o) => o.nr !== actie.doelActie);
      if (!b) break;
      const doel = t.spelers.get(b.doel);
      if (b.gelukt && doel) {
        p.munten += b.bedrag;
        doel.munten = Math.max(0, doel.munten - b.bedrag);
        if (b.nieuwWoord) doel.wachtwoord = b.nieuwWoord;
        doel.melding = { tekst: `🔓 Gehackt door ${schermNaam(p.speler)}: −${fmt(b.bedrag)} munten`, tijdMs: a.tijdMs };
        t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'hack', tekst: `🔓 ${schermNaam(p.speler)} hackte ${naamVan(t, b.doel)}: +${fmt(b.bedrag)}` });
      } else {
        p.munten = Math.max(0, p.munten + b.bedrag);
        if (doel) doel.melding = { tekst: `🛡️ ${schermNaam(p.speler)} probeerde je te hacken, maar raadde fout`, tijdMs: a.tijdMs };
        t.gebeurtenissen.push({ tijdMs: a.tijdMs, soort: 'mislukt', tekst: `❌ ${schermNaam(p.speler)} probeerde ${naamVan(t, b.doel)} te hacken` });
      }
      break;
    }
  }
}

const MUNTEN = [1000, 2500, 5000, 10_000, 25_000];

/** Een kistje openen: kans op munten, vermenigvuldiger, firewall, hackkans of pech. */
export function rolKist(rand: RandomInt, p: SpelerToestand, hacken: boolean): KistBeloning {
  const kansen: [Uitkomst | number, number][] = [
    [MUNTEN[0], 22],
    [MUNTEN[1], 20],
    [MUNTEN[2], 13],
    [MUNTEN[3], 6],
    [MUNTEN[4], 2],
    ['x2', 10],
    ['x3', 4],
    ['firewall', 7],
    ['pech', 4],
    ...(hacken ? [['hack', 12] as [Uitkomst, number]] : []),
  ];
  const totaal = kansen.reduce((t, [, w]) => t + w, 0);
  let r = rand(totaal);
  for (const [u, w] of kansen) {
    if (r < w) {
      if (typeof u === 'number') return { uitkomst: 'munten', bedrag: u * p.mult };
      if (u === 'pech') return { uitkomst: 'pech', bedrag: -Math.round((p.munten * 0.1) / 10) * 10 };
      return { uitkomst: u, bedrag: 0 };
    }
    r -= w;
  }
  return { uitkomst: 'munten', bedrag: MUNTEN[0] * p.mult };
}

function schud<T>(l: readonly T[], rand: RandomInt): T[] {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const beoordeeld = (a: LiveAntwoord, juist: boolean, beloning: unknown): Beoordeling => ({ id: a.id, juist, punten: 0, beloning: beloning === null ? null : JSON.stringify(beloning) });

/**
 * Kijkt nieuwe antwoorden en acties na, in de volgorde waarin ze binnenkwamen. Elke beslissing
 * houdt rekening met de vorige (bv. munten die net gestolen werden).
 */
export function codekrakerBeoordelingen(
  vragen: readonly Vraag[],
  instellingen: CodekrakerInstellingen,
  spelers: readonly LiveSpeler[],
  antwoorden: readonly LiveAntwoord[],
  rand: RandomInt = defaultRandomInt,
): Beoordeling[] {
  const beoordeeldeLijst = antwoorden.filter((a) => a.juist !== null);
  const open = antwoorden.filter((a) => a.juist === null).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr);
  const uit: Beoordeling[] = [];
  for (const a of open) {
    const t = codekrakerToestand(spelers, beoordeeldeLijst);
    const b = beslis(a, t, vragen, instellingen, rand);
    uit.push(b);
    beoordeeldeLijst.push({ ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null });
  }
  return uit;
}

function beslis(a: LiveAntwoord, t: Toestand, vragen: readonly Vraag[], inst: CodekrakerInstellingen, rand: RandomInt): Beoordeling {
  const p = t.spelers.get(a.spelerId);
  if (!p) return beoordeeld(a, false, null);
  if (!isActie(a.vraagNr)) {
    const v = vragen[vraagIndex(a.spelerId, a.vraagNr, vragen.length)];
    const juist = !!v && automatischJuist(v, a.antwoord);
    return beoordeeld(a, juist, juist ? { kist: true } : null);
  }
  const actie = leesActie(a.antwoord);
  if (!actie) return beoordeeld(a, false, null);
  switch (actie.soort) {
    case 'wachtwoord':
      return WOORDEN.includes(actie.woord) ? beoordeeld(a, true, { ok: true }) : beoordeeld(a, false, null);
    case 'kist':
      if (!p.openKisten.includes(actie.vraag)) return beoordeeld(a, false, null);
      return beoordeeld(a, true, rolKist(rand, p, inst.hacken));
    case 'doel': {
      const doel = t.spelers.get(actie.doel);
      if (!p.hackKansen.includes(actie.kist) || !doel || doel.speler.id === p.speler.id) return beoordeeld(a, true, { doel: actie.doel, doelNaam: '?', fout: 'onbekend' } satisfies DoelBeloning);
      const doelNaam = schermNaam(doel.speler);
      if (doel.firewallTot > a.tijdMs) return beoordeeld(a, true, { doel: actie.doel, doelNaam, fout: 'firewall' } satisfies DoelBeloning);
      if (!doel.wachtwoord) return beoordeeld(a, true, { doel: actie.doel, doelNaam, fout: 'geen_wachtwoord' } satisfies DoelBeloning);
      const lokwoorden = schud(
        WOORDEN.filter((w) => w !== doel.wachtwoord),
        rand,
      ).slice(0, 2);
      return beoordeeld(a, true, { doel: actie.doel, doelNaam, opties: schud([doel.wachtwoord, ...lokwoorden], rand) } satisfies DoelBeloning);
    }
    case 'raad': {
      const open = p.openDoelen.find((o) => o.nr === actie.doelActie);
      const doel = open && t.spelers.get(open.doel);
      if (!open || !doel) return beoordeeld(a, false, null);
      const doelNaam = schermNaam(doel.speler);
      if (doel.wachtwoord === actie.woord) {
        // 10 tot 25 % van de munten van het doelwit, afgerond op 10.
        const bedrag = Math.round((doel.munten * (10 + rand(16))) / 100 / 10) * 10;
        const nieuwWoord = schud(
          WOORDEN.filter((w) => w !== doel.wachtwoord),
          rand,
        )[0];
        return beoordeeld(a, true, { gelukt: true, bedrag, doel: open.doel, doelNaam, nieuwWoord } satisfies RaadBeloning);
      }
      // Fout geraden: 5 % van de eigen munten kwijt.
      return beoordeeld(a, true, { gelukt: false, bedrag: -Math.round((p.munten * 0.05) / 10) * 10, doel: open.doel, doelNaam } satisfies RaadBeloning);
    }
  }
}

/** Stand voor het bord en de leerlingen (zonder wachtwoorden). */
export function codekrakerStand(t: Toestand, nuMs: number): StandRij[] {
  return [...t.spelers.values()]
    .map((p) => ({
      id: p.speler.id,
      naam: schermNaam(p.speler),
      punten: p.munten,
      juist: p.juist,
      firewall: p.firewallTot > nuMs,
      mult: p.mult > 1 ? p.mult : undefined,
      melding: p.melding ?? undefined,
    }))
    .sort((a, b) => b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'));
}

/** Het volgende vrije actienummer van een leerling. */
export function volgendeActieNr(eigen: readonly LiveAntwoord[]): number {
  return Math.max(ACTIE_BASIS - 1, ...eigen.map((a) => a.vraagNr)) + 1;
}
