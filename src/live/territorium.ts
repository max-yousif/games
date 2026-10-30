import { juistAntwoord } from '../lib/questions';
import type { Vraag } from '../lib/types';
import { isActie, leesBeloning, vraagIndex } from './codekraker';
import { automatischJuist, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSessie, LiveSpeler, Oplossing, StandRij } from './types';

/**
 * Territorium: leerlingen beantwoorden vragen in eigen tempo (de vragen komen steeds opnieuw).
 * Elk juist antwoord geeft een tekenbeurt: enkele seconden (instelbaar) om in de eigen kleur zo
 * snel mogelijk gebied in te kleuren op een gedeeld veld (ook over andermans gebied). Met een reeks
 * juiste antwoorden na elkaar wordt het penseel groter. Wie op het einde het meeste gebied heeft, wint.
 *
 * Zoals bij Crypto Hack: vragen hebben nummers 0, 1, 2 ..., tekenbeurten nummers vanaf
 * ACTIE_BASIS. De laptop van de leerkracht kijkt na, schildert het veld en stuurt het (gecomprimeerd)
 * naar iedereen.
 */

export const BREEDTE = 80;
export const HOOGTE = 50;
/** Keuzes voor de tekentijd per beurt (seconden). */
export const TEKENTIJDEN = [2, 3, 5, 8];
export const STANDAARD_SECONDEN = 3;
/**
 * Hoe snel het penseel mag bewegen (vakjes per seconde): wie sneller sleept, ziet het penseel
 * achterna komen. Zo kan niemand in één beurt het halve veld inkleuren.
 */
export const SNELHEID = 25;
/** De langste lijn die het bord aanvaardt voor een beurt van `seconden` (met wat marge). */
export const maxLengte = (seconden: number) => SNELHEID * seconden * 1.3 + 3;

/** Iedereen tegen iedereen (meeste gebied wint) of samen één tekening inkleuren. */
export type TerritoriumModus = 'strijd' | 'samen';
/** Maximale lengte van een gecodeerde tekening (het hele antwoord mag hoogstens 2000 tekens zijn). */
export const MAX_TEKENS = 1900;

/** Duidelijk verschillende kleuren; kleur 0 = eerste speler. */
export const KLEUREN = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
  '#dcbeff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ffe119',
  '#e6beff', '#1abc9c', '#ff6f61', '#6b5b95', '#88b04b', '#f7cac9', '#92a8d1', '#955251', '#b565a7', '#009b77',
];

/** Penseelstraal (in vakjes) bij een reeks van `reeks` juiste antwoorden na elkaar: van een lijn van 1 vakje breed tot 5 breed. */
const PENSELEN = [0.5, 0.75, 1, 1.5, 2, 2.5];
export function penseel(reeks: number): number {
  return PENSELEN[Math.min(PENSELEN.length, Math.max(1, reeks)) - 1];
}

export interface Tekening {
  soort: 'teken';
  /** Vraagnummer waarmee de tekenbeurt verdiend werd. */
  vraag: number;
  /** Lijnen als reeksen punten (vakjes, gecodeerd met codeerLijnen). */
  lijnen: string;
}

export interface VraagBeloning {
  teken: true;
  penseel: number;
  reeks: number;
}

// ---------- Coderen ----------

const cijfer = (n: number) => Math.max(0, Math.min(1295, Math.round(n))).toString(36).padStart(2, '0');
/** Stapjes tussen twee punten (-3 tot 3 vakjes in x en y) als één teken. */
const STAPPEN = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLM';
const vak = (n: number, max: number) => Math.max(0, Math.min(max - 1, Math.floor(n)));

/**
 * Lijnen (punten in vakjes) als korte tekst, zodat ook een snelle, lange tekening past: per lijn
 * het beginvakje (4 tekens) en daarna één teken per stapje naar een buurvakje. De punten komen
 * terug als middens van de vakjes, op het bord en op de laptop precies hetzelfde.
 */
