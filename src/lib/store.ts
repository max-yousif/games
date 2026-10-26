import { useCallback, useEffect, useRef, useState } from 'react';
import { VOORBEELDSETS } from '../content/voorbeelden';
import { loadKlassen, loadSessies, loadSets, loadVoorbeelden, saveKlassen, saveSessies, saveSets, saveVoorbeelden } from './storage';
import { telGespeeld } from './session';
import type { Klas, Sessie, Vragenset } from './types';
import { useAccount, type Account } from './account';
import { useCloud, vergeetCloud, type Cloud } from './useCloud';

/** Id van het spel dat nu open staat (#/sessie/...), of null. */
const huidigSpel = () => /#\/sessie\/([^/?]+)/.exec(window.location.hash)?.[1] ?? null;

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
  const [sessies, setSessiesState] = useState(loadSessies);

  useEffect(() => saveVoorbeelden([...new Set([...(loadVoorbeelden() ?? []), ...VOORBEELDSETS.map((v) => v.voorbeeld!)])]), []);
  useEffect(() => saveSets(sets), [sets]);
  useEffect(() => saveKlassen(klassen), [klassen]);
  useEffect(() => saveSessies(sessies), [sessies]);

  // Afgelopen spellen meetellen in de statistiek van hun vragenset, zodra het spel niet meer open
  // staat (zo telt "Afsluiten zonder opslaan" niet mee: dat wist het spel vóór het geteld wordt).
  const [openSpel, setOpenSpel] = useState(huidigSpel);
  useEffect(() => {
    const bij = () => setOpenSpel(huidigSpel());
    window.addEventListener('hashchange', bij);
    return () => window.removeEventListener('hashchange', bij);
  }, []);
  const geteld = useRef(new Set<string>());
  useEffect(() => {
    const nieuw = sessies.filter((s) => s.beeindigd && !s.geteld && s.id !== openSpel && !geteld.current.has(s.id));
    if (nieuw.length === 0) return;
    for (const s of nieuw) geteld.current.add(s.id);
    setSetsState((all) => telGespeeld(all, nieuw));
    setSessiesState((all) => all.map((s) => (nieuw.some((n) => n.id === s.id) ? { ...s, geteld: true } : s)));
  }, [sessies, openSpel]);

  const bewaarSessie = useCallback(
    (s: Sessie) => setSessiesState((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [...all, s])),
    [],
  );

  const account = useAccount();
  const uid = account.leerkracht?.uid ?? null;
  const zetLokaal = useCallback((l: { sets: Vragenset[]; klassen: Klas[]; sessies: Sessie[] }) => {
    setSetsState(l.sets);
    setKlassenState(l.klassen);
    setSessiesState(l.sessies);
  }, []);
  const cloud = useCloud(uid, { sets, klassen, sessies }, zetLokaal);

  const afmelden = useCallback(
    async (wissen: boolean) => {
      if (uid) vergeetCloud(uid);
      await account.afmelden();
      if (wissen) zetLokaal({ sets: [], klassen: [], sessies: [] });
    },
    [uid, account, zetLokaal],
  );

  return { sets, klassen, sessies, setSets: setSetsState, setKlassen: setKlassenState, setSessies: setSessiesState, bewaarSessie, account, cloud, afmelden };
}

/** Voorbeeldsets (opnieuw) toevoegen, bv. nadat ze gewist werden. */
export function ontbrekendeVoorbeelden(sets: readonly Vragenset[]): Vragenset[] {
  return VOORBEELDSETS.filter((v) => !sets.some((s) => s.id === v.id));
}
