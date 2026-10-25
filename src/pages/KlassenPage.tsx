import { useState } from 'react';
import { KluisKaart } from '../components/KluisKaart';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader } from '../components/ui';
import { newId } from '../lib/ids';
import { readSpreadsheet, UnsupportedFileError } from '../lib/importFile';
import type { Store } from '../lib/store';
import { naarLeerlingen, parseNamen, rijenNaarNamen, sorteerOpNaam } from '../lib/students';
import type { Klas } from '../lib/types';

export function KlassenPage({ store }: { store: Store }) {
  const [gekozen, setGekozen] = useState<string | null>(store.klassen[0]?.id ?? null);
  const klas = store.klassen.find((k) => k.id === gekozen) ?? null;

  function nieuweKlas() {
    const k: Klas = { id: newId(), naam: `Klas ${store.klassen.length + 1}`, leerlingen: [] };
    store.setKlassen((all) => [...all, k]);
    setGekozen(k.id);
  }

  return (
    <div>
      <PageHeader title="Klassen">
        <Button variant="primary" onClick={nieuweKlas}>
          + Nieuwe klas
        </Button>
      </PageHeader>

      <KluisKaart kluis={store.kluis} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {store.klassen.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setGekozen(k.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                k.id === gekozen ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-slate-100'
              }`}
            >
              <span>{k.naam || 'Naamloze klas'}</span>
              <span className="text-xs text-slate-500">{k.leerlingen.length}</span>
            </button>
          ))}
          {store.klassen.length === 0 && <p className="px-3 text-sm text-slate-500">Nog geen klassen.</p>}
        </nav>

        {klas ? (
          <KlasEditor
            key={klas.id}
            klas={klas}
            onChange={(f) => store.setKlassen((all) => all.map((k) => (k.id === klas.id ? f(k) : k)))}
            onDelete={() => {
              if (confirm(`Klas "${klas.naam}" verwijderen? Gespeelde resultaten blijven bewaard.`)) {
                store.setKlassen((all) => all.filter((k) => k.id !== klas.id));
                setGekozen(null);
              }
            }}
          />
        ) : (
          <Notice>Maak een klas aan en plak de namen van je leerlingen.</Notice>
        )}
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Zonder kluis blijven de namen enkel in deze browser (en in je back-upbestand). Met een kluis staan ze versleuteld in Supabase: enkel wie de kluiscode kent, kan ze lezen.
      </p>
    </div>
  );
}

function KlasEditor({ klas, onChange, onDelete }: { klas: Klas; onChange: (f: (k: Klas) => Klas) => void; onDelete: () => void }) {
  const [plak, setPlak] = useState('');
  const [fout, setFout] = useState<string | null>(null);

  const voegToe = (namen: string[]) => {
    const bestaand = new Set(klas.leerlingen.map((l) => l.naam.toLocaleLowerCase('nl')));
    const nieuw = namen.filter((n) => !bestaand.has(n.toLocaleLowerCase('nl')));
    onChange((k) => ({ ...k, leerlingen: sorteerOpNaam([...k.leerlingen, ...naarLeerlingen(nieuw)]) }));
  };

  async function importeer(file: File) {
    try {
      setFout(null);
      voegToe(rijenNaarNamen(await readSpreadsheet(file)));
    } catch (e) {
      setFout(e instanceof UnsupportedFileError ? e.message : 'Het bestand kon niet gelezen worden.');
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-60">
          <label className={labelClass}>Naam van de klas</label>
          <input className={inputClass} value={klas.naam} onChange={(e) => onChange((k) => ({ ...k, naam: e.target.value }))} />
        </div>
        <Button variant="danger" className="ml-auto" onClick={onDelete}>
          Klas verwijderen
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className={labelClass}>Namen plakken (één leerling per lijn, bv. uit Excel of Smartschool)</label>
          <textarea className={`${inputClass} h-40`} value={plak} onChange={(e) => setPlak(e.target.value)} placeholder={'Anna Peeters\nBert Claes\n…'} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={!plak.trim()}
              onClick={() => {
                voegToe(parseNamen(plak));
                setPlak('');
              }}
            >
              Toevoegen
            </Button>
            <FileButton accept=".xlsx,.csv" onFile={importeer}>
              Importeren uit Excel…
            </FileButton>
          </div>
          {fout && (
            <div className="mt-2">
              <Notice tone="warn">{fout}</Notice>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelClass}>Leerlingen ({klas.leerlingen.length})</span>
            {klas.leerlingen.length > 0 && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => confirm('Alle leerlingen uit deze klas verwijderen?') && onChange((k) => ({ ...k, leerlingen: [] }))}
              >
                alles wissen
              </button>
            )}
          </div>
          <ul className="max-h-96 space-y-1 overflow-y-auto pr-1">
            {klas.leerlingen.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <input
                  className={`${inputClass} py-1`}
                  value={l.naam}
                  onChange={(e) => onChange((k) => ({ ...k, leerlingen: k.leerlingen.map((x) => (x.id === l.id ? { ...x, naam: e.target.value } : x)) }))}
                />
                <button
                  type="button"
                  className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`${l.naam} verwijderen`}
                  onClick={() => onChange((k) => ({ ...k, leerlingen: k.leerlingen.filter((x) => x.id !== l.id) }))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
