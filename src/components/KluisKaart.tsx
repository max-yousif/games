import { useState, type FormEvent } from 'react';
import { KLUISCODE_MIN, KluisFout } from '../lib/kluis';
import type { Kluis } from '../lib/useKluis';
import { Button, inputClass, Notice } from './ui';

const STATUS = {
  uit: '',
  bezig: '⏳ bezig met synchroniseren…',
  ok: '✅ gesynchroniseerd',
  fout: '⚠️ probleem',
};

/** Klassen op al je toestellen: dit toestel koppelen aan je kluis in Supabase. */
export function KluisKaart({ kluis }: { kluis: Kluis }) {
  const [code, setCode] = useState('');
  const [toon, setToon] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function koppel(modus: 'nieuw' | 'openen') {
    setBezig(true);
    setFout(null);
    try {
      await kluis.koppel(code, modus);
      setCode('');
    } catch (e) {
      setFout(e instanceof KluisFout || e instanceof Error ? e.message : 'De kluis kon niet bereikt worden.');
    } finally {
      setBezig(false);
    }
  }

  if (!kluis.beschikbaar) {
    return (
      <div className="mb-6">
        <Notice>☁️ Klassen op al je toestellen kan pas wanneer Supabase ingesteld is (zie supabase/README.md).</Notice>
      </div>
    );
  }

  if (kluis.gekoppeld) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm">
        <span className="text-lg">☁️</span>
        <span>
          <strong>Je klassen staan in je kluis</strong> en zijn beschikbaar op elk toestel waar je dezelfde kluiscode ingeeft. {STATUS[kluis.status]}
          {kluis.laatsteSync && kluis.status === 'ok' && <span className="text-slate-500"> ({new Date(kluis.laatsteSync).toLocaleString('nl-BE')})</span>}
        </span>
        {kluis.melding && <span className="w-full text-red-700">{kluis.melding}</span>}
        <Button
          className="ml-auto"
          onClick={() => confirm('Deze laptop loskoppelen van je kluis? De klassen blijven op deze laptop en in je kluis staan.') && kluis.ontkoppel()}
        >
          Loskoppelen op dit toestel
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">☁️ Klassen op al je toestellen</h2>
      <p className="mt-1 text-sm text-slate-600">
        Kies een persoonlijke <strong>kluiscode</strong> (minstens {KLUISCODE_MIN} tekens, bv. een korte zin) en geef die op elke laptop of computer één keer in. Je klassen
        worden in je browser versleuteld met die code: op de server staat enkel onleesbare tekst. Onthoud je kluiscode goed: zonder code kan niemand je klassen terughalen,
        ook wij niet.
      </p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void koppel('openen');
        }}
      >
        <input
          type={toon ? 'text' : 'password'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Je kluiscode"
          aria-label="Kluiscode"
          autoComplete="current-password"
          className={`${inputClass} max-w-sm`}
        />
        <Button onClick={() => setToon((t) => !t)}>{toon ? 'Verbergen' : 'Tonen'}</Button>
        <Button variant="primary" disabled={bezig || code.trim().length < KLUISCODE_MIN} onClick={() => void koppel('openen')}>
          Bestaande kluis openen
        </Button>
        <Button disabled={bezig || code.trim().length < KLUISCODE_MIN} onClick={() => void koppel('nieuw')}>
          Nieuwe kluis maken
        </Button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        Eerste keer? Kies <em>Nieuwe kluis maken</em> op de laptop waar je klassen al staan. Op een ander toestel kies je <em>Bestaande kluis openen</em>: de klassen
        worden samengevoegd. Daarna gaat alles vanzelf.
      </p>
      {fout && (
        <div className="mt-3">
          <Notice tone="warn">{fout}</Notice>
        </div>
      )}
    </div>
  );
}
