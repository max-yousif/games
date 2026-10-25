import { cloud } from '../live/config';
import { vertaal } from '../live/supabase';
import type { KluisServer } from './kluis';

/** De kluis in Supabase (functies kluis_lees en kluis_schrijf); null als Supabase niet ingesteld is. */
export function supabaseKluis(): KluisServer | null {
  const c = cloud();
  if (!c) return null;
  return {
    async lees(id) {
      await c.uid();
      const { data, error } = await (await c.sb()).rpc('kluis_lees', { p_id: id });
      if (error) vertaal(error);
      const rij = (data as { data: string; bijgewerkt: string }[])[0];
      return rij ?? null;
    },
    async schrijf(id, data) {
      await c.uid();
      const { data: t, error } = await (await c.sb()).rpc('kluis_schrijf', { p_id: id, p_data: data });
      if (error) vertaal(error);
      return t as string;
    },
  };
}
