/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "1" in de testversie van een voorstel (zie lib/voorstel.ts). */
  readonly VITE_VOORSTEL?: string;
}