export function codeerLijnen(lijnen: [number, number][][]): string {
  const delen = lijnen
    .filter((l) => l.length)
    .map((l) => {
      let x = vak(l[0][0], BREEDTE);
      let y = vak(l[0][1], HOOGTE);
      let tekst = cijfer(x) + cijfer(y);
      for (const [px, py] of l.slice(1)) {
        const nx = vak(px, BREEDTE);
        const ny = vak(py, HOOGTE);
        // Grote sprongen in stapjes van hoogstens 3 vakjes.
        const n = Math.ceil(Math.max(Math.abs(nx - x), Math.abs(ny - y)) / 3);
        const bx = x;
        const by = y;
        for (let k = 1; k <= n; k++) {
          const tx = Math.round(bx + ((nx - bx) * k) / n);
          const ty = Math.round(by + ((ny - by) * k) / n);
          tekst += STAPPEN[(tx - x + 3) * 7 + (ty - y + 3)];
          x = tx;
          y = ty;
        }
      }
      return tekst;
    });
  return `v2:${delen.join('|')}`;
}

export function leesLijnen(tekst: string): [number, number][][] {
  if (!tekst.startsWith('v2:')) return leesOudeLijnen(tekst);
  return tekst
    .slice(3)
    .split('|')
    .filter((l) => l.length >= 4)
    .map((l) => {
      let x = parseInt(l.slice(0, 2), 36);
      let y = parseInt(l.slice(2, 4), 36);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
      const punten: [number, number][] = [[x + 0.5, y + 0.5]];
      for (const c of l.slice(4)) {
        const i = STAPPEN.indexOf(c);
        if (i < 0) continue;
        x = vak(x + Math.floor(i / 7) - 3, BREEDTE);
        y = vak(y + (i % 7) - 3, HOOGTE);
        punten.push([x + 0.5, y + 0.5]);
      }
      return punten;
    });
}

/** Tekeningen van vroeger: 4 tekens per punt (halve vakjes). */
function leesOudeLijnen(tekst: string): [number, number][][] {
  return tekst
    .split('|')
    .filter(Boolean)
    .map((l) => {
      const punten: [number, number][] = [];
      for (let i = 0; i + 4 <= l.length; i += 4) {
        const x = parseInt(l.slice(i, i + 2), 36) / 2;
        const y = parseInt(l.slice(i + 2, i + 4), 36) / 2;
        if (Number.isFinite(x) && Number.isFinite(y)) punten.push([x, y]);
      }
      return punten;
    });
}

/** Het veld (kleurnummer + 1 per vakje, 0 = leeg) als run-length tekst: "waarde.aantal" per stuk. */
export function codeerVeld(veld: Uint8Array): string {
  const delen: string[] = [];
  let i = 0;
  while (i < veld.length) {
    let j = i;
    while (j < veld.length && veld[j] === veld[i]) j++;
    delen.push(`${veld[i].toString(36)}.${(j - i).toString(36)}`);
    i = j;
  }
  return delen.join(',');
}

export function leesVeld(tekst: string | null | undefined): Uint8Array {
  const veld = new Uint8Array(BREEDTE * HOOGTE);
  if (!tekst) return veld;
  let i = 0;
  for (const deel of tekst.split(',')) {
    const [v, n] = deel.split('.').map((x) => parseInt(x, 36));
    if (!Number.isFinite(v) || !Number.isFinite(n)) continue;
    veld.fill(v, i, Math.min(veld.length, i + n));
    i += n;
  }
  return veld;
}

/** Het veld op de server: in de kolom "oplossing" (die bij spellen in eigen tempo niet gebruikt wordt). */
export const veldVan = (s: Pick<LiveSessie, 'oplossing'>): string | null => (s.oplossing as unknown as { veld?: string } | null)?.veld ?? null;
export const alsOplossing = (veld: string) => ({ veld }) as unknown as Oplossing;

// ---------- Schilderen ----------

/**
 * Kleurt de lijnen in op het veld met kleur `waarde` en penseelstraal `straal`, tot een totale
 * lijnlengte van `lengte` vakjes. Met een `masker` (samen inkleuren) enkel lege vakjes binnen de
 * tekening. Geeft het aantal geverfde vakjes terug.
 */
