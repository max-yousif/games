import { randomInt as standaardRandom, type RandomInt } from '../lib/random';
import type { Vraag } from '../lib/types';
import { functieVan } from '../lib/wiskunde';
import { schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/**
 * Grafiekjacht: elke ronde een doelgrafiek a·f(b(x − c)) + d. De leerling typt een voorschrift en
 * ziet de eigen grafiek over de doelgrafiek; de laptop van de leerkracht kijkt na door beide
 * grafieken in het venster te vergelijken. De leerlingen krijgen enkel punten van de doelgrafiek,
 * nooit het voorschrift. Vraagnummer = ronde (0, 1, 2 ...); opnieuw proberen mag tot het juist is.
 */

export const VENSTER = { xMin: -8, xMax: 8, yMin: -6, yMax: 6 } as const;
/** Waar de doelgrafiek bemonsterd wordt (om de 0,1). */
export const XS = Array.from({ length: 161 }, (_, i) => Math.round((VENSTER.xMin + i * 0.1) * 10) / 10);

export type BasisId = 'kwadraat' | 'derdemacht' | 'wortel' | 'abs' | 'omgekeerd' | 'exp' | 'sin';

export const BASISFUNCTIES: Record<BasisId, { naam: string; latex: (u: string) => string; f: (x: number) => number; even?: boolean }> = {
  kwadraat: { naam: 'x²', latex: (u) => (u === 'x' ? 'x^2' : `(${u})^2`), f: (x) => x * x, even: true },
  derdemacht: { naam: 'x³', latex: (u) => (u === 'x' ? 'x^3' : `(${u})^3`), f: (x) => x * x * x },
  wortel: { naam: '√x', latex: (u) => `\\sqrt{${u}}`, f: Math.sqrt },
  abs: { naam: '|x|', latex: (u) => `\\left|${u}\\right|`, f: Math.abs, even: true },
  omgekeerd: { naam: '1/x', latex: (u) => `\\frac{1}{${u}}`, f: (x) => 1 / x },
  exp: { naam: '2ˣ', latex: (u) => `2^{${u}}`, f: (x) => 2 ** x },
  sin: { naam: 'sin x', latex: (u) => `\\sin(${u})`, f: Math.sin },
};
export const BASIS_IDS = Object.keys(BASISFUNCTIES) as BasisId[];

export type Transformatie = 'verschuiven' | 'uitrekken' | 'spiegelen' | 'horizontaal';
export const TRANSFORMATIES: { id: Transformatie; naam: string }[] = [
  { id: 'verschuiven', naam: 'Verschuiven (c, d)' },
  { id: 'uitrekken', naam: 'Verticaal uitrekken (a)' },
  { id: 'spiegelen', naam: 'Spiegelen' },
  { id: 'horizontaal', naam: 'Horizontaal uitrekken (b)' },
];

/** Een doelgrafiek: a·f(b(x − c)) + d. */
export interface Doel {
  basis: BasisId;
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Wat de leerlingen krijgen: per ronde de basisfunctie en de punten van de doelgrafiek. */
export interface GrafiekjachtPubliek {
  versie: 1;
  doelen: { basis: BasisId; y: (number | null)[] }[];
}

export const OVERSLAAN = '⏭';
/** Na zoveel foute pogingen mag de leerling de oplossing zien en verdergaan. */
export const POGINGEN_VOOR_OVERSLAAN = 2;

export const functieVanDoel = (d: Doel) => (x: number) => d.a * BASISFUNCTIES[d.basis].f(d.b * (x - d.c)) + d.d;

const getal = (n: number) => (n === 0.5 ? '\\frac{1}{2}' : n === -0.5 ? '-\\frac{1}{2}' : String(n));

/** Het voorschrift in LaTeX, bv. -2(x-3)^2+1. */
export function voorschrift(d: Doel): string {
  const verschil = d.c === 0 ? 'x' : d.c > 0 ? `x-${d.c}` : `x+${-d.c}`;
  const binnen =
    d.b === 1 ? verschil : d.b === -1 ? (d.c === 0 ? '-x' : `-(${verschil})`) : d.c === 0 ? `${getal(d.b)}x` : `${getal(d.b)}(${verschil})`;
  const f = BASISFUNCTIES[d.basis].latex(binnen);
  const voor = d.a === 1 ? f : d.a === -1 ? `-${f}` : `${getal(d.a)}${d.basis === 'omgekeerd' || d.basis === 'exp' ? '\\cdot' : ''}${f}`;
  return d.d === 0 ? voor : `${voor}${d.d > 0 ? '+' : '-'}${Math.abs(d.d)}`;
}

/** De doelgrafiek bemonsterd; null waar ze niet bestaat of ver buiten het venster ligt. */
export function bemonster(f: (x: number) => number): (number | null)[] {
  return XS.map((x) => {
    const y = f(x);
    return Number.isFinite(y) && Math.abs(y) < 60 ? Math.round(y * 100) / 100 : null;
  });
}

const zichtbaar = (ys: (number | null)[]) => ys.filter((y) => y !== null && y >= VENSTER.yMin && y <= VENSTER.yMax).length;

const kies = <T>(lijst: readonly T[], r: RandomInt) => lijst[r(lijst.length)];

/** Eén willekeurige doelgrafiek met de gekozen transformaties (minstens één doet iets). */
export function maakDoel(basissen: readonly BasisId[], transformaties: readonly Transformatie[], r: RandomInt = standaardRandom): Doel {
  for (let poging = 0; ; poging++) {
    const basis = kies(basissen, r);
    let a = 1;
    let b = 1;
    let c = 0;
    let d = 0;
    if (transformaties.includes('verschuiven')) {
      c = r(9) - 4;
      d = r(7) - 3;
    }
    if (transformaties.includes('uitrekken')) a = kies([1, 2, 3, 0.5], r);
    if (transformaties.includes('horizontaal')) b = kies([1, 2, 0.5], r);
    if (transformaties.includes('spiegelen') && r(2) === 0) {
      // Bij een even functie verandert spiegelen om de y-as niets: dan om de x-as.
      if (BASISFUNCTIES[basis].even || r(2) === 0) a = -a;
      else b = -b;
    }
    const doel = { basis, a, b, c, d };
    const ys = bemonster(functieVanDoel(doel));
    const iets = a !== 1 || b !== 1 || c !== 0 || d !== 0;
    // Genoeg van de grafiek in beeld; na veel pogingen de eerste goede nemen.
    if ((iets || transformaties.length === 0) && zichtbaar(ys) >= (poging < 40 ? 40 : 10)) return doel;
    if (poging > 200) return { basis, a: 1, b: 1, c: 0, d: 0 };
  }
}

/** Een reeks doelgrafieken; twee na elkaar zijn nooit dezelfde. */
export function maakDoelen(aantal: number, basissen: readonly BasisId[], transformaties: readonly Transformatie[], r: RandomInt = standaardRandom): Doel[] {
  const doelen: Doel[] = [];
  while (doelen.length < aantal) {
    const d = maakDoel(basissen, transformaties, r);
    if (voorschrift(d) !== (doelen.at(-1) && voorschrift(doelen.at(-1)!))) doelen.push(d);
  }
  return doelen;
}

export function publiek(doelen: readonly Doel[]): GrafiekjachtPubliek {
  return { versie: 1, doelen: doelen.map((d) => ({ basis: d.basis, y: bemonster(functieVanDoel(d)) })) };
}

/** De rondes als vragen (voor de resultaten en de export). */
export function alsVragen(doelen: readonly Doel[]): Vraag[] {
  return doelen.map((d, i) => ({
    id: `grafiek-${i + 1}`,
    categorie: BASISFUNCTIES[d.basis].naam,
    punten: 3,
    type: 'open',
    tekst: `Grafiek ${i + 1} (${BASISFUNCTIES[d.basis].naam})`,
    antwoord: `$${voorschrift(d)}$`,
    gelijkwaardig: true,
    opties: [],
    juisteOptie: 0,
    uitleg: '',
  }));
}

// Vergelijken op een iets verschoven rooster: zo valt geen punt precies op een asymptoot.
const CONTROLE = XS.map((x) => x + 0.0137);
const dichtbij = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Is het voorschrift van de leerling dezelfde grafiek als het doel (in het venster)? null = niet te lezen. */
export function zelfdeGrafiek(invoer: string, doel: Doel): boolean | null {
  const g = functieVan(invoer);
  if (!g) return null;
  const f = functieVanDoel(doel);
  let samen = 0;
  let anders = 0;
  for (const x of CONTROLE) {
    const yf = f(x);
    const yg = g(x);
    const bf = Number.isFinite(yf);
    const bg = Number.isFinite(yg);
    if (bf && bg) {
      if (!dichtbij(yf, yg)) return false;
      samen++;
    } else if (bf !== bg) anders++;
  }
  return samen >= 10 && anders <= 3;
}

/** Punten voor een juiste grafiek: 3 bij de eerste poging, 2 bij de tweede, daarna 1. */
export const puntenVoor = (poging: number) => Math.max(1, 4 - poging);

export interface GrafiekBeloning {
  /** Het voorschrift (LaTeX), na een juiste grafiek of na overslaan. */
  oplossing: string;
  overgeslagen?: boolean;
}

/** Alle antwoorden die nog nagekeken moeten worden. */
export function grafiekBeoordelingen(doelen: readonly Doel[], antwoorden: readonly LiveAntwoord[]): Beoordeling[] {
  return antwoorden
    .filter((a) => a.juist === null)
    .map((a) => {
      const doel = doelen[a.vraagNr];
      if (!doel) return { id: a.id, juist: false, punten: 0 };
      const oplossing = voorschrift(doel);
      if (a.antwoord === OVERSLAAN) {
        const fout = antwoorden.filter((x) => x.spelerId === a.spelerId && x.vraagNr === a.vraagNr && x.juist === false).length;
        return fout >= POGINGEN_VOOR_OVERSLAAN
          ? { id: a.id, juist: true, punten: 0, beloning: JSON.stringify({ oplossing, overgeslagen: true } satisfies GrafiekBeloning) }
          : { id: a.id, juist: false, punten: 0 };
      }
      const juist = zelfdeGrafiek(a.antwoord, doel) === true;
      return juist ? { id: a.id, juist, punten: puntenVoor(a.poging), beloning: JSON.stringify({ oplossing } satisfies GrafiekBeloning) } : { id: a.id, juist, punten: 0 };
    });
}

/** Per ronde het afgewerkte antwoord (juist of overgeslagen) van een speler. */
export function afgewerkt(antwoorden: readonly LiveAntwoord[], spelerId: string): Map<number, LiveAntwoord> {
  const m = new Map<number, LiveAntwoord>();
  for (const a of antwoorden) if (a.spelerId === spelerId && a.juist) m.set(a.vraagNr, a);
  return m;
}

/** Ranglijst: punten, dan meeste rondes af, dan wie het eerst zover was. */
export function grafiekStand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): StandRij[] {
  return spelers
    .filter((s) => s.verbonden || antwoorden.some((a) => a.spelerId === s.id))
    .map((s) => {
      const af = [...afgewerkt(antwoorden, s.id).values()];
      return {
        id: s.id,
        naam: schermNaam(s),
        punten: af.reduce((t, a) => t + a.punten, 0),
        juist: af.filter((a) => a.punten > 0).length,
        klaar: af.length,
        tijdMs: af.length ? Math.max(...af.map((a) => a.tijdMs)) : null,
      };
    })
    .sort((x, y) => y.punten - x.punten || y.klaar - x.klaar || (x.tijdMs ?? Infinity) - (y.tijdMs ?? Infinity) || x.naam.localeCompare(y.naam));
}
