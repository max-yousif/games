import { randomInt as defaultRandomInt, type RandomInt } from './random';
import { beeindig, voegBeurtToe } from './session';
import type { Sessie, Vraag } from './types';

/**
 * Bom doorgeven: het team met de bom beantwoordt vragen tot een antwoord juist is; dan gaat de bom
 * naar het volgende team. De bom ontploft na een verborgen tijd: het team dat ze dan vasthoudt,
 * verliest een leven. Het laatste team met levens wint.
 */

export type BomTijd = 'kort' | 'normaal' | 'lang';

/** Grenzen van de verborgen tijd per ronde (seconden). */
export const BOM_TIJDEN: Record<BomTijd, { naam: string; min: number; max: number }> = {
  kort: { naam: 'kort (20–45 s)', min: 20, max: 45 },
  normaal: { naam: 'normaal (30–90 s)', min: 30, max: 90 },
  lang: { naam: 'lang (60–120 s)', min: 60, max: 120 },
};

export interface BomToestand {
  /** Levens per team. */
  levens: number[];
  /** Team dat de bom vasthoudt. */
  houder: number;
  /** Aantal ontploffingen tot nu. */
  ronde: number;
  tijd: BomTijd;
  /** Levens per team bij de start. */
  start: number;
}

export function nieuweBom(aantalTeams: number, levens: number, tijd: BomTijd): BomToestand {
  return { levens: Array.from({ length: aantalTeams }, () => levens), houder: 0, ronde: 0, tijd, start: levens };
}

/** Verborgen tijd voor een nieuwe ronde, in milliseconden. */
export function bomTijd(tijd: BomTijd, rand: RandomInt = defaultRandomInt): number {
  const { min, max } = BOM_TIJDEN[tijd];
  return (min + rand(max - min + 1)) * 1000;
}

const levend = (b: BomToestand) => b.levens.flatMap((l, i) => (l > 0 ? [i] : []));

/** Volgende team met levens na team i. */
export function volgendTeam(b: BomToestand, i: number): number {
  const n = b.levens.length;
  for (let k = 1; k <= n; k++) {
    const j = (i + k) % n;
    if (b.levens[j] > 0) return j;
  }
  return i;
}

/** Antwoord van het team met de bom: juist geeft de bom door, fout niet. */
export function bomAntwoord(s: Sessie, vraag: Vraag, juist: boolean, leerlingId: string | null = null): Sessie {
  const b = s.bom!;
  const na = voegBeurtToe(s, { vraagId: vraag.id, team: b.houder, leerlingId, juist, punten: juist ? 1 : 0 });
  return { ...na, bom: juist ? { ...b, houder: volgendTeam(b, b.houder) } : b };
}

/** De bom ontploft: de houder verliest een leven. Met nog één team over is het spel gedaan. */
export function ontploffing(s: Sessie): Sessie {
  const b = s.bom!;
  const levens = b.levens.map((l, i) => (i === b.houder ? Math.max(0, l - 1) : l));
  const nieuw: BomToestand = { ...b, levens, ronde: b.ronde + 1 };
  // Het getroffen team begint de volgende ronde (als het nog meedoet).
  nieuw.houder = levens[b.houder] > 0 ? b.houder : volgendTeam(nieuw, b.houder);
  const na = { ...s, bom: nieuw };
  return levend(nieuw).length <= 1 ? beeindig(na) : na;
}

/** Winnaar: het enige team met levens, of het team met de meeste levens (null bij gelijkstand). */
export function bomWinnaar(s: Sessie): number | null {
  const b = s.bom;
  if (!b) return null;
  const max = Math.max(...b.levens);
  const besten = b.levens.flatMap((l, i) => (l === max ? [i] : []));
  return besten.length === 1 ? besten[0] : null;
}