export function schilder(veld: Uint8Array, lijnen: [number, number][][], straal: number, waarde: number, lengte = Infinity, masker: Uint8Array | null = null): number {
  let inkt = lengte;
  let geverfd = 0;
  const r2 = straal * straal + 0.25;
  const stempel = (cx: number, cy: number) => {
    const x0 = Math.max(0, Math.floor(cx - straal));
    const x1 = Math.min(BREEDTE - 1, Math.ceil(cx + straal));
    const y0 = Math.max(0, Math.floor(cy - straal));
    const y1 = Math.min(HOOGTE - 1, Math.ceil(cy + straal));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const i = y * BREEDTE + x;
        if (dx * dx + dy * dy <= r2 && veld[i] !== waarde && (!masker || (masker[i] && veld[i] === 0))) {
          veld[i] = waarde;
          geverfd++;
        }
      }
  };
  for (const lijn of lijnen) {
    if (inkt <= 0 || lijn.length === 0) break;
    stempel(lijn[0][0], lijn[0][1]);
    for (let i = 1; i < lijn.length && inkt > 0; i++) {
      const [ax, ay] = lijn[i - 1];
      const [bx, by] = lijn[i];
      const lengte = Math.min(Math.hypot(bx - ax, by - ay), inkt);
      const stappen = Math.max(1, Math.ceil(lengte / 0.4));
      const totaal = Math.hypot(bx - ax, by - ay) || 1;
      for (let s = 1; s <= stappen; s++) {
        const f = ((lengte / totaal) * s) / stappen;
        stempel(ax + (bx - ax) * f, ay + (by - ay) * f);
      }
      inkt -= lengte;
    }
  }
  return geverfd;
}

// ---------- Toestand ----------

export interface TerritoriumSpeler {
  speler: LiveSpeler;
  kleur: number;
  juist: number;
  fout: number;
  /** Juiste antwoorden na elkaar (0 na een fout antwoord). */
  reeks: number;
  besteReeks: number;
  /** Tekenbeurten die nog niet gebruikt werden: vraagnummer en penseel. */
  beurten: { vraag: number; penseel: number }[];
  vakjes: number;
}

export interface TerritoriumOpties {
  /** Tekentijd per beurt: bepaalt de langste lijn (zonder: geen grens, zoals vroeger). */
  seconden?: number;
  /** Samen inkleuren: de vakjes van de tekening. */
  masker?: Uint8Array | null;
}

export interface TerritoriumToestand {
  veld: Uint8Array;
  spelers: Map<string, TerritoriumSpeler>;
}

/** Herberekent veld en stand uit alle beoordeelde antwoorden, in de volgorde waarin ze binnenkwamen. */
export function territoriumToestand(
  spelers: readonly LiveSpeler[],
  antwoorden: readonly LiveAntwoord[],
  kleuren: Record<string, number>,
  opties: TerritoriumOpties = {},
): TerritoriumToestand {
  const t: TerritoriumToestand = {
    veld: new Uint8Array(BREEDTE * HOOGTE),
    spelers: new Map(spelers.map((s) => [s.id, { speler: s, kleur: kleuren[s.id] ?? 0, juist: 0, fout: 0, reeks: 0, besteReeks: 0, beurten: [], vakjes: 0 }])),
  };
  const gesorteerd = antwoorden.filter((a) => a.juist !== null).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr || a.id.localeCompare(b.id));
  for (const a of gesorteerd) {
    const p = t.spelers.get(a.spelerId);
    if (!p) continue;
    if (!isActie(a.vraagNr)) {
      if (a.juist) {
        p.juist++;
        p.reeks++;
        p.besteReeks = Math.max(p.besteReeks, p.reeks);
        p.beurten.push({ vraag: a.vraagNr, penseel: leesBeloning<VraagBeloning>(a.beloning)?.penseel ?? penseel(p.reeks) });
      } else {
        p.fout++;
        p.reeks = 0;
      }
      continue;
    }
    if (!a.juist) continue;
    const teken = leesTekening(a.antwoord);
    const beurt = teken && p.beurten.find((b) => b.vraag === teken.vraag);
    if (!teken || !beurt) continue;
    p.beurten = p.beurten.filter((b) => b !== beurt);
    schilder(t.veld, leesLijnen(teken.lijnen), beurt.penseel, p.kleur + 1, opties.seconden ? maxLengte(opties.seconden) : Infinity, opties.masker);
  }
  const tel = new Map<number, number>();
  for (const v of t.veld) if (v) tel.set(v, (tel.get(v) ?? 0) + 1);
  for (const p of t.spelers.values()) p.vakjes = tel.get(p.kleur + 1) ?? 0;
  return t;
}

