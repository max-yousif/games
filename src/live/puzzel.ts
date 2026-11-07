import { juistAntwoord } from '../lib/questions';
import type { Vraag } from '../lib/types';
import { vastGeschud } from '../lib/vraagtypes';
import { isActie, vraagIndex } from './codekraker';
import { automatischJuist, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/**
 * Puzzel: elk juist antwoord geeft een stukje van een foto; de leerling legt de stukjes op de
 * juiste plaats. Wie alle stukjes heeft en de puzzel volledig juist gelegd heeft, is klaar.
 * Vragen hebben nummers 0, 1, 2 ... (eigen volgorde per leerling, steeds opnieuw, zodat een fout
 * beantwoorde vraag later terugkomt); "klaar" is een actie vanaf ACTIE_BASIS.
 */

export const STUKJES = [9, 12, 16, 20, 25, 30];

/** Wat de leerlingen krijgen (de foto zelf komt apart, één keer). */
export interface PuzzelPubliek {
  versie: 1;
  kolommen: number;
  rijen: number;
  /** Verhouding breedte / hoogte van de foto. */
  verhouding: number;
}

/** Kolommen en rijen voor ongeveer `aantal` stukjes die zo vierkant mogelijk zijn. */
export function raster(aantal: number, verhouding: number): { kolommen: number; rijen: number } {
  let beste = { kolommen: aantal, rijen: 1 };
  let score = Infinity;
  for (let rijen = 1; rijen <= aantal; rijen++) {
    if (aantal % rijen) continue;
    const kolommen = aantal / rijen;
    // Hoe ver de vorm van een stukje van een vierkant ligt.
    const s = Math.abs(Math.log(verhouding / kolommen / (1 / rijen)));
    if (s < score) {
      score = s;
      beste = { kolommen, rijen };
    }
  }
  return beste;
}

/** In welke volgorde een leerling de stukjes krijgt (vast per leerling). */
export const stukVolgorde = (spelerId: string, aantal: number) =>
  vastGeschud(
    Array.from({ length: aantal }, (_, i) => i),
    `puzzel:${spelerId}`,
  );

export interface StukBeloning {
  /** Het verdiende stukje (index in het raster), of null als de leerling ze al allemaal heeft. */
  stuk: number | null;
}

/** "Klaar": waar elk stukje ligt (ligging[plaats] = stukje). */
export interface KlaarActie {
  soort: 'klaar';
  ligging: number[];
}

export function leesKlaar(tekst: string): KlaarActie | null {
  try {
    const a = JSON.parse(tekst) as KlaarActie;
    return a?.soort === 'klaar' && Array.isArray(a.ligging) ? a : null;
  } catch {
    return null;
  }
}

export interface PuzzelSpeler {
  /** Verdiende stukjes, in volgorde. */
  stukjes: number[];
  juist: number;
  /** Tijd (ms sinds de start) waarop de puzzel af was, of null. */
  klaarMs: number | null;
}

export function puzzelToestand(antwoorden: readonly LiveAntwoord[], spelerId: string): PuzzelSpeler {
  const p: PuzzelSpeler = { stukjes: [], juist: 0, klaarMs: null };
  for (const a of [...antwoorden].filter((x) => x.spelerId === spelerId && x.juist).sort((x, y) => x.tijdMs - y.tijdMs || x.vraagNr - y.vraagNr)) {
    if (isActie(a.vraagNr)) {
      p.klaarMs ??= a.tijdMs;
      continue;
    }
    p.juist++;
    const b = a.beloning ? (JSON.parse(a.beloning) as StukBeloning) : null;
    if (b?.stuk !== null && b?.stuk !== undefined && !p.stukjes.includes(b.stuk)) p.stukjes.push(b.stuk);
  }
  return p;
}

const beoordeeld = (a: LiveAntwoord, juist: boolean, punten: number, beloning: unknown): Beoordeling => ({
  id: a.id,
  juist,
  punten,
  beloning: beloning === null ? null : JSON.stringify(beloning),
});

/** Alles wat nog nagekeken moet worden: vragen (juist = volgend stukje) en "klaar". */
export function puzzelBeoordelingen(vragen: readonly Vraag[], antwoorden: readonly LiveAntwoord[], aantal: number): Beoordeling[] {
  const lijst = antwoorden.filter((a) => a.juist !== null);
  const uit: Beoordeling[] = [];
  for (const a of antwoorden.filter((x) => x.juist === null).sort((x, y) => x.tijdMs - y.tijdMs || x.vraagNr - y.vraagNr)) {
    const p = puzzelToestand(lijst, a.spelerId);
    let b: Beoordeling;
    if (isActie(a.vraagNr)) {
      // Klaar = alle stukjes verdiend en elk stukje op zijn plaats.
      const k = leesKlaar(a.antwoord);
      const af = !!k && p.stukjes.length >= aantal && k.ligging.length === aantal && k.ligging.every((s, i) => s === i);
      b = beoordeeld(a, af, 0, null);
    } else {
      const v = vragen[vraagIndex(a.spelerId, a.vraagNr, vragen.length)];
      const juist = !!v && automatischJuist(v, a.antwoord);
      const volgende = stukVolgorde(a.spelerId, aantal).find((s) => !p.stukjes.includes(s)) ?? null;
      b = juist ? beoordeeld(a, true, volgende === null ? 0 : 1, { stuk: volgende } satisfies StukBeloning) : beoordeeld(a, false, 0, v ? { oplossing: juistAntwoord(v) } : null);
    }
    uit.push(b);
    lijst.push({ ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null });
  }
  return uit;
}

/** Ranglijst: wie klaar is (snelste eerst), dan de meeste stukjes. In `punten` het aantal stukjes. */
export function puzzelStand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): StandRij[] {
  return spelers
    .filter((s) => s.verbonden || antwoorden.some((a) => a.spelerId === s.id))
    .map((s) => {
      const p = puzzelToestand(antwoorden, s.id);
      return { id: s.id, naam: schermNaam(s), punten: p.stukjes.length, juist: p.juist, tijdMs: p.klaarMs };
    })
    .sort(
      (a, b) =>
        (a.tijdMs ?? Infinity) - (b.tijdMs ?? Infinity) || b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'),
    );
}
