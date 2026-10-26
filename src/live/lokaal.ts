import { zetVerbinding } from './verbinding';
import { isGeldigeReactie, LiveFout, type Beoordeling, type LiveAntwoord, type LiveBackend, type LiveSessie, type LiveSpeler, type PubliekeVraag } from './types';

/*
 * Lokale demo van de live server: alles staat in de opslag van deze browser en elk tabblad
 * telt als een aparte laptop. Zo kan de leerkracht live spelen uitproberen (leerlingenscherm in
 * een tweede tabblad) zonder Supabase. De regels volgen supabase/schema.sql.
 */

interface Rijen {
  sessies: (LiveSessie & { host: string; aangemaakt: number; vraagStartMs: number | null })[];
  spelers: (LiveSpeler & { sessieId: string; uid: string | null })[];
  antwoorden: (LiveAntwoord & { sessieId: string; aangemaaktMs: number })[];
}

const SLEUTEL = 'klasspelen.lokaal-live';
const TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GELDIG = 2 * 24 * 3600 * 1000;

export interface Opslag {
  lees(): string | null;
  schrijf(waarde: string): void;
  /** Meldt wijzigingen door andere tabbladen. */
  luister(cb: () => void): () => void;
}

const browserOpslag: Opslag = {
  lees: () => localStorage.getItem(SLEUTEL),
  schrijf: (w) => localStorage.setItem(SLEUTEL, w),
  luister: (cb) => {
    const f = (e: StorageEvent) => e.key === SLEUTEL && cb();
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  },
};

/** Elk tabblad is een andere "laptop". */
function tabbladId(): string {
  let id = sessionStorage.getItem('klasspelen.lokaal-uid');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('klasspelen.lokaal-uid', id);
  }
  return id;
}