export function leesTekening(tekst: string): Tekening | null {
  try {
    const a = JSON.parse(tekst) as Tekening;
    return a?.soort === 'teken' && typeof a.lijnen === 'string' && Number.isInteger(a.vraag) ? a : null;
  } catch {
    return null;
  }
}

const beoordeeld = (a: LiveAntwoord, juist: boolean, beloning: unknown): Beoordeling => ({ id: a.id, juist, punten: 0, beloning: beloning === null ? null : JSON.stringify(beloning) });

/** Kijkt nieuwe antwoorden en tekeningen na (enkel van leerlingen die in de lijst staan). */
export function territoriumBeoordelingen(
  vragen: readonly Vraag[],
  spelers: readonly LiveSpeler[],
  antwoorden: readonly LiveAntwoord[],
  kleuren: Record<string, number>,
): Beoordeling[] {
  const bekend = new Set(spelers.map((s) => s.id));
  const lijst = antwoorden.filter((a) => a.juist !== null);
  const open = antwoorden.filter((a) => a.juist === null && bekend.has(a.spelerId)).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr);
  const uit: Beoordeling[] = [];
  for (const a of open) {
    const p = territoriumToestand(spelers, lijst, kleuren).spelers.get(a.spelerId)!;
    let b: Beoordeling;
    if (!isActie(a.vraagNr)) {
      const v = vragen[vraagIndex(a.spelerId, a.vraagNr, vragen.length)];
      const juist = !!v && automatischJuist(v, a.antwoord);
      b = beoordeeld(a, juist, juist ? ({ teken: true, reeks: p.reeks + 1, penseel: penseel(p.reeks + 1) } satisfies VraagBeloning) : v ? { oplossing: juistAntwoord(v) } : null);
    } else {
      const teken = leesTekening(a.antwoord);
      const geldig = !!teken && p.beurten.some((x) => x.vraag === teken.vraag) && teken.lijnen.length <= MAX_TEKENS;
      b = beoordeeld(a, geldig, null);
    }
    uit.push(b);
    lijst.push({ ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null });
  }
  return uit;
}

/** Ranglijst: meeste vakjes eerst. In `punten` het aantal vakjes, in `kleur` het kleurnummer. */
export function territoriumStand(t: TerritoriumToestand): StandRij[] {
  return [...t.spelers.values()]
    .map((p) => ({ id: p.speler.id, naam: schermNaam(p.speler), punten: p.vakjes, juist: p.juist, kleur: p.kleur, reeks: p.reeks }))
    .sort((a, b) => b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'));
}

/** Kleuren voor nieuwe spelers: telkens het laagste vrije nummer (bestaande kleuren blijven). */
export function kenKleurenToe(spelers: readonly LiveSpeler[], kleuren: Record<string, number>): Record<string, number> {
  const uit = { ...kleuren };
  const bezet = new Set(Object.values(uit));
  for (const s of [...spelers].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))) {
    if (uit[s.id] !== undefined) continue;
    let k = 0;
    while (bezet.has(k) && k < KLEUREN.length - 1) k++;
    if (bezet.has(k)) k = Object.keys(uit).length % KLEUREN.length;
    uit[s.id] = k;
    bezet.add(k);
  }
  return uit;
}

// ---------- Kleurplaten (samen inkleuren) ----------

type Punt = [number, number];

