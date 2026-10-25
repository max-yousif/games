import type { Klas, Sessie, Vragenset } from './types';

const KEYS = {
  sets: 'games.v1.sets',
  klassen: 'games.v1.klassen',
  sessies: 'games.v1.sessies',
  voorbeelden: 'games.v1.voorbeelden',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Opslag niet beschikbaar of vol: de app werkt verder, maar onthoudt niets.
  }
}

export const loadSets = () => read<Vragenset[]>(KEYS.sets) ?? [];
export const saveSets = (s: Vragenset[]) => write(KEYS.sets, s);

export const loadKlassen = () => read<Klas[]>(KEYS.klassen) ?? [];
export const saveKlassen = (k: Klas[]) => write(KEYS.klassen, k);

export const loadSessies = () => read<Sessie[]>(KEYS.sessies) ?? [];
export const saveSessies = (s: Sessie[]) => write(KEYS.sessies, s);

/** Id's van voorbeeldsets die al eens toegevoegd werden (ook als ze daarna gewist zijn). */
export const loadVoorbeelden = () => read<string[]>(KEYS.voorbeelden);
export const saveVoorbeelden = (ids: string[]) => write(KEYS.voorbeelden, ids);
