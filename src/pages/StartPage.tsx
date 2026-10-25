import { useState } from 'react';
import { Button, FileButton, Notice, Section } from '../components/ui';
import { BackupError, downloadJson, leesBestand, maakBackup, voegSamen } from '../lib/backup';
import { beeindigSpel } from '../lib/beeindigen';
import { datumTekst, SPEL_NAMEN } from '../lib/exportResults';
import { href } from '../lib/route';
import type { Store } from '../lib/store';

const TEGELS = [
  { href: href({ pagina: 'spelen' }), icoon: '🎮', titel: 'Spelen', tekst: 'Kies een vragenset, een spel en een klas.' },
  { href: href({ pagina: 'sets' }), icoon: '📝', titel: 'Vragensets', tekst: 'Maak, bewerk en bewaar je vragen.' },
  { href: href({ pagina: 'klassen' }), icoon: '👥', titel: 'Klassen', tekst: 'Leerlingenlijsten per klas.' },
  { href: href({ pagina: 'resultaten' }), icoon: '📊', titel: 'Resultaten', tekst: 'Gespeelde spellen bekijken en exporteren.' },
];

export function StartPage({ store }: { store: Store }) {
  const [melding, setMelding] = useState<{ tone: 'ok' | 'warn'; tekst: string } | null>(null);
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
          <p className="mt-1 text-slate-600">Klassikale spelletjes met je eigen vragen: wiskunde en Python.</p>
        </div>
        <a href={href({ pagina: 'live', demo: false })} className="ml-auto rounded-xl border-2 border-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">
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
          <a key={t.titel} href={t.href} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="text-4xl">{t.icoon}</div>
            <div className="mt-3 text-lg font-semibold">{t.titel}</div>
            <div className="mt-1 text-sm text-slate-600">{t.tekst}</div>
          </a>
        ))}
      </div>

      <Section title="Back-up">
        <p className="mb-4 text-sm text-slate-600">
          Alles wordt bewaard in deze browser op deze laptop. Maak regelmatig een back-upbestand: zo verlies je niets als de
          browsergegevens gewist worden, en kan je alles overzetten naar een andere laptop.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => downloadJson(`klasspelen-backup-${new Date().toISOString().slice(0, 10)}.json`, maakBackup(store.sets, store.klassen, store.sessies))}
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
      </Section>
    </div>
  );
}
