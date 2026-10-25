import { useState, type FormEvent } from 'react';
import { Button, inputClass, labelClass, Notice } from '../components/ui';
import { LiveFout } from '../live/types';
import { ga, href } from '../lib/route';
import type { Store } from '../lib/store';

export function AanmeldenPage({ store }: { store: Store }) {
  const [naam, setNaam] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const { account } = store;

  async function verstuur(e: FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    try {
      await account.aanmelden(naam, wachtwoord);
      ga({ pagina: 'start' });
    } catch (err) {
      setFout(err instanceof LiveFout && err.code === 'geen_leerkracht' ? 'Dit account is nog geen leerkrachtaccount: voeg het toe aan de tabel leerkrachten (zie supabase/README.md).' : err instanceof LiveFout ? err.message : 'Aanmelden lukte niet. Controleer de internetverbinding.');
    } finally {
      setBezig(false);
    }
  }

  if (!account.beschikbaar)
    return <Notice>Aanmelden kan pas wanneer Supabase ingesteld is (zie supabase/README.md).</Notice>;

  if (account.leerkracht)
    return (
      <div className="mx-auto max-w-sm">
        <Notice tone="ok">
          Je bent aangemeld als <strong>{account.leerkracht.naam}</strong>. <a className="underline" href={href({ pagina: 'start' })}>Naar de startpagina</a>
        </Notice>
      </div>
    );

  return (
    <form onSubmit={verstuur} className="mx-auto max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold">Aanmelden als leerkracht</h1>
      <p className="text-sm text-slate-600">Na het aanmelden staan je vragensets, klassen en resultaten op elk toestel, en kan je live spellen starten.</p>
      <div>
        <label className={labelClass} htmlFor="login-naam">
          Gebruikersnaam
        </label>
        <input id="login-naam" className={inputClass} autoComplete="username" autoCapitalize="none" value={naam} onChange={(e) => setNaam(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="login-wachtwoord">
          Wachtwoord
        </label>
        <input
          id="login-wachtwoord"
          type="password"
          className={inputClass}
          autoComplete="current-password"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          required
        />
      </div>
      {fout && <Notice tone="warn">{fout}</Notice>}
      <Button type="submit" variant="primary" className="w-full" disabled={bezig}>
        {bezig ? 'Bezig…' : 'Aanmelden'}
      </Button>
      <p className="text-xs text-slate-500">Leerlingen hoeven niet aan te melden: zij gebruiken de spelcode.</p>
    </form>
  );
}
