import { useState } from 'react';
import { Button, FileButton, Notice, Section } from '../components/ui';
import { BackupError, downloadJson, leesBestand, maakBackup, voegSamen } from '../lib/backup';
import { beeindigSpel } from '../lib/beeindigen';
import { datumTekst, SPEL_NAMEN } from '../lib/exportResults';
import { href } from '../lib/route';
import { isBewaard } from '../lib/session';
import type { Store } from '../lib/store';

const TEGELS = [
  { href: href({ pagina: 'spelen' }), icoon: '🎮', titel: 'Spelen' },
  { href: href({ pagina: 'sets' }), icoon: '📝', titel: 'Vragensets' },
  { href: href({ pagina: 'klassen' }), icoon: '👥', titel: 'Klassen' },
  { href: href({ pagina: 'resultaten' }), icoon: '📊', titel: 'Resultaten' },
];

export function StartPage({ store }: { store: Store }) {
  const [melding, setMelding] = useState<{ tone: 'ok' | 'warn'; tekst: string } | null>(null);
  const aangemeld = !!store.account.leerkracht;
  const lopend = store.sessies.filter((s) => !s.beeindigd).sort((a, b) => b.gestart.localeCompare(a.gestart));

  async function importeer(file: File) {
    try {
      const data = leesBestand(await file.text());
      if (data.soort === 'set') {
        store.setSets((all) => voegSamen(all, [data.set]));
        setMelding({ tone: 'ok', tekst: `Vragenset "${data.set.titel}" toegevoegd.` });
      } else {
        const b = data.backup;
        store.setSets((all) => voegSamen(all, b.sets));
        store.setKlassen((all) => voegSamen(all, b.klassen));
        store.setSessies((all) => voegSamen(all, b.sessies));
        setMelding({ tone: 'ok', tekst: `Back-up teruggezet: ${b.sets.length} vragensets, ${b.klassen.length} klassen, ${b.sessies.length} gespeelde spellen.` });
      }
    } catch (e) {
      setMelding({ tone: 'warn', tekst: e instanceof BackupError ? e.message : 'Het bestand kon niet gelezen worden.' });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">Klasspelen</h1>
        </div>
        <a href={href({ pagina: 'live', demo: false })} className="ml-auto rounded-xl border-2 border-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-tekst)] hover:bg-[var(--accent-soft)]">
          💻 Leerling? Live meespelen
        </a>
      </div>

      {lopend.length > 0 && (
        <Section title="Verder spelen">
          <ul className="divide-y divide-slate-100">
            {lopend.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{s.setTitel}</span>
                <span className="text-sm text-slate-500">
                  {SPEL_NAMEN[s.spelType]} · {s.klasNaam} · {datumTekst(s.gestart)} · {s.beurten.length} beurten
                </span>
                <a href={href({ pagina: 'sessie', id: s.id })} className="ml-auto rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
                  Hervatten
                </a>
                <Button
                  onClick={async () => {
                    if (confirm(`"${s.setTitel}" (${s.klasNaam}) beëindigen? De resultaten blijven bewaard onder Resultaten.`)) store.bewaarSessie(await beeindigSpel(s));
                  }}
                >
                  Beëindigen
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEGELS.map((t) => (
          <a key={t.titel} href={t.href} className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-4xl">{t.icoon}</div>
            <div className="mt-3 text-lg font-semibold">{t.titel}</div>
          </a>
        ))}
      </div>

      <details className="group text-sm text-slate-500" open={melding !== null || undefined}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 hover:text-slate-700">
          <span className="transition group-open:rotate-90">▸</span> Back-up als bestand
        </summary>
        <div className="mt-2 rounded-2xl border border-slate-200 bg-surface p-5">
          <p className="mb-4 text-sm text-slate-600">
            {aangemeld ? (
              <>
                ☁️ Alles staat al in je account; dit is een extra kopie.
              </>
            ) : (
              <>
                Alles staat enkel in deze browser.
                {store.account.beschikbaar && (
                  <>
                    {' '}
                    <a className="font-semibold text-[var(--accent-tekst)] underline" href={href({ pagina: 'aanmelden' })}>meld je aan</a>
                  </>
                )}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => downloadJson(`klasspelen-backup-${new Date().toISOString().slice(0, 10)}.json`, maakBackup(store.sets, store.klassen, store.sessies.filter(isBewaard)))}
            >
              Back-up downloaden
            </Button>
            <FileButton accept=".json,application/json" onFile={importeer}>
              Back-up of vragenset terugzetten…
            </FileButton>
          </div>
          {melding && (
            <div className="mt-4">
              <Notice tone={melding.tone}>{melding.tekst}</Notice>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
