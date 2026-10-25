import { useCallback, useEffect, useState } from 'react';
import { cloud } from '../live/config';
import { LiveFout } from '../live/types';

const SLEUTEL = 'games.v1.leerkracht';

export interface Leerkracht {
  uid: string;
  naam: string;
}

/** Gebruikersnaam → e-mailadres in Supabase. Een echt e-mailadres mag ook. */
export function naarEmail(invoer: string): string {
  const v = invoer.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@klasspelen.local`;
}

function lees(): Leerkracht | null {
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL) ?? 'null') as Leerkracht | null;
  } catch {
    return null;
  }
}

function bewaar(l: Leerkracht | null) {
  try {
    if (l) localStorage.setItem(SLEUTEL, JSON.stringify(l));
    else localStorage.removeItem(SLEUTEL);
  } catch {
    // geen opslag: aangemeld tot de pagina sluit
  }
}

/** Naam uit de tabel leerkrachten, of null als deze gebruiker geen leerkracht is. */
async function leerkrachtNaam(uid: string): Promise<string | null> {
  const c = cloud();
  if (!c) return null;
  const { data, error } = await (await c.sb()).from('leerkrachten').select('naam').eq('uid', uid).maybeSingle();
  if (error) throw new LiveFout(error.code === '42P01' || error.code === 'PGRST205' ? 'schema_oud' : 'verbinding');
  return data?.naam ?? null;
}

export interface Account {
  /** Supabase ingesteld? */
  beschikbaar: boolean;
  leerkracht: Leerkracht | null;
  aanmelden(naam: string, wachtwoord: string): Promise<void>;
  afmelden(): Promise<void>;
}

/**
 * Het leerkrachtaccount. Aanmelden kan met een gebruikersnaam (bv. maxyousif) of een e-mailadres;
 * enkel gebruikers die in de tabel leerkrachten staan, worden aanvaard.
 */
export function useAccount(): Account {
  const c = cloud();
  const [leerkracht, setLeerkracht] = useState<Leerkracht | null>(() => (c ? lees() : null));

  const zet = useCallback((l: Leerkracht | null) => {
    bewaar(l);
    setLeerkracht(l);
  }, []);

  // Bij het openen: nog steeds aangemeld? (De sessie kan verlopen of elders afgemeld zijn.)
  useEffect(() => {
    if (!c || !lees()) return;
    let actief = true;
    c.gebruiker().then(
      (g) => {
        if (actief && (!g || g.anoniem || g.id !== lees()?.uid)) zet(null);
      },
      () => {
        // offline: aangemeld blijven, de synchronisatie probeert later opnieuw
      },
    );
    return () => {
      actief = false;
    };
  }, [c, zet]);

  const aanmelden = useCallback(
    async (naam: string, wachtwoord: string) => {
      if (!c) throw new LiveFout('verbinding');
      const uid = await c.aanmelden(naarEmail(naam), wachtwoord);
      const n = await leerkrachtNaam(uid).catch(async (e) => {
        await c.afmelden();
        throw e;
      });
      if (!n) {
        await c.afmelden();
        throw new LiveFout('geen_leerkracht');
      }
      zet({ uid, naam: n });
    },
    [c, zet],
  );

  const afmelden = useCallback(async () => {
    zet(null);
    await c?.afmelden().catch(() => undefined);
  }, [c, zet]);

  return { beschikbaar: !!c, leerkracht, aanmelden, afmelden };
}
