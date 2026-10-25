import { useState } from 'react';
import { href } from '../lib/route';
import type { Store } from '../lib/store';
import type { CloudStatus } from '../lib/useCloud';
import { Button, Notice } from './ui';

const STATUS: Record<CloudStatus, { icoon: string; tekst: string }> = {
  uit: { icoon: '', tekst: '' },
  bezig: { icoon: '⏳', tekst: 'Bezig met synchroniseren…' },
  ok: { icoon: '☁️', tekst: 'Alles staat in de cloud' },
  fout: { icoon: '⚠️', tekst: 'Niet gesynchroniseerd' },
};

/** Knop rechtsboven: aanmelden, of de aangemelde leerkracht met de cloudstatus en afmelden. */
export function AccountKnop({ store }: { store: Store }) {
  const [open, setOpen] = useState(false);
  const { account, cloud } = store;
  if (!account.beschikbaar) return null;
  if (!account.leerkracht)
    return (
      <a href={href({ pagina: 'aanmelden' })} className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        👤 Aanmelden
      </a>
    );

  const s = STATUS[cloud.status];
  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        title={s.tekst}
        aria-expanded={open}
      >
        <span aria-hidden>{s.icoon}</span>
        {account.leerkracht.naam}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 space-y-3 rounded-xl border border-slate-200 bg-surface p-4 text-sm shadow-lg">
          <p>
            Aangemeld als <strong>{account.leerkracht.naam}</strong>.
          </p>
          <p>
            {s.icoon} {s.tekst}
            {cloud.status === 'ok' && cloud.laatsteSync && <span className="text-slate-500"> ({cloud.laatsteSync.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })})</span>}
          </p>
          {cloud.melding && <p className="text-red-700">{cloud.melding}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => cloud.nu()}>Nu synchroniseren</Button>
            <Button
              onClick={() => {
                setOpen(false);
                void store.afmelden(false);
              }}
            >
              Afmelden
            </Button>
          </div>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm('Afmelden en alles van deze computer wissen? Je vragensets, klassen en resultaten blijven in de cloud staan.')) {
                setOpen(false);
                void store.afmelden(true);
              }
            }}
          >
            Afmelden en deze computer leegmaken
          </Button>
          <p className="text-xs text-slate-500">Gebruik dit laatste op een gedeelde computer, zodat de namen van je leerlingen er niet blijven staan.</p>
        </div>
      )}
    </div>
  );
}

/** Uitleg bovenaan de klassen: staan ze in de cloud of enkel in deze browser? */
export function CloudKaart({ store }: { store: Store }) {
  const { account, cloud } = store;
  if (!account.beschikbaar)
    return (
      <div className="mb-6">
        <Notice>☁️ Je klassen op al je toestellen kan pas wanneer Supabase ingesteld is (zie supabase/README.md).</Notice>
      </div>
    );
  if (!account.leerkracht)
    return (
      <div className="mb-6">
        <Notice tone="warn">
          Je klassen staan nu enkel in deze browser.{' '}
          <a className="font-semibold underline" href={href({ pagina: 'aanmelden' })}>
            Meld je aan
          </a>{' '}
          om je vragensets, klassen en resultaten op al je toestellen te hebben.
        </Notice>
      </div>
    );
  return (
    <div className="mb-6">
      <Notice tone={cloud.status === 'fout' ? 'warn' : 'ok'}>
        {STATUS[cloud.status].icoon} Je vragensets, klassen en resultaten staan in je account <strong>{account.leerkracht.naam}</strong> en zijn beschikbaar op elk toestel
        waar je aanmeldt.
        {cloud.melding && <span className="block text-red-700">{cloud.melding}</span>}
      </Notice>
    </div>
  );
}
