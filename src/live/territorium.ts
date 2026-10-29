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
/** Keuzes voor de tekentijd per beurt (seconden); spellen van vroeger hadden 3 seconden. */
export const TEKENTIJDEN = [3, 5, 8, 10];
export const STANDAARD_SECONDEN = 5;
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
 * lijnlengte van `maxLengte` vakjes. Geeft het aantal geverfde vakjes terug.
 */
export function schilder(veld: Uint8Array, lijnen: [number, number][][], straal: number, waarde: number, maxLengte = Infinity): number {
  let inkt = maxLengte;
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
        if (dx * dx + dy * dy <= r2 && veld[y * BREEDTE + x] !== waarde) {
          veld[y * BREEDTE + x] = waarde;
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

export interface TerritoriumToestand {
  veld: Uint8Array;
  spelers: Map<string, TerritoriumSpeler>;
}

/** Herberekent veld en stand uit alle beoordeelde antwoorden, in de volgorde waarin ze binnenkwamen. */
export function territoriumToestand(
  spelers: readonly LiveSpeler[],
  antwoorden: readonly LiveAntwoord[],
  kleuren: Record<string, number>,
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
    schilder(t.veld, leesLijnen(teken.lijnen), beurt.penseel, p.kleur + 1);
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
      b = beoordeeld(a, juist, juist ? ({ teken: true, reeks: p.reeks + 1, penseel: penseel(p.reeks + 1) } satisfies VraagBeloning) : null);
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
