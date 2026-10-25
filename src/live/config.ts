import { lokaalBackend } from './lokaal';
import { supabaseBackend, supabaseClient } from './supabase';
import type { LiveBackend } from './types';

// Zonder schuine streep achteraan (zoals de URL soms gekopieerd wordt).
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** Is Supabase ingesteld voor deze website? */
export const supabaseIngesteld = Boolean(URL && KEY);

const cache: Partial<Record<LiveBackend['soort'], LiveBackend>> = {};

/**
 * Server voor de live spellen. Met Supabase is één browser altijd één leerling (de aanmelding wordt
 * gedeeld door alle tabbladen); de demo-server telt elk tabblad als een aparte laptop.
 */
export function backend(soort: LiveBackend['soort']): LiveBackend {
  if (soort === 'supabase' && !supabaseIngesteld) throw new Error('Supabase is niet ingesteld.');
  return (cache[soort] ??= soort === 'supabase' ? supabaseBackend(URL!, KEY!) : lokaalBackend());
}

let verbinding: ReturnType<typeof supabaseClient> | undefined;

/** Supabase-client van de leerkracht (aanmelden en cloudopslag); null als Supabase niet ingesteld is. */
export function cloud() {
  if (!supabaseIngesteld) return null;
  return (verbinding ??= supabaseClient(URL!, KEY!));
}
