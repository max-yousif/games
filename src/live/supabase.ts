import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { zetVerbinding } from './verbinding';
import { isGeldigeReactie, LiveFout, type FoutCode, type LiveAntwoord, type LiveBackend, type LiveSessie, type LiveSpeler, type Reactie, type SessieInfo } from './types';


const CODES: FoutCode[] = [
  'onbekende_code',
  'gesloten',
  'ongeldige_naam',
  'naam_bezet',
  'bijnaam_bezet',
  'geen_vraag',
  'al_geantwoord',
  'al_opgelost',
  'te_laat',
  'geen_speler',
  'niet_aangemeld',
  'wacht',
];

/** Zet een databasefout om naar een LiveFout met een Nederlandstalige uitleg. */
export function vertaal(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? '';
  // Functie of kolom bestaat nog niet: het schema werd niet opnieuw uitgevoerd na een update.
  if (error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(msg)) throw new LiveFout('schema_oud');
  const code = CODES.find((c) => msg.includes(c));
  if (code) throw new LiveFout(code);
  if (/anonymous sign-ins are disabled/i.test(msg)) throw new LiveFout('anoniem_uit');
  if (/row-level security/i.test(msg)) throw new LiveFout('geen_leerkracht');
  throw new LiveFout('verbinding');
}

function sessieUit(r: any): LiveSessie {
  return {
    id: r.id,
    code: r.code,
    titel: r.titel,
    modus: r.modus ?? 'quiz',
    namen: r.namen ?? [],
    vrijeNaam: r.vrije_naam,
    status: r.status,
    vraagNr: r.vraag_nr,
    aantalVragen: r.aantal_vragen,
    vraag: r.vraag,
    // Whodunit: de vragen en het raadsel samen in de kolom vragen ({ vragen, raadsel }).
    vragen: (Array.isArray(r.vragen) ? r.vragen : r.vragen?.vragen) ?? null,
    raadsel: Array.isArray(r.vragen) ? null : (r.vragen?.raadsel ?? null),
    codekraker: Array.isArray(r.vragen) ? null : (r.vragen?.codekraker ?? null),
    wachttijd: r.wachttijd ?? 0,
    vraagStart: r.vraag_start,
    timer: r.timer,
    oplossing: r.oplossing,
    stand: r.stand ?? [],
  };
}

const spelerUit = (r: any): LiveSpeler => ({ id: r.id, naam: r.naam, bijnaam: r.bijnaam ?? null, verbonden: r.uid !== null });

const antwoordUit = (r: any): LiveAntwoord => ({
  id: r.id,
  spelerId: r.speler_id,
  vraagNr: r.vraag_nr,
  antwoord: r.antwoord,
  tijdMs: r.tijd_ms,
  juist: r.juist,
  punten: r.punten,
  poging: r.poging ?? 1,
  beloning: r.beloning ?? null,
});

// Eén client en één anonieme aanmelding per browser, gedeeld door alle tabbladen, de live spellen
// en de cloudopslag van de leerkracht. Zo is één browser altijd één leerling: in een tweede tabblad een andere
// naam kiezen geeft de eerste naam vrij.
const clients = new Map<string, Promise<SupabaseClient>>();
const aanmeldingen = new Map<string, Promise<string>>();

export interface SupabaseVerbinding {
  sb: () => Promise<SupabaseClient>;
  /** Id van de aangemelde gebruiker; meldt zo nodig anoniem aan (leerlingen). */
  uid: () => Promise<string>;
  /** Aanmelden als leerkracht (e-mail en wachtwoord); geeft het id terug. */
  aanmelden: (email: string, wachtwoord: string) => Promise<string>;
  afmelden: () => Promise<void>;
  /** De huidige gebruiker zonder anoniem aan te melden, of null. */
  gebruiker: () => Promise<{ id: string; anoniem: boolean } | null>;
}

export function supabaseClient(url: string, key: string): SupabaseVerbinding {
  const sleutel = url;
  // De bibliotheek wordt pas geladen wanneer ze nodig is (snellere startpagina).
  const sb = () => {
    let c = clients.get(sleutel);
    if (!c) {
      c = import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(url, key, { auth: { persistSession: true, storageKey: 'klasspelen-live-auth' } }),
      );
      clients.set(sleutel, c);
    }
    return c;
  };
  /** Anoniem aanmelden (één keer per browser; de sessie blijft bewaard). */
  const uid = () => {
    let a = aanmeldingen.get(sleutel);
    if (!a) {
      a = (async () => {
        const c = await sb();
        const { data } = await c.auth.getSession();
        if (data.session) return data.session.user.id;
        const { data: d, error } = await c.auth.signInAnonymously();
        if (error || !d.user) {
          aanmeldingen.delete(sleutel);
          vertaal(error);
        }
        return d.user!.id;
      })();
      aanmeldingen.set(sleutel, a);
    }
    return a;
  };
  const aanmelden = async (email: string, wachtwoord: string) => {
    const c = await sb();
    const { data, error } = await c.auth.signInWithPassword({ email, password: wachtwoord });
    if (error || !data.user) {
      if (error && /invalid login credentials|invalid_credentials/i.test(`${error.message} ${error.code ?? ''}`)) throw new LiveFout('login_fout');
      vertaal(error);
    }
    aanmeldingen.set(sleutel, Promise.resolve(data.user!.id));
    return data.user!.id;
  };
  const afmelden = async () => {
    const c = await sb();
    await c.auth.signOut();
    aanmeldingen.delete(sleutel);
  };
  const gebruiker = async () => {
    const { data } = await (await sb()).auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, anoniem: u.is_anonymous ?? false } : null;
  };
  return { sb, uid, aanmelden, afmelden, gebruiker };
}

