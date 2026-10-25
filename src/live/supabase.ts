import type { SupabaseClient } from '@supabase/supabase-js';
import { zetVerbinding } from './verbinding';
import { LiveFout, type FoutCode, type LiveAntwoord, type LiveBackend, type LiveSessie, type LiveSpeler, type SessieInfo } from './types';


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
function vertaal(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? '';
  // Functie of kolom bestaat nog niet: het schema werd niet opnieuw uitgevoerd na een update.
  if (error?.code === 'PGRST202' || error?.code === '42883' || /could not find the function/i.test(msg)) throw new LiveFout('schema_oud');
  const code = CODES.find((c) => msg.includes(c));
  if (code) throw new LiveFout(code);
  if (/anonymous sign-ins are disabled/i.test(msg)) throw new LiveFout('anoniem_uit');
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
    vragen: r.vragen ?? null,
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

/**
 * @param perTabblad elk tabblad meldt zich apart aan (om met meerdere leerlingen te testen op één
 *   laptop). Standaard deelt de hele browser één aanmelding, zodat een leerling na het sluiten van
 *   het tabblad gewoon verder kan.
 */
export function supabaseBackend(url: string, key: string, perTabblad = false): LiveBackend {
  // De bibliotheek wordt pas geladen wanneer een live spel ze nodig heeft (snellere startpagina).
  let client: Promise<SupabaseClient> | null = null;
  const sb = () =>
    (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, key, {
        auth: perTabblad
          ? { persistSession: true, storage: sessionStorage, storageKey: 'klasspelen-live-auth-tabblad' }
          : { persistSession: true, storageKey: 'klasspelen-live-auth' },
      }),
    ));

  let aanmelden: Promise<string> | null = null;
  /** Anoniem aanmelden (één keer per browser of tabblad; de sessie blijft bewaard). */
  function uid(): Promise<string> {
    aanmelden ??= (async () => {
      const c = await sb();
      const { data } = await c.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: d, error } = await c.auth.signInAnonymously();
      if (error || !d.user) {
        aanmelden = null;
        vertaal(error);
      }
      return d.user!.id;
    })();
    return aanmelden;
  }

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

  return {
    soort: 'supabase',

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
          vragen: input.vragen ?? null,
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
