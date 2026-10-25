import { useCallback, useEffect, useRef, useState } from 'react';
import { cloud } from '../live/config';
import { LiveFout } from '../live/types';
import { naUpload, teUploaden, verwerkDownload, type Gesync, type Lokaal, type ServerItem } from './cloudSync';

const sleutel = (uid: string) => `games.v1.cloud.${uid}`;

interface Toestand {
  /** Tijd van de server van het recentste opgehaalde item. */
  laatstePull: string | null;
  gesync: Gesync;
}

function lees(uid: string): Toestand {
  try {
    const t = JSON.parse(localStorage.getItem(sleutel(uid)) ?? 'null') as Toestand | null;
    if (t && typeof t.gesync === 'object') return t;
  } catch {
    // opnieuw beginnen
  }
  return { laatstePull: null, gesync: {} };
}

function bewaar(uid: string, t: Toestand) {
  try {
    localStorage.setItem(sleutel(uid), JSON.stringify(t));
  } catch {
    // geen opslag: bij het volgende openen wordt alles opnieuw vergeleken
  }
}

/** Vergeet wat met de cloud gesynchroniseerd werd (bij afmelden en lokale gegevens wissen). */
export function vergeetCloud(uid: string) {
  try {
    localStorage.removeItem(sleutel(uid));
  } catch {
    // niets te doen
  }
}

export type CloudStatus = 'uit' | 'bezig' | 'ok' | 'fout';

export interface Cloud {
  status: CloudStatus;
  melding: string | null;
  /** Tijdstip van de laatste geslaagde synchronisatie. */
  laatsteSync: Date | null;
  /** Meteen synchroniseren. */
  nu(): void;
}

const PAGINA = 500;
// Wijzigingen van vlak voor de vorige keer opnieuw ophalen: een trage schrijfactie kan een iets
// oudere servertijd krijgen. Dubbel ophalen is onschuldig.
const MARGE_MS = 10_000;

const foutTekst = (e: unknown) => (e instanceof LiveFout ? e.message : 'De cloud kon niet bereikt worden. Je wijzigingen worden later bewaard.');

/**
 * Houdt vragensets, klassen en resultaten gelijk met de cloud (Supabase) zolang een leerkracht
 * aangemeld is: ophalen bij het openen, bij terugkeer naar het tabblad en elke minuut; elke
 * wijziging wordt na 2 seconden bewaard. Per item wint de laatste wijziging.
 */
export function useCloud(uid: string | null, lokaal: Lokaal, zet: (l: Lokaal) => void): Cloud {
  const [status, setStatus] = useState<CloudStatus>(uid ? 'bezig' : 'uit');
  const [melding, setMelding] = useState<string | null>(null);
  const [laatsteSync, setLaatsteSync] = useState<Date | null>(null);
  const lokaalRef = useRef(lokaal);
  lokaalRef.current = lokaal;
  const zetRef = useRef(zet);
  zetRef.current = zet;
  const syncRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const c = cloud();
    if (!uid || !c) {
      setStatus('uit');
      syncRef.current = () => undefined;
      return;
    }
    let actief = true;
    let toestand = lees(uid);
    let bezig = false;
    let opnieuw = false;

    async function ophalen() {
      const sb = await c!.sb();
      const vanaf = toestand.laatstePull ? new Date(new Date(toestand.laatstePull).getTime() - MARGE_MS).toISOString() : null;
      const items: ServerItem[] = [];
      for (let van = 0; ; van += PAGINA) {
        let q = sb.from('leerkracht_items').select('soort, id, data, verwijderd, bijgewerkt').eq('eigenaar', uid!);
        if (vanaf) q = q.gt('bijgewerkt', vanaf);
        const { data, error } = await q.order('bijgewerkt').order('soort').order('id').range(van, van + PAGINA - 1);
        if (error) throw new LiveFout(error.code === '42P01' || error.code === 'PGRST205' ? 'schema_oud' : /row-level security/i.test(error.message) ? 'geen_leerkracht' : 'verbinding');
        items.push(...(data as ServerItem[]));
        if (data.length < PAGINA) break;
      }
      if (!actief) return;
      const r = verwerkDownload(lokaalRef.current, items, toestand.gesync);
      if (r.gewijzigd) {
        lokaalRef.current = r.lokaal;
        zetRef.current(r.lokaal);
      }
      const laatste = items.reduce<string | null>((m, it) => (!m || it.bijgewerkt > m ? it.bijgewerkt : m), toestand.laatstePull);
      toestand = { laatstePull: laatste, gesync: r.gesync };
      bewaar(uid!, toestand);
    }

    async function opsturen() {
      const u = teUploaden(lokaalRef.current, toestand.gesync);
      if (!u.bewaren.length && !u.wissen.length) return;
      const rijen = [
        ...u.bewaren.map((b) => ({ eigenaar: uid, soort: b.soort, id: b.id, data: b.data, verwijderd: false })),
        ...u.wissen.map((w) => ({ eigenaar: uid, soort: w.soort, id: w.id, data: null, verwijderd: true })),
      ];
      const sb = await c!.sb();
      for (let i = 0; i < rijen.length; i += 100) {
        const { error } = await sb.from('leerkracht_items').upsert(rijen.slice(i, i + 100), { onConflict: 'eigenaar,soort,id' });
        if (error) throw new LiveFout(/row-level security/i.test(error.message) ? 'geen_leerkracht' : error.code === '42P01' || error.code === 'PGRST205' ? 'schema_oud' : 'verbinding');
      }
      if (!actief) return;
      toestand = { ...toestand, gesync: naUpload(toestand.gesync, u) };
      bewaar(uid!, toestand);
    }

    async function sync() {
      if (bezig) {
        opnieuw = true;
        return;
      }
      bezig = true;
      setStatus('bezig');
      try {
        do {
          opnieuw = false;
          await ophalen();
          if (actief) await opsturen();
        } while (opnieuw && actief);
        if (actief) {
          setStatus('ok');
          setMelding(null);
          setLaatsteSync(new Date());
        }
      } catch (e) {
        if (actief) {
          setStatus('fout');
          setMelding(foutTekst(e));
        }
      } finally {
        bezig = false;
      }
    }

    syncRef.current = () => void sync();
    void sync();
    const wakker = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    window.addEventListener('online', wakker);
    window.addEventListener('focus', wakker);
    document.addEventListener('visibilitychange', wakker);
    const interval = window.setInterval(() => void sync(), 60_000);
    return () => {
      actief = false;
      syncRef.current = () => undefined;
      window.clearInterval(interval);
      window.removeEventListener('online', wakker);
      window.removeEventListener('focus', wakker);
      document.removeEventListener('visibilitychange', wakker);
    };
  }, [uid]);

  // Elke wijziging na 2 seconden bewaren.
  const eerste = useRef(true);
  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;
      return;
    }
    const t = window.setTimeout(() => syncRef.current(), 2000);
    return () => window.clearTimeout(t);
  }, [lokaal.sets, lokaal.klassen, lokaal.sessies]);

  const nu = useCallback(() => syncRef.current(), []);
  return { status: uid ? status : 'uit', melding, laatsteSync, nu };
}
