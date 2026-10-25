import { useEffect, useMemo, useRef, useState } from 'react';
import { voegSamen } from './backup';
import { KLUISCODE_MIN, KluisFout, leesKluis, normaliseerCode, schrijfKluis } from './kluis';
import { supabaseKluis } from './kluisServer';
import type { Klas } from './types';

const SLEUTEL = 'games.v1.kluis';

interface Instelling {
  code: string;
  /** Tijdstip van de versie in de kluis die dit toestel laatst ophaalde of bewaarde. */
  laatsteSync: string | null;
}

function lees(): Instelling | null {
  try {
    return JSON.parse(localStorage.getItem(SLEUTEL) ?? 'null') as Instelling | null;
  } catch {
    return null;
  }
}

function bewaar(i: Instelling | null) {
  try {
    if (i) localStorage.setItem(SLEUTEL, JSON.stringify(i));
    else localStorage.removeItem(SLEUTEL);
  } catch {
    // geen opslag: de kluis werkt enkel tot de pagina sluit
  }
}

export type KluisStatus = 'uit' | 'bezig' | 'ok' | 'fout';

export interface Kluis {
  /** Supabase ingesteld? */
  beschikbaar: boolean;
  /** Is dit toestel gekoppeld aan een kluis? */
  gekoppeld: boolean;
  status: KluisStatus;
  melding: string | null;
  laatsteSync: string | null;
  /** Koppelt dit toestel: een nieuwe kluis maken of een bestaande openen. */
  koppel(code: string, modus: 'nieuw' | 'openen'): Promise<void>;
  ontkoppel(): void;
}

const foutTekst = (e: unknown) => (e instanceof KluisFout ? e.message : e instanceof Error ? e.message : 'De kluis kon niet bereikt worden.');

/**
 * Houdt de klassen gelijk met de kluis in Supabase: bij het openen van de site wordt een nieuwere
 * versie opgehaald, en elke wijziging wordt (na 1,5 s) bewaard. De laatste wijziging wint.
 */
export function useKluis(klassen: Klas[], setKlassen: (f: (k: Klas[]) => Klas[]) => void): Kluis {
  const server = useMemo(() => supabaseKluis(), []);
  const [instelling, setInstelling] = useState<Instelling | null>(lees);
  const [status, setStatus] = useState<KluisStatus>(instelling && server ? 'bezig' : 'uit');
  const [melding, setMelding] = useState<string | null>(null);
  const opgehaald = useRef(false);
  // Klassen zoals laatst gesynchroniseerd met de kluis: enkel bij een verschil wordt bewaard.
  const gesynchroniseerd = useRef<string | null>(null);
  // Net gekoppeld: dan is opnieuw ophalen niet nodig.
  const netGekoppeld = useRef<string | null>(null);
  const [teBewaren, setTeBewaren] = useState(0);
  const code = instelling?.code ?? null;

  function zetInstelling(i: Instelling | null) {
    bewaar(i);
    setInstelling(i);
  }

  // Bij het openen: nieuwere versie uit de kluis ophalen.
  useEffect(() => {
    if (!server || !code) return;
    if (netGekoppeld.current === code) {
      netGekoppeld.current = null;
      return;
    }
    let actief = true;
    opgehaald.current = false;
    setStatus('bezig');
    leesKluis(server, code).then(
      (inhoud) => {
        if (!actief) return;
        const huidig = lees();
        if (inhoud && (!huidig?.laatsteSync || inhoud.bijgewerkt > huidig.laatsteSync)) {
          // De kluis is nieuwer: die versie wint.
          gesynchroniseerd.current = JSON.stringify(inhoud.klassen);
          setKlassen(() => inhoud.klassen);
          zetInstelling({ code, laatsteSync: inhoud.bijgewerkt });
        } else if (inhoud) {
          gesynchroniseerd.current = JSON.stringify(inhoud.klassen);
        }
        opgehaald.current = true;
        // Wijzigingen van tijdens het ophalen alsnog bewaren.
        setTeBewaren((n) => n + 1);
        setStatus('ok');
        setMelding(null);
      },
      (e) => {
        if (!actief) return;
        setStatus('fout');
        setMelding(foutTekst(e));
      },
    );
    return () => {
      actief = false;
    };
  }, [server, code, setKlassen]);

  // Elke wijziging aan de klassen bewaren in de kluis.
  useEffect(() => {
    if (!server || !code || !opgehaald.current) return;
    const json = JSON.stringify(klassen);
    if (json === gesynchroniseerd.current) return;
    const t = window.setTimeout(() => {
      setStatus('bezig');
      schrijfKluis(server, code, klassen).then(
        (inhoud) => {
          gesynchroniseerd.current = json;
          zetInstelling({ code, laatsteSync: inhoud.bijgewerkt });
          setStatus('ok');
          setMelding(null);
        },
        (e) => {
          setStatus('fout');
          setMelding(`Niet bewaard in de kluis: ${foutTekst(e)}`);
        },
      );
    }, 1500);
    return () => window.clearTimeout(t);
  }, [klassen, server, code, teBewaren]);

  async function koppel(invoer: string, modus: 'nieuw' | 'openen') {
    if (!server) throw new KluisFout('Supabase is niet ingesteld.');
    const c = normaliseerCode(invoer);
    if (c.length < KLUISCODE_MIN) throw new KluisFout(`De kluiscode moet minstens ${KLUISCODE_MIN} tekens lang zijn.`);
    setStatus('bezig');
    setMelding(null);
    try {
      const bestaand = await leesKluis(server, c);
      if (modus === 'openen' && !bestaand) throw new KluisFout('Er bestaat geen kluis met deze code. Controleer de code (hoofdletters tellen mee).');
      // Klassen van dit toestel en uit de kluis samenvoegen (bij dezelfde klas wint de kluis).
      const samen = bestaand ? voegSamen(klassen, bestaand.klassen) : klassen;
      const inhoud = await schrijfKluis(server, c, samen);
      gesynchroniseerd.current = JSON.stringify(samen);
      netGekoppeld.current = c;
      opgehaald.current = true;
      setKlassen(() => samen);
      zetInstelling({ code: c, laatsteSync: inhoud.bijgewerkt });
      setStatus('ok');
    } catch (e) {
      setStatus(instelling ? 'fout' : 'uit');
      throw e;
    }
  }

  function ontkoppel() {
    zetInstelling(null);
    opgehaald.current = false;
    setStatus('uit');
    setMelding(null);
  }

  return { beschikbaar: !!server, gekoppeld: !!code, status, melding, laatsteSync: instelling?.laatsteSync ?? null, koppel, ontkoppel };
}
