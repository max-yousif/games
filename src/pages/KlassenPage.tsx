import { useMemo, useState } from 'react';
import { CloudKaart } from '../components/Account';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader } from '../components/ui';
import { newId } from '../lib/ids';
import { readSpreadsheet, UnsupportedFileError } from '../lib/importFile';
import type { Store } from '../lib/store';
import { naamKandidaten, naarLeerlingen, plakNaarRijen, raadKlaslijst, sorteerOpNaam, type KlaslijstKeuze, type NaamKandidaat } from '../lib/students';
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

      <CloudKaart store={store} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {store.klassen.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setGekozen(k.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                k.id === gekozen ? 'bg-[var(--accent-soft)] text-[var(--accent-tekst)]' : 'hover:bg-slate-100'
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
        Zonder aanmelden blijven de namen enkel in deze browser (en in je back-upbestand). Aangemeld staan ze in je account in Supabase: enkel jij kan ze lezen.
      </p>
    </div>
  );
}

function KlasEditor({ klas, onChange, onDelete }: { klas: Klas; onChange: (f: (k: Klas) => Klas) => void; onDelete: () => void }) {
  const [plak, setPlak] = useState('');
  const [bestand, setBestand] = useState<{ naam: string; rijen: string[][] } | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  function voegToe(namen: string[]) {
    onChange((k) => ({ ...k, leerlingen: sorteerOpNaam([...k.leerlingen, ...naarLeerlingen(namen)]) }));
    setPlak('');
    setBestand(null);
  }

  async function importeer(file: File) {
    try {
      setFout(null);
      const rijen = await readSpreadsheet(file);
      if (rijen.length === 0) throw new Error('leeg');
      setBestand({ naam: file.name, rijen });
    } catch (e) {
      setFout(e instanceof UnsupportedFileError ? e.message : 'Het bestand kon niet gelezen worden of is leeg.');
    }
  }

  const rijen = bestand?.rijen ?? (plak.trim() ? plakNaarRijen(plak) : null);

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
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
          {bestand ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-4 text-sm">
              <span className="text-2xl">📄</span>
              <span>
                <strong>{bestand.naam}</strong> · {bestand.rijen.length} rijen
              </span>
              <Button className="ml-auto" onClick={() => setBestand(null)}>
                ✕
              </Button>
            </div>
          ) : (
            <>
              <label className={labelClass} htmlFor="namen-plakken">
                Namen plakken (bv. uit Excel, Smartschool of Word)
              </label>
              <textarea
                id="namen-plakken"
                className={`${inputClass} h-40`}
                value={plak}
                onChange={(e) => setPlak(e.target.value)}
                placeholder={'Anna Peeters\nBert Claes\n…\n\nTitels en klasnummers mogen mee: je kiest straks wie je toevoegt.'}
              />
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <FileButton accept=".xlsx,.csv" onFile={importeer}>
              Importeren uit Excel…
            </FileButton>
          </div>
          {fout && (
            <div className="mt-2">
              <Notice tone="warn">{fout}</Notice>
            </div>
          )}
          {rijen && (
            <KlaslijstVoorbeeld
              key={bestand?.naam ?? 'plak'}
              rijen={rijen}
              bestaand={klas.leerlingen.map((l) => l.naam)}
              onToevoegen={voegToe}
              onAnnuleren={() => {
                setPlak('');
                setBestand(null);
              }}
            />
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

/** Voorbeeld van een geplakte of geïmporteerde klaslijst: kolommen kiezen en leerlingen aan- of uitvinken. */
function KlaslijstVoorbeeld({
  rijen,
  bestaand,
  onToevoegen,
  onAnnuleren,
}: {
  rijen: string[][];
  bestaand: string[];
  onToevoegen: (namen: string[]) => void;
  onAnnuleren: () => void;
}) {
  const geraden = useMemo(() => raadKlaslijst(rijen), [rijen]);
  const [keuze, setKeuze] = useState<KlaslijstKeuze | null>(null);
  const [gekozen, setGekozen] = useState<Record<string, boolean>>({});
  const k = keuze ?? geraden;
  const kandidaten = useMemo(() => naamKandidaten(rijen, k, bestaand), [rijen, k, bestaand]);
  const breedte = Math.max(...rijen.map((r) => r.length));
  const isAan = (c: NaamKandidaat, i: number) => gekozen[`${i}:${c.naam}`] ?? c.aan;
  const namen = kandidaten.filter(isAan).map((c) => c.naam);

  function wisselKolom(i: number) {
    setKeuze({ ...k, naamKolommen: k.naamKolommen.includes(i) ? k.naamKolommen.filter((x) => x !== i) : [...k.naamKolommen, i] });
  }

  // Voorbeeld van wat in een kolom staat: de titel of de eerste waarden.
  const kolomLabel = (i: number) => {
    const waarden = rijen.slice(k.kopRij + 1).map((r) => r[i] ?? '').filter(Boolean);
    const titel = k.kopRij >= 0 ? rijen[k.kopRij][i] : '';
    return { titel, voorbeeld: waarden.slice(0, 2).join(', ') };
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {breedte > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">Welke kolommen vormen de naam? (klik in de volgorde van de naam)</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: breedte }, (_, i) => {
              const plaats = k.naamKolommen.indexOf(i);
              const { titel, voorbeeld } = kolomLabel(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => wisselKolom(i)}
                  aria-pressed={plaats >= 0}
                  className={`max-w-48 rounded-lg border px-3 py-1.5 text-left text-xs ${
                    plaats >= 0 ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-tekst)]' : 'border-slate-300 bg-surface text-slate-500'
                  }`}
                >
                  <span className="block truncate font-semibold">
                    {plaats >= 0 ? `${plaats + 1}. ` : ''}
                    {titel || `Kolom ${i + 1}`}
                  </span>
                  <span className="block truncate">{voorbeeld || '(leeg)'}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={k.kopRij >= 0}
              onChange={(e) => setKeuze({ ...k, kopRij: e.target.checked ? Math.max(geraden.kopRij, 0) : -1 })}
            />
            {geraden.kopRij > 0 ? `Rij ${geraden.kopRij + 1} bevat kolomtitels (de rijen erboven worden overgeslagen)` : 'De eerste rij bevat kolomtitels'}
          </label>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span>
          <strong>{namen.length}</strong> van {kandidaten.length} aangevinkt
        </span>
        <span className="flex gap-3">
          <button type="button" className="text-[var(--accent-tekst)] hover:underline" onClick={() => setGekozen(Object.fromEntries(kandidaten.map((c, i) => [`${i}:${c.naam}`, true])))}>
            alles aan
          </button>
          <button type="button" className="text-[var(--accent-tekst)] hover:underline" onClick={() => setGekozen(Object.fromEntries(kandidaten.map((c, i) => [`${i}:${c.naam}`, false])))}>
            alles uit
          </button>
        </span>
      </div>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-surface p-2">
        {kandidaten.map((c, i) => {
          const aan = isAan(c, i);
          return (
            <li key={i}>
              <label className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50 ${aan ? '' : 'text-slate-400'}`}>
                <input type="checkbox" checked={aan} onChange={(e) => setGekozen((g) => ({ ...g, [`${i}:${c.naam}`]: e.target.checked }))} />
                <span className={aan ? '' : 'line-through'}>{c.naam}</span>
                {c.reden && <span className="ml-auto text-xs italic text-slate-400">{c.reden}</span>}
              </label>
            </li>
          );
        })}
        {kandidaten.length === 0 && <li className="px-2 py-1 text-sm text-slate-500">Geen namen gevonden. Kies een andere kolom.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={namen.length === 0} onClick={() => onToevoegen(namen)}>
          ✓ {namen.length} {namen.length === 1 ? 'leerling' : 'leerlingen'} toevoegen
        </Button>
        <Button variant="ghost" onClick={onAnnuleren}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
