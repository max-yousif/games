import { lokaalBackend } from './lokaal';
import { supabaseBackend } from './supabase';
import type { LiveBackend } from './types';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Is Supabase ingesteld voor deze website? */
export const supabaseIngesteld = Boolean(URL && KEY);

const cache: Partial<Record<LiveBackend['soort'], LiveBackend>> = {};

export function backend(soort: LiveBackend['soort']): LiveBackend {
  if (soort === 'supabase' && !supabaseIngesteld) throw new Error('Supabase is niet ingesteld.');
  return (cache[soort] ??= soort === 'supabase' ? supabaseBackend(URL!, KEY!) : lokaalBackend());
}
