import type { Raadsel, Vraag } from '../lib/types';
import { EINDCODE, slotVraag } from './escape';
import { automatischJuist } from './logic';
import type { Beoordeling, LiveAntwoord } from './types';

/** Het raadsel zoals leerlingen het zien: zonder oplossing en zonder hints; keuzes alfabetisch. */
export interface PubliekRaadsel {
  titel: string;
  verhaal: string;
  kolomTitel: string;
  kolommen: string[];
  categorieen: { naam: string; opties: string[] }[];
  aantalHints: number;
}

/** Een verdiende hint: nummer (vanaf 1) en tekst. */
export interface Hint {
  nr: number;
  tekst: string;
}

const sorteer = (l: readonly string[]) => [...l].sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base', numeric: true }));

export function publiekRaadsel(r: Raadsel): PubliekRaadsel {
  return {
    titel: r.titel,
    verhaal: r.verhaal,
    kolomTitel: r.kolomTitel,
    kolommen: r.kolommen,
    categorieen: r.categorieen.map((c) => ({ naam: c.naam, opties: sorteer(c.oplossing) })),
    aantalHints: r.hints.length,
  };
}

/**
 * Welke hints oefening nr oplevert. De hints worden eerlijk verdeeld over de oefeningen: evenveel
 * oefeningen als hints geeft er één per oefening; minder oefeningen geeft er soms twee.
 */
export function hintsVoorOefening(nr: number, aantalOefeningen: number, aantalHints: number): number[] {
  if (aantalOefeningen <= 0) return [];
  const van = Math.floor((nr * aantalHints) / aantalOefeningen);
  const tot = Math.floor(((nr + 1) * aantalHints) / aantalOefeningen);
  return Array.from({ length: tot - van }, (_, i) => van + i);
}

/** De ingevulde tabel als antwoord: per categorie de gekozen waarde per kolom. */
export const rasterNaarTekst = (raster: readonly (readonly string[])[]) => JSON.stringify(raster);

export function rasterUitTekst(tekst: string): string[][] | null {
  try {
    const r = JSON.parse(tekst) as unknown;
    return Array.isArray(r) && r.every((rij) => Array.isArray(rij) && rij.every((c) => typeof c === 'string')) ? (r as string[][]) : null;
  } catch {
    return null;
  }
}

const gelijk = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'nl', { sensitivity: 'base' }) === 0;

/** Klopt de ingevulde tabel volledig? */
export function rasterJuist(r: Raadsel, raster: readonly (readonly string[])[] | null): boolean {
  return (
    !!raster &&
    r.categorieen.length > 0 &&
    r.categorieen.every((c, ci) => c.oplossing.length > 0 && c.oplossing.every((waarde, k) => gelijk(raster[ci]?.[k] ?? '', waarde)))
  );
}

/** Hints als beloning (tekst in de database). */
export const hintsNaarBeloning = (hints: readonly Hint[]) => JSON.stringify(hints);

export function hintsUitBeloning(beloning: string | null): Hint[] {
  if (!beloning) return [];
  try {
    const h = JSON.parse(beloning) as unknown;
    return Array.isArray(h) ? h.filter((x): x is Hint => typeof x?.nr === 'number' && typeof x?.tekst === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Kijkt alle nog niet beoordeelde pogingen na. Een juiste oefening levert hints op; de tabel
 * (vraagnummer -1) moet volledig kloppen.
 */
export function whodunitBeoordelingen(vragen: readonly Vraag[], raadsel: Raadsel, antwoorden: readonly LiveAntwoord[]): Beoordeling[] {
  return antwoorden
    .filter((a) => a.juist === null)
    .flatMap((a) => {
      if (a.vraagNr === EINDCODE) return [{ id: a.id, juist: rasterJuist(raadsel, rasterUitTekst(a.antwoord)), punten: 0, beloning: null }];
      const v = vragen[slotVraag(a.spelerId, a.vraagNr, vragen)];
      if (!v) return [];
      const juist = automatischJuist(v, a.antwoord);
      const hints = hintsVoorOefening(a.vraagNr, vragen.length, raadsel.hints.length).map((i) => ({ nr: i + 1, tekst: raadsel.hints[i] }));
      return [{ id: a.id, juist, punten: juist ? v.punten : 0, beloning: juist ? hintsNaarBeloning(hints) : null }];
    });
}

/** Wat ontbreekt er nog aan een raadsel om te kunnen spelen? */
export function raadselProblemen(r: Raadsel | undefined): string[] {
  if (!r) return ['Deze vragenset heeft nog geen whodunit-raadsel.'];
  const p: string[] = [];
  if (r.kolommen.length < 2) p.push('Geef minstens twee kolommen.');
  if (r.categorieen.length === 0) p.push('Geef minstens één categorie.');
  for (const c of r.categorieen) {
    if (!c.naam.trim()) p.push('Een categorie heeft geen naam.');
    if (c.oplossing.length !== r.kolommen.length || c.oplossing.some((w) => !w.trim())) p.push(`Vul de oplossing van "${c.naam || 'categorie'}" volledig in.`);
    else if (new Set(c.oplossing.map((w) => w.trim().toLocaleLowerCase('nl'))).size !== c.oplossing.length) p.push(`"${c.naam}" bevat twee keer dezelfde waarde.`);
  }
  if (r.hints.filter((h) => h.trim()).length === 0) p.push('Geef minstens één hint.');
  return p;
}

export function nieuwRaadsel(): Raadsel {
  return {
    titel: 'Wie deed wat?',
    verhaal: '',
    kolomTitel: '',
    kolommen: ['1e', '2e', '3e', '4e'],
    categorieen: [
      { naam: 'Naam', oplossing: ['', '', '', ''] },
      { naam: '', oplossing: ['', '', '', ''] },
    ],
    hints: [],
  };
}
