import { useCallback, useEffect, useState } from 'react';
import { VOORBEELDSETS } from '../content/voorbeelden';
import { loadKlassen, loadSessies, loadSets, loadVoorbeelden, saveKlassen, saveSessies, saveSets, saveVoorbeelden } from './storage';
import type { Klas, Sessie, Vragenset } from './types';

/** Voegt voorbeeldsets toe die nog nooit toegevoegd werden. */
function metVoorbeelden(sets: Vragenset[]): Vragenset[] {
  const gezien = new Set(loadVoorbeelden() ?? []);
  const nieuw = VOORBEELDSETS.filter((v) => !gezien.has(v.voorbeeld!) && !sets.some((s) => s.id === v.id));
  return nieuw.length ? [...sets, ...nieuw] : sets;
}

export interface Store {
  sets: Vragenset[];
  klassen: Klas[];
  sessies: Sessie[];
  setSets: (f: (s: Vragenset[]) => Vragenset[]) => void;
  setKlassen: (f: (k: Klas[]) => Klas[]) => void;
  setSessies: (f: (s: Sessie[]) => Sessie[]) => void;
  /** Vervangt of voegt één sessie toe. */
  bewaarSessie: (s: Sessie) => void;
}

export function useStore(): Store {
  const [sets, setSetsState] = useState(() => metVoorbeelden(loadSets()));
  const [klassen, setKlassenState] = useState(loadKlassen);
  const [sessies, setSessiesState] = useState(loadSessies);

  useEffect(() => saveVoorbeelden([...new Set([...(loadVoorbeelden() ?? []), ...VOORBEELDSETS.map((v) => v.voorbeeld!)])]), []);
  useEffect(() => saveSets(sets), [sets]);
  useEffect(() => saveKlassen(klassen), [klassen]);
  useEffect(() => saveSessies(sessies), [sessies]);

  const bewaarSessie = useCallback(
    (s: Sessie) => setSessiesState((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [...all, s])),
    [],
  );

  return { sets, klassen, sessies, setSets: setSetsState, setKlassen: setKlassenState, setSessies: setSessiesState, bewaarSessie };
}

/** Voorbeeldsets (opnieuw) toevoegen, bv. nadat ze gewist werden. */
export function ontbrekendeVoorbeelden(sets: readonly Vragenset[]): Vragenset[] {
  return VOORBEELDSETS.filter((v) => !sets.some((s) => s.id === v.id));
}