function inVeelhoek(x: number, y: number, punten: readonly Punt[]): boolean {
  let binnen = false;
  for (let i = 0, j = punten.length - 1; i < punten.length; j = i++) {
    const [xi, yi] = punten[i];
    const [xj, yj] = punten[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen;
  }
  return binnen;
}
const inCirkel = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inRechthoek = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const ster = (cx: number, cy: number, R: number, r: number): Punt[] =>
  Array.from({ length: 10 }, (_, i) => {
    const hoek = -Math.PI / 2 + (i * Math.PI) / 5;
    const straal = i % 2 ? r : R;
    return [cx + straal * Math.cos(hoek), cy + straal * Math.sin(hoek)];
  });
const STER = ster(40, 27, 25, 12);

export interface Kleurplaat {
  id: string;
  naam: string;
  icoon: string;
  /** Ligt het midden van een vakje (x, y in vakjes) in de tekening? */
  binnen: (x: number, y: number) => boolean;
}

export const KLEURPLATEN: Kleurplaat[] = [
  {
    id: 'hart',
    naam: 'Hart',
    icoon: '❤️',
    binnen: (x, y) => {
      const a = (x - 40) / 21;
      const b = (26 - y) / 19;
      return (a * a + b * b - 1) ** 3 - a * a * b ** 3 <= 0;
    },
  },
  { id: 'ster', naam: 'Ster', icoon: '⭐', binnen: (x, y) => inVeelhoek(x, y, STER) },
  {
    id: 'huis',
    naam: 'Huis',
    icoon: '🏠',
    binnen: (x, y) =>
      (inVeelhoek(x, y, [[15, 22], [40, 4], [65, 22]]) || inRechthoek(x, y, 21, 22, 59, 46) || inRechthoek(x, y, 50, 7, 55, 16)) &&
      !inRechthoek(x, y, 26, 27, 33, 34) &&
      !inRechthoek(x, y, 47, 27, 54, 34),
  },
  {
    id: 'vis',
    naam: 'Vis',
    icoon: '🐟',
    binnen: (x, y) =>
      (((x - 34) / 23) ** 2 + ((y - 25) / 15) ** 2 <= 1 || inVeelhoek(x, y, [[53, 25], [72, 9], [66, 25], [72, 41]])) && !inCirkel(x, y, 22, 21, 2.5),
  },
  {
    id: 'raket',
    naam: 'Raket',
    icoon: '🚀',
    binnen: (x, y) =>
      (inRechthoek(x, y, 30, 13, 50, 41) ||
        inVeelhoek(x, y, [[30, 13], [40, 2], [50, 13]]) ||
        inVeelhoek(x, y, [[30, 26], [20, 44], [30, 40]]) ||
        inVeelhoek(x, y, [[50, 26], [60, 44], [50, 40]]) ||
        inVeelhoek(x, y, [[34, 41], [40, 48], [46, 41]])) &&
      !inCirkel(x, y, 40, 21, 4),
  },
  {
    id: 'smiley',
    naam: 'Smiley',
    icoon: '🙂',
    binnen: (x, y) => {
      if (!inCirkel(x, y, 40, 25, 23)) return false;
      if (inCirkel(x, y, 32, 18, 3) || inCirkel(x, y, 48, 18, 3)) return false;
      const d = Math.hypot(x - 40, y - 23);
      return !(y > 27 && d >= 11 && d <= 14.5);
    },
  },
  {
    id: 'boom',
    naam: 'Boom',
    icoon: '🌲',
    binnen: (x, y) =>
      inVeelhoek(x, y, [[40, 2], [25, 17], [55, 17]]) ||
      inVeelhoek(x, y, [[40, 9], [21, 28], [59, 28]]) ||
      inVeelhoek(x, y, [[40, 17], [16, 39], [64, 39]]) ||
      inRechthoek(x, y, 36, 39, 44, 47),
  },
];

export const kleurplaatVan = (id: string | null | undefined): Kleurplaat | null => KLEURPLATEN.find((k) => k.id === id) ?? null;

/** De vakjes van een kleurplaat (1 = in de tekening). */
export function maskerVan(id: string | null | undefined): Uint8Array | null {
  const k = kleurplaatVan(id);
  if (!k) return null;
  const m = new Uint8Array(BREEDTE * HOOGTE);
  for (let y = 0; y < HOOGTE; y++) for (let x = 0; x < BREEDTE; x++) if (k.binnen(x + 0.5, y + 0.5)) m[y * BREEDTE + x] = 1;
  return m;
}

/** Hoeveel vakjes er te kleuren zijn: de tekening, of het hele veld. */
export const aantalVakjes = (masker: Uint8Array | null | undefined) => (masker ? masker.reduce((n, v) => n + v, 0) : BREEDTE * HOOGTE);

/** Ingekleurde vakjes (van wie ook). */
export const gekleurd = (veld: Uint8Array) => veld.reduce((n, v) => n + (v ? 1 : 0), 0);