export function lokaalBackend(uid: string = tabbladId(), opslag: Opslag = browserOpslag, klok: () => number = Date.now): LiveBackend {
  const luisteraars = new Set<() => void>();
  opslag.luister(() => luisteraars.forEach((l) => l()));

  function lees(): Rijen {
    try {
      const r = JSON.parse(opslag.lees() ?? '') as Rijen;
      if (Array.isArray(r.sessies)) return r;
    } catch {
      // leeg of ongeldig
    }
    return { sessies: [], spelers: [], antwoorden: [] };
  }

  function wijzig<T>(f: (r: Rijen) => T): T {
    const r = lees();
    const uit = f(r);
    opslag.schrijf(JSON.stringify(r));
    luisteraars.forEach((l) => l());
    return uit;
  }

  const sessie = (r: Rijen, id: string) => r.sessies.find((s) => s.id === id);
  const isHost = (r: Rijen, id: string) => sessie(r, id)?.host === uid;
  const isSpeler = (r: Rijen, id: string) => r.spelers.some((p) => p.sessieId === id && p.uid === uid);
  const zonderIntern = ({ host: _h, aangemaakt: _a, vraagStartMs: _v, ...s }: Rijen['sessies'][number]): LiveSessie => s;
  const naarSpeler = (p: Rijen['spelers'][number]): LiveSpeler => ({ id: p.id, naam: p.naam, bijnaam: p.bijnaam ?? null, verbonden: p.uid !== null });
  const naarAntwoord = ({ sessieId: _s, aangemaaktMs: _a, ...a }: Rijen['antwoorden'][number]): LiveAntwoord => a;

  function volg<T>(ophalen: () => T, cb: (t: T) => void): () => void {
    const f = () => {
      cb(ophalen());
      zetVerbinding('verbonden');
    };
    luisteraars.add(f);
    queueMicrotask(f);
    return () => luisteraars.delete(f);
  }

  const normNaam = (n: string) => n.replace(/\s+/g, ' ').trim();

  return {
    soort: 'lokaal',

    async reageer(sessieId, reactie) {
      // Andere tabbladen van deze browser (het bord) ontvangen de reactie.
      const kanaal = new BroadcastChannel(`klasspelen-reacties-${sessieId}`);
      kanaal.postMessage(reactie);
      kanaal.close();
    },

    volgReacties(sessieId, cb) {
      const kanaal = new BroadcastChannel(`klasspelen-reacties-${sessieId}`);
      kanaal.onmessage = (e: MessageEvent) => {
        if (isGeldigeReactie(e.data)) cb({ emoji: e.data.emoji, naam: e.data.naam.slice(0, 30) });
      };
      return () => kanaal.close();
    },

    async maakSessie(input) {
      return wijzig((r) => {
        const nu = klok();
        const oud = new Set(r.sessies.filter((s) => s.aangemaakt < nu - GELDIG).map((s) => s.id));
        r.sessies = r.sessies.filter((s) => !oud.has(s.id));
        r.spelers = r.spelers.filter((p) => !oud.has(p.sessieId));
        r.antwoorden = r.antwoorden.filter((a) => !oud.has(a.sessieId));
        let code = '';
        do code = Array.from({ length: 6 }, () => TEKENS[Math.floor(Math.random() * TEKENS.length)]).join('');
        while (r.sessies.some((s) => s.code === code));
        const s = {
          id: crypto.randomUUID(),
          code,
          titel: input.titel,
          modus: input.modus ?? ('quiz' as const),
          namen: input.namen,
          vrijeNaam: input.vrijeNaam,
          status: 'lobby' as const,
          vraagNr: -1,
          aantalVragen: input.aantalVragen,
          vraag: null,
          vragen: input.vragen ?? null,
          raadsel: input.raadsel ?? null,
          codekraker: input.codekraker ?? null,
          wachttijd: input.wachttijd ?? 0,
          vraagStart: null,
          timer: input.timer,
          oplossing: null,
          stand: [],
          host: uid,
          aangemaakt: nu,
          vraagStartMs: null,
        };
        r.sessies.push(s);
        return zonderIntern(s);
      });
    },

    async startVraag(sessieId: string, nr: number, vraag: PubliekeVraag) {
      wijzig((r) => {
        const s = sessie(r, sessieId);
        if (!s || s.host !== uid) throw new Error('geen_host');
        Object.assign(s, { status: 'vraag', vraagNr: nr, vraag, vraagStart: new Date(klok()).toISOString(), vraagStartMs: klok(), oplossing: null });
      });
    },

    async startEscape(sessieId: string) {
      wijzig((r) => {
        const s = sessie(r, sessieId);
        if (!s || s.host !== uid) throw new Error('geen_host');
        if (s.modus === 'escape') Object.assign(s, { status: 'bezig', vraagStart: new Date(klok()).toISOString(), vraagStartMs: klok() });
      });
    },

    async wijzigSessie(sessieId, patch) {
      wijzig((r) => {
        const s = sessie(r, sessieId);
        if (s && s.host === uid) Object.assign(s, patch);
      });
    },

    async beoordeel(sessieId: string, items: Beoordeling[]) {
      wijzig((r) => {
        if (!isHost(r, sessieId)) throw new Error('geen_host');
        for (const i of items) {
          const a = r.antwoorden.find((x) => x.id === i.id && x.sessieId === sessieId);
          if (a) Object.assign(a, { juist: i.juist, punten: i.punten, beloning: i.beloning ?? null });
        }
      });
    },

    async ontkoppel(spelerId) {
      wijzig((r) => {
        const p = r.spelers.find((x) => x.id === spelerId);
        if (p && isHost(r, p.sessieId)) p.uid = null;
      });
    },

    async wisBijnaam(spelerId) {
      wijzig((r) => {
        const p = r.spelers.find((x) => x.id === spelerId);
        if (p && isHost(r, p.sessieId)) p.bijnaam = null;
      });
    },

    async verwijderSessie(sessieId) {
      wijzig((r) => {
        if (!isHost(r, sessieId)) return;
        r.sessies = r.sessies.filter((s) => s.id !== sessieId);
        r.spelers = r.spelers.filter((p) => p.sessieId !== sessieId);
        r.antwoorden = r.antwoorden.filter((a) => a.sessieId !== sessieId);
      });
    },

    volgSpelers(sessieId, cb) {
      return volg(() => {
        const r = lees();
        return r.spelers
          .filter((p) => p.sessieId === sessieId && (p.uid === uid || isHost(r, sessieId)))
          .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
          .map(naarSpeler);
      }, cb);
    },

    volgAntwoorden(sessieId, cb) {
      return volg(() => {
        const r = lees();
        const eigen = new Set(r.spelers.filter((p) => p.uid === uid).map((p) => p.id));
        return r.antwoorden.filter((a) => a.sessieId === sessieId && (isHost(r, sessieId) || eigen.has(a.spelerId))).map(naarAntwoord);
      }, cb);
    },

    async sessieInfo(code) {
      const r = lees();
      const s = r.sessies.find((x) => x.code === code.trim().toUpperCase() && x.status !== 'einde');
      if (!s) return null;
      const bezet = new Set(r.spelers.filter((p) => p.sessieId === s.id && p.uid !== null && p.uid !== uid).map((p) => p.naam));
      return { id: s.id, titel: s.titel, vrijeNamen: s.namen.filter((n) => !bezet.has(n)).sort((a, b) => a.localeCompare(b, 'nl')), vrijeNaam: s.vrijeNaam, status: s.status };
    },

    async deelnemen(code, naam) {
      return wijzig((r) => {
        const s = r.sessies.find((x) => x.code === code.trim().toUpperCase());
        if (!s) throw new LiveFout('onbekende_code');
        if (s.status === 'einde') throw new LiveFout('gesloten');
        const n = normNaam(naam);
        if (!n || n.length > 60 || (!s.vrijeNaam && !s.namen.includes(n))) throw new LiveFout('ongeldige_naam');
        let p = r.spelers.find((x) => x.sessieId === s.id && x.naam === n);
        if (p && p.uid !== null && p.uid !== uid) throw new LiveFout('naam_bezet');
        for (const x of r.spelers) if (x.sessieId === s.id && x.uid === uid && x !== p) x.uid = null;
        if (p) p.uid = uid;
        else {
          p = { id: crypto.randomUUID(), sessieId: s.id, uid, naam: n, bijnaam: null, verbonden: true };
          r.spelers.push(p);
        }
        return { sessieId: s.id, spelerId: p.id, naam: p.naam };
      });
    },

    async mijnSpeler(sessieId) {
      const p = lees().spelers.find((x) => x.sessieId === sessieId && x.uid === uid);
      return p ? naarSpeler(p) : null;
    },

    async bijnaam(sessieId, bijnaam) {
      return wijzig((r) => {
        const s = sessie(r, sessieId);
        const p = r.spelers.find((x) => x.sessieId === sessieId && x.uid === uid);
        if (!s || !p) throw new LiveFout('geen_speler');
        const b = normNaam(bijnaam).slice(0, 30) || null;
        const klein = b?.toLocaleLowerCase('nl');
        if (
          klein &&
          (s.namen.some((n) => n.toLocaleLowerCase('nl') === klein && n !== p.naam) ||
            r.spelers.some((o) => o.sessieId === sessieId && o.id !== p.id && (o.naam.toLocaleLowerCase('nl') === klein || o.bijnaam?.toLocaleLowerCase('nl') === klein)))
        ) {
          throw new LiveFout('bijnaam_bezet');
        }
        p.bijnaam = b;
        return b;
      });
    },

    async verlaten(sessieId) {
      wijzig((r) => {
        for (const p of r.spelers) if (p.sessieId === sessieId && p.uid === uid) p.uid = null;
      });
    },

    async antwoord(sessieId, vraagNr, antwoord) {
      wijzig((r) => {
        const s = sessie(r, sessieId);
        if (!s) throw new LiveFout('geen_vraag');
        const p = r.spelers.find((x) => x.sessieId === sessieId && x.uid === uid);
        if (!p) throw new LiveFout('geen_speler');
        const ms = Math.max(0, klok() - (s.vraagStartMs ?? klok()));
        const nieuw = (poging: number) => ({
          id: crypto.randomUUID(),
          sessieId,
          spelerId: p.id,
          vraagNr,
          poging,
          antwoord: antwoord.slice(0, 2000),
          tijdMs: ms,
          juist: null,
          punten: 0,
          beloning: null,
          aangemaaktMs: klok(),
        });

        if (s.modus === 'escape') {
          if (s.status !== 'bezig' || vraagNr < -1 || vraagNr >= s.aantalVragen) throw new LiveFout('geen_vraag');
          if (s.timer !== null && ms > (s.timer + 2) * 1000) throw new LiveFout('te_laat');
          const eigen = r.antwoorden.filter((a) => a.spelerId === p.id && a.vraagNr === vraagNr).sort((a, b) => a.poging - b.poging);
          if (eigen.some((a) => a.juist)) throw new LiveFout('al_opgelost');
          const laatste = eigen.at(-1);
          if (laatste && (laatste.juist === null || laatste.aangemaaktMs + s.wachttijd * 1000 > klok())) throw new LiveFout('wacht');
          r.antwoorden.push(nieuw((laatste?.poging ?? 0) + 1));
          return;
        }

        if (s.status !== 'vraag' || s.vraagNr !== vraagNr) throw new LiveFout('geen_vraag');
        if (s.timer !== null && ms > (s.timer + 2) * 1000) throw new LiveFout('te_laat');
        if (r.antwoorden.some((a) => a.spelerId === p.id && a.vraagNr === vraagNr)) throw new LiveFout('al_geantwoord');
        r.antwoorden.push(nieuw(1));
      });
    },

    volgSessie(sessieId, cb) {
      return volg(() => {
        const r = lees();
        const s = sessie(r, sessieId);
        return s && (s.host === uid || isSpeler(r, sessieId)) ? zonderIntern(s) : null;
      }, cb);
    },
  };
}
