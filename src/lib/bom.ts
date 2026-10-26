import { randomInt as defaultRandomInt, type RandomInt } from './random';
import { beeindig, voegBeurtToe } from './session';
import type { Sessie, Vraag } from './types';

/**
 * Bom doorgeven: het team met de bom beantwoordt vragen tot een antwoord juist is; dan gaat de bom
 * naar het volgende team. De bom ontploft na een verborgen tijd bij het team dat ze dan vasthoudt.
 * Het spel duurt tot alle vragen gesteld zijn; het team met de minste ontploffingen wint.
 */

export type BomTijd = 'kort' | 'normaal' | 'lang';

/** Grenzen van de verborgen tijd per ronde (seconden). */
export const BOM_TIJDEN: Record<BomTijd, { naam: string; min: number; max: number }> = {
  kort: { naam: 'kort (20–45 s)', min: 20, max: 45 },
  normaal: { naam: 'normaal (30–90 s)', min: 30, max: 90 },
  lang: { naam: 'lang (60–120 s)', min: 60, max: 120 },
};

export interface BomToestand {
  /** Aantal ontploffingen per team. */
  ontploffingen: number[];
  /** Team dat de bom vasthoudt. */
  houder: number;
  /** Aantal ontploffingen tot nu (alle teams samen). */
  ronde: number;
  tijd: BomTijd;
}

export function nieuweBom(aantalTeams: number, tijd: BomTijd): BomToestand {
  return { ontploffingen: Array.from({ length: aantalTeams }, () => 0), houder: 0, ronde: 0, tijd };
}

/** Verborgen tijd voor een nieuwe ronde, in milliseconden. */
export function bomTijd(tijd: BomTijd, rand: RandomInt = defaultRandomInt): number {
  const { min, max } = BOM_TIJDEN[tijd];
  return (min + rand(max - min + 1)) * 1000;
}

/** Aantal vragen dat nog niet gesteld werd. */
export function bomVragenOver(s: Sessie): number {
  const gesteld = new Set(s.beurten.map((b) => b.vraagId));
  return s.vraagVolgorde.filter((id) => !gesteld.has(id) && s.vragen.some((v) => v.id === id)).length;
}

/** Antwoord van het team met de bom: juist geeft de bom door, fout niet. Na de laatste vraag is het gedaan. */
export function bomAntwoord(s: Sessie, vraag: Vraag, juist: boolean, leerlingId: string | null = null): Sessie {
  const b = s.bom!;
  const na = voegBeurtToe(s, { vraagId: vraag.id, team: b.houder, leerlingId, juist, punten: juist ? 1 : 0 });
  const verder = { ...na, bom: juist ? { ...b, houder: (b.houder + 1) % b.ontploffingen.length } : b };
  return bomVragenOver(verder) === 0 ? beeindig(verder) : verder;
}

/** De bom ontploft bij de houder; dat team begint ook de volgende ronde. */
export function ontploffing(s: Sessie): Sessie {
  const b = s.bom!;
  return { ...s, bom: { ...b, ontploffingen: b.ontploffingen.map((n, i) => (i === b.houder ? n + 1 : n)), ronde: b.ronde + 1 } };
}

/** Winnaar: minste ontploffingen; bij gelijkstand de meeste juiste antwoorden; anders null (gelijkspel). */
export function bomWinnaar(s: Sessie): number | null {
  const b = s.bom;
  if (!b) return null;
  const juist = b.ontploffingen.map((_, i) => s.beurten.filter((x) => x.team === i && x.juist).length);
  const min = Math.min(...b.ontploffingen);
  const kandidaten = b.ontploffingen.flatMap((n, i) => (n === min ? [i] : []));
  const best = Math.max(...kandidaten.map((i) => juist[i]));
  const winnaars = kandidaten.filter((i) => juist[i] === best);
  return winnaars.length === 1 ? winnaars[0] : null;
}
