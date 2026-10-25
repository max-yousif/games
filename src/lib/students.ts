import { newId } from './ids';
import type { Leerling } from './types';

const KOP = ['naam', 'leerling', 'voornaam', 'achternaam', 'familienaam', 'name', 'klas'];

/**
 * Zet geplakte tekst (uit Excel of Smartschool) om naar namen.
 * Eén leerling per lijn; meerdere kolommen (tab of ;) worden samengevoegd met een spatie,
 * zodat "Voornaam<tab>Achternaam" gewoon werkt. Een titelrij wordt overgeslagen.
 */
export function parseNamen(text: string): string[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|;/).map((c) => c.trim()).filter(Boolean))
    .filter((cells) => cells.length > 0);
  return rijenNaarNamen(rows);
}

/** Rijen (uit een bestand of plakken) naar namen; de eerste rij mag een titelrij zijn. */
export function rijenNaarNamen(rows: readonly (readonly string[])[]): string[] {
  if (rows.length === 0) return [];
  const isKop = rows[0].every((c) => KOP.includes(c.replace(/\(.*?\)/g, '').trim().toLocaleLowerCase('nl')));
  const data = isKop ? rows.slice(1) : rows;
  return data.map((cells) => cells.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export function naarLeerlingen(namen: readonly string[]): Leerling[] {
  return namen.map((naam) => ({ id: newId(), naam }));
}

export function sorteerOpNaam(leerlingen: readonly Leerling[]): Leerling[] {
  return [...leerlingen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }));
}
