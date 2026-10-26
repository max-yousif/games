import type { Klas, Sessie, Vragenset } from './types';

/**
 * Synchroniseren van vragensets, klassen en resultaten met de cloud (tabel leerkracht_items).
 * Pure functies: wat moet naar de server, en hoe verwerk je wat van de server komt. "gesync" onthoudt
 * per item de inhoud zoals laatst gelijk met de server; zo weet je wat lokaal gewijzigd is.
 */

export type Soort = 'set' | 'klas' | 'sessie';

export interface Lokaal {
  sets: Vragenset[];
  klassen: Klas[];
  sessies: Sessie[];
}

export interface ServerItem {
  soort: Soort;
  id: string;
  data: unknown;
  verwijderd: boolean;
  bijgewerkt: string;
}

/** Inhoud per item zoals laatst gelijk met de server, op sleutel "soort:id". */
export type Gesync = Record<string, string>;

const sleutel = (soort: Soort, id: string) => `${soort}:${id}`;

/** JSON met gesorteerde sleutels: de database (jsonb) bewaart de volgorde niet. */
export function vast(waarde: unknown): string {
  return JSON.stringify(waarde, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

function* items(l: Lokaal): Generator<{ soort: Soort; id: string; data: Vragenset | Klas | Sessie }> {
  for (const s of l.sets) yield { soort: 'set', id: s.id, data: s };
  for (const k of l.klassen) yield { soort: 'klas', id: k.id, data: k };
  for (const s of l.sessies) yield { soort: 'sessie', id: s.id, data: s };
}

export interface Upload {
  bewaren: { soort: Soort; id: string; data: unknown; json: string }[];
  wissen: { soort: Soort; id: string }[];
}

/** Wat lokaal nieuw of gewijzigd is (bewaren) en wat lokaal gewist werd (wissen). */
export function teUploaden(l: Lokaal, gesync: Gesync): Upload {
  const bewaren: Upload['bewaren'] = [];
  const aanwezig = new Set<string>();
  for (const it of items(l)) {
    const k = sleutel(it.soort, it.id);
    aanwezig.add(k);
    const json = vast(it.data);
    if (gesync[k] !== json) bewaren.push({ ...it, json });
  }
  const wissen = Object.keys(gesync)
    .filter((k) => !aanwezig.has(k))
    .map((k) => {
      const i = k.indexOf(':');
      return { soort: k.slice(0, i) as Soort, id: k.slice(i + 1) };
    });
  return { bewaren, wissen };
}

/** Na een geslaagde upload: onthouden dat deze items nu gelijk zijn met de server. */
export function naUpload(gesync: Gesync, u: Upload): Gesync {
  const nieuw = { ...gesync };
  for (const b of u.bewaren) nieuw[sleutel(b.soort, b.id)] = b.json;
  for (const w of u.wissen) delete nieuw[sleutel(w.soort, w.id)];
  return nieuw;
}

const lijstNaam = { set: 'sets', klas: 'klassen', sessie: 'sessies' } as const;

/**
 * Verwerkt items van de server. Een item dat lokaal niet gewijzigd is sinds de laatste
 * synchronisatie, krijgt de versie van de server (of wordt gewist). Een lokaal gewijzigd item blijft
 * staan en wordt bij de volgende upload bewaard. Bij een eerste synchronisatie op een toestel wint
 * bij vragensets de recentste versie (gewijzigd), anders de server.
 */
export function verwerkDownload(l: Lokaal, server: readonly ServerItem[], gesync: Gesync): { lokaal: Lokaal; gesync: Gesync; gewijzigd: boolean } {
  const lijsten: { [S in keyof Lokaal]: Lokaal[S] } = { sets: [...l.sets], klassen: [...l.klassen], sessies: [...l.sessies] };
  const nieuwGesync = { ...gesync };
  let gewijzigd = false;

  for (const it of server) {
    const k = sleutel(it.soort, it.id);
    const lijst = lijsten[lijstNaam[it.soort]] as { id: string }[];
    const index = lijst.findIndex((x) => x.id === it.id);
    const lokaalJson = index >= 0 ? vast(lijst[index]) : undefined;
    const ongewijzigd = lokaalJson !== undefined && lokaalJson === gesync[k];

    if (it.verwijderd) {
      if (index >= 0 && (ongewijzigd || gesync[k] === undefined)) {
        lijst.splice(index, 1);
        gewijzigd = true;
      }
      if (index < 0 || ongewijzigd || gesync[k] === undefined) delete nieuwGesync[k];
      continue;
    }

    const serverJson = vast(it.data);
    if (lokaalJson === serverJson) {
      nieuwGesync[k] = serverJson;
      continue;
    }
    // Lokaal gewist en op de server niet meer gewijzigd: gewist laten (de upload wist het ook daar).
    if (index < 0 && gesync[k] === serverJson) continue;
    let neemServer = index < 0 || ongewijzigd;
    if (!neemServer && gesync[k] === undefined) {
      // Eerste keer op dit toestel: bij vragensets de recentste, anders de server.
      const lokaalGewijzigd = (lijst[index] as Partial<Vragenset>).gewijzigd;
      const serverGewijzigd = (it.data as Partial<Vragenset>).gewijzigd;
      neemServer = !(lokaalGewijzigd && serverGewijzigd && lokaalGewijzigd > serverGewijzigd);
    }
    if (neemServer) {
      if (index >= 0) lijst[index] = it.data as never;
      else lijst.push(it.data as never);
      nieuwGesync[k] = serverJson;
      gewijzigd = true;
    }
  }
  return { lokaal: lijsten, gesync: nieuwGesync, gewijzigd };
}
