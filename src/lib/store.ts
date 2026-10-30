import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VOORBEELDSETS } from '../content/voorbeelden';
import { loadEigenaar, loadKlassen, loadSessies, loadSets, loadVoorbeelden, saveEigenaar, saveKlassen, saveSessies, saveSets, saveVoorbeelden } from './storage';
import { isBewaard, ruimOp, telGespeeld as telSpel } from './session';
import type { Klas, Sessie, Vragenset } from './types';
import { useAccount, type Account } from './account';
import { useCloud, vergeetCloud, type Cloud } from './useCloud';

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
  /** Een afgelopen spel meetellen in de statistiek van de vragenset (bij Afsluiten). */
  telGespeeld: (sessieId: string) => void;
  /** Het leerkrachtaccount. */
  account: Account;
  /** Vragensets, klassen en resultaten in de cloud (zolang de leerkracht aangemeld is). */
  cloud: Cloud;
  /** Afmelden; met wissen ook alles van deze browser verwijderen (gedeelde computer). */
  afmelden: (wissen: boolean) => Promise<void>;
}

export function useStore(): Store {
  const [sets, setSetsState] = useState(() => metVoorbeelden(loadSets()));
  const [klassen, setKlassenState] = useState(loadKlassen);
  // Niet-bewaarde spellen die afgelopen zijn of stilliggen, meteen opruimen.
  const [sessies, setSessiesState] = useState(() => ruimOp(loadSessies()));

  useEffect(() => saveVoorbeelden([...new Set([...(loadVoorbeelden() ?? []), ...VOORBEELDSETS.map((v) => v.voorbeeld!)])]), []);
  useEffect(() => saveSets(sets), [sets]);
  useEffect(() => saveKlassen(klassen), [klassen]);
  useEffect(() => saveSessies(sessies), [sessies]);

  // "Resultaten bewaren" op het eindscherm: het spel komt bij de resultaten en telt mee in de
  // statistiek van zijn vragenset (anders niet).
  const sessiesRef = useRef(sessies);
  sessiesRef.current = sessies;
  const telGespeeld = useCallback((id: string) => {
    const s = sessiesRef.current.find((x) => x.id === id);
    if (!s) return;
    if (!s.geteld) setSetsState((all) => telSpel(all, [s]));
    setSessiesState((all) => all.map((x) => (x.id === id ? { ...x, geteld: true, bewaard: true } : x)));
  }, []);

  const bewaarSessie = useCallback(
    (s: Sessie) => setSessiesState((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [...all, s])),
    [],
  );

  const account = useAccount();
  const uid = account.leerkracht?.uid ?? null;
  // Enkel bewaarde spellen gaan naar de cloud; een lopend (nog niet bewaard) spel blijft lokaal staan.
  const zetLokaal = useCallback((l: { sets: Vragenset[]; klassen: Klas[]; sessies: Sessie[] }) => {
    setSetsState(l.sets);
    setKlassenState(l.klassen);
    setSessiesState((oud) => [...l.sessies, ...oud.filter((s) => !isBewaard(s) && !l.sessies.some((x) => x.id === s.id))]);
  }, []);
  const bewaardeSessies = useMemo(() => sessies.filter(isBewaard), [sessies]);

  // De gegevens in deze browser horen bij één account. Meldt een ander account aan, dan begint
  // het leeg en haalt het enkel zijn eigen gegevens uit de cloud (anders zou het die van het vorige
  // account overnemen en opsturen). Gegevens van vóór het aanmelden horen bij het eerste account.
  const [eigenaar, setEigenaar] = useState(loadEigenaar);
  useEffect(() => {
    if (!uid || uid === eigenaar) return;
    if (eigenaar) {
      setSetsState([]);
      setKlassenState([]);
      setSessiesState([]);
    }
    saveEigenaar(uid);
    setEigenaar(uid);
  }, [uid, eigenaar]);
  const cloud = useCloud(uid && uid === eigenaar ? uid : null, { sets, klassen, sessies: bewaardeSessies }, zetLokaal);

  const afmelden = useCallback(
    async (wissen: boolean) => {
      if (uid) vergeetCloud(uid);
      await account.afmelden();
      if (wissen) {
        zetLokaal({ sets: [], klassen: [], sessies: [] });
        setSessiesState([]);
      }
    },
    [uid, account, zetLokaal],
  );

  return { sets, klassen, sessies, setSets: setSetsState, setKlassen: setKlassenState, setSessies: setSessiesState, bewaarSessie, telGespeeld, account, cloud, afmelden };
}

/** Voorbeeldsets (opnieuw) toevoegen, bv. nadat ze gewist werden. */
export function ontbrekendeVoorbeelden(sets: readonly Vragenset[]): Vragenset[] {
  return VOORBEELDSETS.filter((v) => !sets.some((s) => s.id === v.id));
}
