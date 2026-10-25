import { randomInt as defaultRandomInt, type RandomInt } from '../lib/random';
import type { Vraag } from '../lib/types';
import { automatischJuist, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/** Vraagnummer van de eindcode. */
export const EINDCODE = -1;

/** Geheime code: één cijfer per slot. */
export function maakEscapeCode(aantal: number, rand: RandomInt = defaultRandomInt): string {
  return Array.from({ length: aantal }, () => String(rand(10))).join('');
}

const zonderSpaties = (t: string) => t.replace(/[\s-]/g, '');

/**
 * Kijkt alle nog niet beoordeelde pogingen na. Een juist antwoord op slot i levert het
 * i-de cijfer van de code op; de eindcode (slot -1) moet volledig kloppen.
 */
export function escapeBeoordelingen(vragen: readonly Vraag[], code: string, antwoorden: readonly LiveAntwoord[]): Beoordeling[] {
  return antwoorden
    .filter((a) => a.juist === null)
    .flatMap((a) => {
      if (a.vraagNr === EINDCODE) return [{ id: a.id, juist: zonderSpaties(a.antwoord) === code, punten: 0, beloning: null }];
      const v = vragen[a.vraagNr];
      if (!v) return [];
      const juist = automatischJuist(v, a.antwoord);
      return [{ id: a.id, juist, punten: juist ? v.punten : 0, beloning: juist ? (code[a.vraagNr] ?? null) : null }];
    });
}

export interface EscapeVoortgang {
  speler: LiveSpeler;
  /** Opgeloste sloten. */
  opgelost: Set<number>;
  /** Aantal foute pogingen per slot. */
  fout: Map<number, number>;
  /** Sloten met een poging die nog nagekeken wordt. */
  bezig: Set<number>;
  /** Tijd tot ontsnappen in ms, of null. */
  ontsnaptMs: number | null;
  /** Tijd van het laatst geopende slot (voor de rangschikking bij gelijke stand). */
  laatsteMs: number;
}

export function escapeVoortgang(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): EscapeVoortgang[] {
  return spelers
    .map((speler) => {
      const eigen = antwoorden.filter((a) => a.spelerId === speler.id);
      const opgelost = new Set<number>();
      const fout = new Map<number, number>();
      const bezig = new Set<number>();
      let ontsnaptMs: number | null = null;
      let laatsteMs = 0;
      for (const a of eigen) {
        if (a.juist === null) bezig.add(a.vraagNr);
        else if (a.juist && a.vraagNr === EINDCODE) ontsnaptMs = a.tijdMs;
        else if (a.juist) {
          opgelost.add(a.vraagNr);
          laatsteMs = Math.max(laatsteMs, a.tijdMs);
        } else fout.set(a.vraagNr, (fout.get(a.vraagNr) ?? 0) + 1);
      }
      return { speler, opgelost, fout, bezig, ontsnaptMs, laatsteMs };
    })
    .sort(
      (a, b) =>
        (a.ontsnaptMs ?? Infinity) - (b.ontsnaptMs ?? Infinity) ||
        b.opgelost.size - a.opgelost.size ||
        a.laatsteMs - b.laatsteMs ||
        a.speler.naam.localeCompare(b.speler.naam, 'nl'),
    );
}

/** Stand voor de leerlingen: wie ontsnapt is eerst (snelste eerst), daarna het aantal open sloten. */
export function escapeStand(voortgang: readonly EscapeVoortgang[]): StandRij[] {
  return voortgang.map((v) => ({ id: v.speler.id, naam: schermNaam(v.speler), punten: v.opgelost.size, juist: v.opgelost.size, tijdMs: v.ontsnaptMs }));
}
