import type { Klas, Sessie, Vragenset } from './types';

const SOORT = 'games-backup';
const SOORT_SET = 'games-vragenset';

export interface Backup {
  soort: typeof SOORT;
  versie: 1;
  gemaakt: string;
  sets: Vragenset[];
  klassen: Klas[];
  sessies: Sessie[];
}

export class BackupError extends Error {}

export function maakBackup(sets: Vragenset[], klassen: Klas[], sessies: Sessie[]): Backup {
  return { soort: SOORT, versie: 1, gemaakt: new Date().toISOString(), sets, klassen, sessies };
}

export function setBestand(set: Vragenset) {
  return { soort: SOORT_SET, versie: 1 as const, set };
}

export type Ingelezen = { soort: 'backup'; backup: Backup } | { soort: 'set'; set: Vragenset };

/** Leest een back-up of een losse vragenset; gooit een BackupError bij een ongeldig bestand. */
export function leesBestand(text: string): Ingelezen {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Dit is geen geldig back-upbestand.');
  }
  const d = data as Partial<Backup> & { set?: Vragenset };
  if (d.soort === SOORT && Array.isArray(d.sets) && Array.isArray(d.klassen) && Array.isArray(d.sessies)) {
    return { soort: 'backup', backup: d as Backup };
  }
  if ((d.soort as string) === SOORT_SET && d.set && Array.isArray(d.set.vragen)) {
    return { soort: 'set', set: d.set };
  }
  throw new BackupError('Dit bestand bevat geen vragensets of back-up van deze website.');
}

/** Voegt items samen op id: bestaande items worden vervangen door de versie uit het bestand. */
export function voegSamen<T extends { id: string }>(bestaand: readonly T[], nieuw: readonly T[]): T[] {
  const ids = new Set(nieuw.map((n) => n.id));
  return [...bestaand.filter((b) => !ids.has(b.id)), ...nieuw];
}

export function downloadJson(bestandsnaam: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Veilige bestandsnaam op basis van een titel. */
export function bestandsnaam(titel: string, ext: string): string {
  const basis = titel
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${basis || 'bestand'}.${ext}`;
}