export function supabaseBackend(url: string, key: string): LiveBackend {
  const { sb, uid } = supabaseClient(url, key);

  /**
   * Volgt een tabel: haalt alles opnieuw op bij elke wijziging (en elke 15 seconden als vangnet,
   * voor het geval een realtime-bericht verloren gaat).
   */
  function volg<T>(tabel: string, filter: string, ophalen: () => Promise<T>, cb: (t: T) => void): () => void {
    let actief = true;
    let bezig = false;
    let opnieuw = false;
    const verversen = async () => {
      if (bezig) {
        opnieuw = true;
        return;
      }
      bezig = true;
      try {
        const t = await ophalen();
        if (actief) cb(t);
        zetVerbinding('verbonden');
      } catch {
        // Volgende poging bij de volgende wijziging, bij terugkeer van het internet of na 15 seconden.
        zetVerbinding('verbinden');
      } finally {
        bezig = false;
        if (opnieuw && actief) {
          opnieuw = false;
          void verversen();
        }
      }
    };
    let kanaal: ReturnType<SupabaseClient['channel']> | null = null;
    void Promise.all([sb(), uid()]).then(
      ([c]) => {
        if (!actief) return;
        kanaal = c
          .channel(`${tabel}:${filter}:${Math.random().toString(36).slice(2)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: tabel, filter }, () => void verversen())
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') void verversen();
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') zetVerbinding('verbinden');
          });
        void verversen();
      },
      () => zetVerbinding('verbinden'),
    );
    // Meteen bijwerken als het internet terug is of de laptop uit slaapstand komt.
    const wakker = () => {
      if (document.visibilityState === 'visible') void verversen();
    };
    window.addEventListener('online', wakker);
    document.addEventListener('visibilitychange', wakker);
    const interval = window.setInterval(() => void verversen(), 15000);
    return () => {
      actief = false;
      window.clearInterval(interval);
      window.removeEventListener('online', wakker);
      document.removeEventListener('visibilitychange', wakker);
      if (kanaal) void sb().then((c) => c.removeChannel(kanaal!));
    };
  }

  /** Eén broadcast-kanaal per sessie voor reacties, gedeeld door zenden en ontvangen. */
  const reactieKanalen = new Map<string, { kanaal: Promise<RealtimeChannel>; luisteraars: Set<(r: Reactie) => void> }>();
  function reactieKanaal(sessieId: string) {
    let k = reactieKanalen.get(sessieId);
    if (!k) {
      const luisteraars = new Set<(r: Reactie) => void>();
      const kanaal = Promise.all([sb(), uid()]).then(
        ([c]) =>
          new Promise<RealtimeChannel>((klaar, mislukt) => {
            const ch = c
              .channel(`reacties:${sessieId}`, { config: { broadcast: { self: false } } })
              .on('broadcast', { event: 'reactie' }, ({ payload }) => {
                if (isGeldigeReactie(payload)) luisteraars.forEach((l) => l({ emoji: payload.emoji, naam: payload.naam.slice(0, 30) }));
              })
              .subscribe((status) => {
                if (status === 'SUBSCRIBED') klaar(ch);
                else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  reactieKanalen.delete(sessieId);
                  void c.removeChannel(ch);
                  mislukt(new LiveFout('verbinding'));
                }
              });
          }),
      );
      k = { kanaal, luisteraars };
      reactieKanalen.set(sessieId, k);
    }
    return k;
  }

  return {
    soort: 'supabase',

    async reageer(sessieId, reactie) {
      const ch = await reactieKanaal(sessieId).kanaal;
      await ch.send({ type: 'broadcast', event: 'reactie', payload: reactie });
    },

    volgReacties(sessieId, cb) {
      const k = reactieKanaal(sessieId);
      k.luisteraars.add(cb);
      k.kanaal.catch(() => {});
      return () => k.luisteraars.delete(cb);
    },

    async maakSessie(input) {
      await uid();
      const { data, error } = await (await sb())
        .from('live_sessies')
        .insert({
          titel: input.titel,
          namen: input.namen,
          vrije_naam: input.vrijeNaam,
          aantal_vragen: input.aantalVragen,
          timer: input.timer,
          modus: input.modus ?? 'quiz',
          // Whodunit en codekraker: de vragen samen met het raadsel of de instellingen.
          vragen:
            input.raadsel || input.codekraker
              ? { vragen: input.vragen ?? [], ...(input.raadsel ? { raadsel: input.raadsel } : {}), ...(input.codekraker ? { codekraker: input.codekraker } : {}) }
              : (input.vragen ?? null),
          wachttijd: input.wachttijd ?? 0,
        })
        .select()
        .single();
      if (error) vertaal(error);
      return sessieUit(data);
    },

    async startVraag(sessieId, nr, vraag) {
      const { error } = await (await sb()).rpc('live_start_vraag', { p_sessie: sessieId, p_vraag_nr: nr, p_vraag: vraag });
      if (error) vertaal(error);
    },

    async startEscape(sessieId) {
      const { error } = await (await sb()).rpc('live_start_escape', { p_sessie: sessieId });
      if (error) vertaal(error);
    },

    async wijzigSessie(sessieId, patch) {
      const { error } = await (await sb()).from('live_sessies').update(patch).eq('id', sessieId);
      if (error) vertaal(error);
    },

    async beoordeel(sessieId, items) {
      if (items.length === 0) return;
      const { error } = await (await sb()).rpc('live_beoordeel', { p_sessie: sessieId, p_items: items });
      if (error) vertaal(error);
    },

    async ontkoppel(spelerId) {
      const { error } = await (await sb()).from('live_spelers').update({ uid: null }).eq('id', spelerId);
      if (error) vertaal(error);
    },

    async wisBijnaam(spelerId) {
      const { error } = await (await sb()).from('live_spelers').update({ bijnaam: null }).eq('id', spelerId);
      if (error) vertaal(error);
    },

    async verwijderSessie(sessieId) {
      const { error } = await (await sb()).from('live_sessies').delete().eq('id', sessieId);
      if (error) vertaal(error);
    },

    volgSpelers(sessieId, cb) {
      return volg(
        'live_spelers',
        `sessie_id=eq.${sessieId}`,
        async () => {
          const { data, error } = await (await sb()).from('live_spelers').select('*').eq('sessie_id', sessieId).order('naam');
          if (error) vertaal(error);
          return (data ?? []).map(spelerUit);
        },
        cb,
      );
    },

    volgAntwoorden(sessieId, cb) {
      return volg(
        'live_antwoorden',
        `sessie_id=eq.${sessieId}`,
        async () => {
          const { data, error } = await (await sb()).from('live_antwoorden').select('*').eq('sessie_id', sessieId).order('aangemaakt').limit(5000);
          if (error) vertaal(error);
          return (data ?? []).map(antwoordUit);
        },
        cb,
      );
    },

    async sessieInfo(code) {
      await uid();
      const { data, error } = await (await sb()).rpc('live_sessie_info', { p_code: code });
      if (error) vertaal(error);
      const r = (data as any[])[0];
      return r ? ({ id: r.id, titel: r.titel, vrijeNamen: r.vrije_namen ?? [], vrijeNaam: r.vrije_naam, status: r.status } satisfies SessieInfo) : null;
    },

    async deelnemen(code, naam) {
      await uid();
      const { data, error } = await (await sb()).rpc('live_deelnemen', { p_code: code, p_naam: naam });
      if (error) vertaal(error);
      const r = (data as any[])[0];
      return { sessieId: r.sessie_id, spelerId: r.speler_id, naam: r.naam };
    },

    async mijnSpeler(sessieId) {
      const ik = await uid();
      const { data, error } = await (await sb()).from('live_spelers').select('*').eq('sessie_id', sessieId).eq('uid', ik).maybeSingle();
      if (error) vertaal(error);
      return data ? spelerUit(data) : null;
    },

    async bijnaam(sessieId, bijnaam) {
      const { data, error } = await (await sb()).rpc('live_bijnaam', { p_sessie: sessieId, p_bijnaam: bijnaam });
      if (error) vertaal(error);
      return (data as string | null) ?? null;
    },

    async verlaten(sessieId) {
      const { error } = await (await sb()).rpc('live_verlaten', { p_sessie: sessieId });
      if (error) vertaal(error);
    },

    async antwoord(sessieId, vraagNr, antwoord) {
      const { error } = await (await sb()).rpc('live_antwoord', { p_sessie: sessieId, p_vraag_nr: vraagNr, p_antwoord: antwoord });
      if (error) vertaal(error);
    },

    volgSessie(sessieId, cb) {
      return volg(
        'live_sessies',
        `id=eq.${sessieId}`,
        async () => {
          const { data, error } = await (await sb()).from('live_sessies').select('*').eq('id', sessieId).maybeSingle();
          if (error) vertaal(error);
          return data ? sessieUit(data) : null;
        },
        cb,
      );
    },
  };
}
