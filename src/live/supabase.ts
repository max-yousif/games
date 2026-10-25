import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LiveFout, type FoutCode, type LiveAntwoord, type LiveBackend, type LiveSessie, type LiveSpeler, type SessieInfo } from './types';


const CODES: FoutCode[] = ['onbekende_code', 'gesloten', 'ongeldige_naam', 'naam_bezet', 'geen_vraag', 'al_geantwoord', 'al_opgelost', 'te_laat', 'geen_speler', 'niet_aangemeld', 'wacht'];

/** Zet een databasefout om naar een LiveFout met een Nederlandstalige uitleg. */
function vertaal(error: { message?: string } | null): never {
  const msg = error?.message ?? '';
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

const spelerUit = (r: any): LiveSpeler => ({ id: r.id, naam: r.naam, verbonden: r.uid !== null });

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

export function supabaseBackend(url: string, key: string): LiveBackend {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, storageKey: 'klasspelen-live-auth' } });

  let aanmelden: Promise<string> | null = null;
  /** Anoniem aanmelden (één keer per browser; de sessie blijft bewaard). */
  function uid(): Promise<string> {
    aanmelden ??= (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: d, error } = await sb.auth.signInAnonymously();
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
      } catch {
        // Volgende poging bij de volgende wijziging of na 15 seconden.
      } finally {
        bezig = false;
        if (opnieuw && actief) {
          opnieuw = false;
          void verversen();
        }
      }
    };
    let kanaal: ReturnType<SupabaseClient['channel']> | null = null;
    void uid().then(() => {
      if (!actief) return;
      kanaal = sb
        .channel(`${tabel}:${filter}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabel, filter }, () => void verversen())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void verversen();
        });
      void verversen();
    });
    const interval = window.setInterval(() => void verversen(), 15000);
    return () => {
      actief = false;
      window.clearInterval(interval);
      if (kanaal) void sb.removeChannel(kanaal);
    };
  }

  return {
    soort: 'supabase',

    async maakSessie(input) {
      await uid();
      const { data, error } = await sb
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
      const { error } = await sb.rpc('live_start_vraag', { p_sessie: sessieId, p_vraag_nr: nr, p_vraag: vraag });
      if (error) vertaal(error);
    },

    async startEscape(sessieId) {
      const { error } = await sb.rpc('live_start_escape', { p_sessie: sessieId });
      if (error) vertaal(error);
    },

    async wijzigSessie(sessieId, patch) {
      const { error } = await sb.from('live_sessies').update(patch).eq('id', sessieId);
      if (error) vertaal(error);
    },

    async beoordeel(sessieId, items) {
      if (items.length === 0) return;
      const { error } = await sb.rpc('live_beoordeel', { p_sessie: sessieId, p_items: items });
      if (error) vertaal(error);
    },

    async ontkoppel(spelerId) {
      const { error } = await sb.from('live_spelers').update({ uid: null }).eq('id', spelerId);
      if (error) vertaal(error);
    },

    async verwijderSessie(sessieId) {
      const { error } = await sb.from('live_sessies').delete().eq('id', sessieId);
      if (error) vertaal(error);
    },

    volgSpelers(sessieId, cb) {
      return volg(
        'live_spelers',
        `sessie_id=eq.${sessieId}`,
        async () => {
          const { data, error } = await sb.from('live_spelers').select('id, naam, uid').eq('sessie_id', sessieId).order('naam');
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
          const { data, error } = await sb.from('live_antwoorden').select('*').eq('sessie_id', sessieId).order('aangemaakt').limit(5000);
          if (error) vertaal(error);
          return (data ?? []).map(antwoordUit);
        },
        cb,
      );
    },

    async sessieInfo(code) {
      await uid();
      const { data, error } = await sb.rpc('live_sessie_info', { p_code: code });
      if (error) vertaal(error);
      const r = (data as any[])[0];
      return r ? ({ id: r.id, titel: r.titel, vrijeNamen: r.vrije_namen ?? [], vrijeNaam: r.vrije_naam, status: r.status } satisfies SessieInfo) : null;
    },

    async deelnemen(code, naam) {
      await uid();
      const { data, error } = await sb.rpc('live_deelnemen', { p_code: code, p_naam: naam });
      if (error) vertaal(error);
      const r = (data as any[])[0];
      return { sessieId: r.sessie_id, spelerId: r.speler_id, naam: r.naam };
    },

    async mijnSpeler(sessieId) {
      const ik = await uid();
      const { data, error } = await sb.from('live_spelers').select('id, naam, uid').eq('sessie_id', sessieId).eq('uid', ik).maybeSingle();
      if (error) vertaal(error);
      return data ? spelerUit(data) : null;
    },

    async antwoord(sessieId, vraagNr, antwoord) {
      const { error } = await sb.rpc('live_antwoord', { p_sessie: sessieId, p_vraag_nr: vraagNr, p_antwoord: antwoord });
      if (error) vertaal(error);
    },

    volgSessie(sessieId, cb) {
      return volg(
        'live_sessies',
        `id=eq.${sessieId}`,
        async () => {
          const { data, error } = await sb.from('live_sessies').select('*').eq('id', sessieId).maybeSingle();
          if (error) vertaal(error);
          return data ? sessieUit(data) : null;
        },
        cb,
      );
    },
  };
}
