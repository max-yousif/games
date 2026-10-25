import { lokaalBackend } from './lokaal';
import { supabaseBackend } from './supabase';
import type { LiveBackend } from './types';

// Zonder schuine streep achteraan (zoals de URL soms gekopieerd wordt).
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** Is Supabase ingesteld voor deze website? */
export const supabaseIngesteld = Boolean(URL && KEY);

const cache = new Map<string, LiveBackend>();

/**
 * @param perTabblad (enkel Supabase) elk tabblad meldt zich apart aan, om met meerdere leerlingen te
 *   testen op één laptop. De demo-server telt elk tabblad altijd als een aparte laptop.
 */
export function backend(soort: LiveBackend['soort'], perTabblad = false): LiveBackend {
  if (soort === 'supabase' && !supabaseIngesteld) throw new Error('Supabase is niet ingesteld.');
  const sleutel = `${soort}:${perTabblad}`;
  let b = cache.get(sleutel);
  if (!b) {
    b = soort === 'supabase' ? supabaseBackend(URL!, KEY!, perTabblad) : lokaalBackend();
    cache.set(sleutel, b);
  }
  return b;
}
