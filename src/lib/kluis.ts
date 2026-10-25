import type { Klas } from './types';

/**
 * Kluis van de leerkracht: de klassen versleuteld bewaren in Supabase, zodat ze op elk toestel
 * beschikbaar zijn. Uit de persoonlijke kluiscode worden twee dingen afgeleid (PBKDF2): een id om
 * de kluis terug te vinden en een aparte AES-sleutel. De server ziet nooit de code of de namen.
 */

export const KLUISCODE_MIN = 10;
const ITERATIES = 200_000;

export interface KluisInhoud {
  versie: 1;
  bijgewerkt: string;
  klassen: Klas[];
}

export class KluisFout extends Error {}

const naarHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const naarB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const vanB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Spaties aan het begin en einde tellen niet mee. */
export const normaliseerCode = (code: string) => code.trim();

const cache = new Map<string, Promise<{ id: string; sleutel: CryptoKey }>>();

/** Leidt het kluis-id en de AES-sleutel af uit de kluiscode (traag met opzet: tegen raden). */
export function kluisSleutels(code: string): Promise<{ id: string; sleutel: CryptoKey }> {
  const c = normaliseerCode(code);
  let s = cache.get(c);
  if (!s) {
    s = (async () => {
      const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(c), 'PBKDF2', false, ['deriveBits']);
      const bits = (doel: string) =>
        crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(`klasspelen-kluis-${doel}`), iterations: ITERATIES }, basis, 256);
      const [id, sleutelBits] = await Promise.all([bits('id'), bits('sleutel')]);
      const sleutel = await crypto.subtle.importKey('raw', sleutelBits, 'AES-GCM', false, ['encrypt', 'decrypt']);
      return { id: naarHex(id), sleutel };
    })();
    cache.set(c, s);
  }
  return s;
}

export async function versleutel(inhoud: KluisInhoud, sleutel: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sleutel, new TextEncoder().encode(JSON.stringify(inhoud))));
  return JSON.stringify({ v: 1, iv: naarB64(iv), data: naarB64(data) });
}

export async function ontsleutel(tekst: string, sleutel: CryptoKey): Promise<KluisInhoud> {
  try {
    const { iv, data } = JSON.parse(tekst) as { iv: string; data: string };
    const plat = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vanB64(iv) }, sleutel, vanB64(data));
    const inhoud = JSON.parse(new TextDecoder().decode(plat)) as KluisInhoud;
    if (!Array.isArray(inhoud.klassen)) throw new Error('ongeldig');
    return inhoud;
  } catch {
    throw new KluisFout('De kluis kon niet geopend worden met deze kluiscode.');
  }
}

/** Wat de kluis nodig heeft van de server (Supabase of een test). */
export interface KluisServer {
  lees(id: string): Promise<{ data: string; bijgewerkt: string } | null>;
  schrijf(id: string, data: string): Promise<string>;
}

export async function leesKluis(server: KluisServer, code: string): Promise<KluisInhoud | null> {
  const { id, sleutel } = await kluisSleutels(code);
  const rij = await server.lees(id);
  return rij ? ontsleutel(rij.data, sleutel) : null;
}

export async function schrijfKluis(server: KluisServer, code: string, klassen: Klas[]): Promise<KluisInhoud> {
  const { id, sleutel } = await kluisSleutels(code);
  const inhoud: KluisInhoud = { versie: 1, bijgewerkt: new Date().toISOString(), klassen };
  await server.schrijf(id, await versleutel(inhoud, sleutel));
  return inhoud;
}
