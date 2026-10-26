import { useState } from 'react';
import { Button, FileButton, Notice, PageHeader } from '../components/ui';
import { BackupError, bestandsnaam, downloadJson, leesBestand, setBestand, voegSamen } from '../lib/backup';
import { nu } from '../lib/ids';
import { dupliceerSet, nieuweSet, speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { ontbrekendeVoorbeelden, type Store } from '../lib/store';
import type { Vak, Vragenset } from '../lib/types';

export const VAK_LABELS: Record<Vak, string> = { wiskunde: 'Wiskunde', python: 'Python', ict: 'ICT', andere: 'Andere' };

export function SetsPage({ store }: { store: Store }) {
  const [melding, setMelding] = useState<{ tone: 'ok' | 'warn'; tekst: string } | null>(null);
  const sets = [...store.sets].sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
  const ontbrekend = ontbrekendeVoorbeelden(store.sets);

  function nieuw() {
    const s = nieuweSet();
    store.setSets((all) => [...all, s]);
    ga({ pagina: 'set', id: s.id });
  }

  async function importeerJson(file: File) {
    try {
      const data = leesBestand(await file.text());
      const nieuwe = data.soort === 'set' ? [data.set] : data.backup.sets;
      store.setSets((all) => voegSamen(all, nieuwe));
      setMelding({ tone: 'ok', tekst: `${nieuwe.length} vragenset(s) toegevoegd.` });
    } catch (e) {
      setMelding({ tone: 'warn', tekst: e instanceof BackupError ? e.message : 'Het bestand kon niet gelezen worden.' });
    }
  }

  function verwijder(s: Vragenset) {
    if (confirm(`Vragenset "${s.titel}" verwijderen? Gespeelde resultaten blijven bewaard.`)) {
      store.setSets((all) => all.filter((x) => x.id !== s.id));
    }
  }

  return (
    <div>
      <PageHeader title="Vragensets">
        <Button variant="primary" onClick={nieuw}>
          + Nieuwe vragenset
        </Button>
        <a href={href({ pagina: 'importeren' })} className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium hover:bg-slate-50">
          📥 Vragen importeren
        </a>
        <FileButton accept=".json,application/json" onFile={importeerJson}>
          Openen uit bestand…
        </FileButton>
      </PageHeader>

      {melding && (
        <div className="mb-4">
          <Notice tone={melding.tone}>{melding.tekst}</Notice>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sets.map((s) => {
          const categorieen = [...new Set(s.vragen.map((v) => v.categorie.trim()).filter(Boolean))];
          const klaar = speelbareVragen(s).length;
          return (
            <div key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
              {s.cover && <img src={s.cover} alt="" className="aspect-[16/6] w-full object-cover" />}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-tekst)]">{VAK_LABELS[s.vak]}</span>
                  {s.leerjaar && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{s.leerjaar}</span>}
                  {s.voorbeeld && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">voorbeeld</span>}
                </div>
                <h2 className="mt-2 text-lg font-semibold">{s.titel}</h2>
                {s.beschrijving && <p className="mt-1 text-sm text-slate-600">{s.beschrijving}</p>}
                <p className="mt-2 text-sm text-slate-500">
                  {s.vragen.length} vragen{klaar < s.vragen.length && ` (${s.vragen.length - klaar} onvolledig)`}
                  {categorieen.length > 0 && ` · ${categorieen.join(', ')}`}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {s.statistiek?.gespeeld
                    ? `▶ ${s.statistiek.gespeeld}× gespeeld · ${s.statistiek.spelers} ${s.statistiek.spelers === 1 ? 'speler' : 'spelers'}`
                    : '▶ nog niet gespeeld'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <a href={href({ pagina: 'spelen', setId: s.id })} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
                    Spelen
                  </a>
                  <a href={href({ pagina: 'set', id: s.id })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    Bewerken
                  </a>
                  <Button onClick={() => store.setSets((all) => [...all, dupliceerSet(s)])}>Dupliceren</Button>
                  <Button onClick={() => downloadJson(bestandsnaam(s.titel, 'json'), setBestand(s))}>Als bestand</Button>
                  <Button variant="ghost" className="ml-auto text-red-600" onClick={() => verwijder(s)} title="Verwijderen" aria-label={`${s.titel} verwijderen`}>
                    🗑
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sets.length === 0 && <Notice>Nog geen vragensets. Maak een nieuwe set of importeer vragen.</Notice>}

      <div className="mt-8 space-y-2 text-sm text-slate-600">
        <p>
          <strong>Vragen importeren:</strong> plak cellen uit Excel of Google Sheets, tekst uit Word of van een AI-chatbot, of sleep een Excel-bestand. Je ziet meteen
          een voorbeeld van elke vraag voor je ze toevoegt.{' '}
          <a className="text-[var(--accent-tekst)] underline" href={href({ pagina: 'importeren' })}>
            Vragen importeren
          </a>
        </p>
        {ontbrekend.length > 0 && (
          <p>
            <button
              type="button"
              className="text-[var(--accent-tekst)] underline"
              onClick={() => store.setSets((all) => [...all, ...ontbrekend.map((v) => ({ ...v, gewijzigd: nu() }))])}
            >
              Voorbeeldsets opnieuw toevoegen
            </button>{' '}
            ({ontbrekend.map((v) => v.titel).join(', ')})
          </p>
        )}
      </div>
    </div>
  );
}
