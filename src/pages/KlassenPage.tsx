import { useMemo, useState } from 'react';
import { LEERJAREN } from '../components/JaarKeuze';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader } from '../components/ui';
import { newId } from '../lib/ids';
import { readSpreadsheet, UnsupportedFileError } from '../lib/importFile';
import type { Store } from '../lib/store';
import { inkorten, isIngekort, korteNamen, naamKandidaten, naamVolgordeVan, raadNaamVolgorde, naarLeerlingen, plakNaarRijen, raadKlaslijst, sorteerOpNaam, type KlaslijstKeuze, type NaamKandidaat } from '../lib/students';
import type { Klas, NaamVolgorde } from '../lib/types';

/** Het leerjaar uit de naam van een klas: "3A" en "3 LAT" = 3, "6HW" = 6; anders null. */
export function jaarVanKlas(naam: string): number | null {
  const m = naam.trim().match(/^([1-7])(?!\d)/);
  return m ? Number(m[1]) : null;
}

/** Het leerjaar van een klas: zelf gekozen, anders uit de naam. */
export const klasJaar = (k: Pick<Klas, 'naam' | 'jaar'>): number | null => (k.jaar === undefined ? jaarVanKlas(k.naam) : k.jaar || null);

export function KlassenPage({ store }: { store: Store }) {
  // Overzicht van alle klassen, of één klas open.
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const klas = store.klassen.find((k) => k.id === gekozen) ?? null;

  function nieuweKlas() {
    const k: Klas = { id: newId(), naam: `Klas ${store.klassen.length + 1}`, leerlingen: [] };
    store.setKlassen((all) => [...all, k]);
    setGekozen(k.id);
  }

  if (klas) {
    return (
      <div>
        <button type="button" className="mb-3 text-sm font-medium text-[var(--accent-tekst)] hover:underline" onClick={() => setGekozen(null)}>
          ← Alle klassen
        </button>
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
      </div>
    );
  }

  const term = zoek.trim().toLowerCase();
  const gefilterd = store.klassen
    .filter((k) => !term || k.naam.toLowerCase().includes(term) || k.leerlingen.some((l) => l.naam.toLowerCase().includes(term)))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { numeric: true }));
  const vanJaar = (j: number) => gefilterd.filter((k) => klasJaar(k) === j);
  const andere = gefilterd.filter((k) => !LEERJAREN.includes(klasJaar(k) ?? 0));
  const kaart = (k: Klas) => {
    const namen = k.leerlingen.map((l) => l.naam);
    const voornamen = korteNamen(namen, naamVolgordeVan(namen, k.naamVolgorde));
    return (
      <button
        key={k.id}
        type="button"
        aria-label={`${k.naam} ${k.leerlingen.length}`}
        onClick={() => setGekozen(k.id)}
        className="flex w-full flex-col rounded-2xl border-2 border-slate-200 bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-bold">{k.naam || 'Naamloze klas'}</span>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-sm font-semibold text-[var(--accent-tekst)]">👥 {k.leerlingen.length}</span>
        </div>
        <div className="mt-2 line-clamp-2 text-sm text-slate-600">
          {voornamen.length ? voornamen.slice(0, 12).join(', ') + (voornamen.length > 12 ? ', …' : '') : 'Nog geen leerlingen'}
        </div>
      </button>
    );
  };

  return (
    <div>
      <PageHeader title="Klassen">
        <Button variant="primary" onClick={nieuweKlas}>
          + Nieuwe klas
        </Button>
      </PageHeader>

      {store.klassen.length === 0 ? (
        <Notice>Nog geen klassen. Klik op “+ Nieuwe klas” en plak de namen van je leerlingen (bv. uit Smartschool of Excel).</Notice>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-surface p-3 shadow-sm">
            <input
              type="search"
              className={`${inputClass} max-w-xs`}
              placeholder="🔍 Zoek een klas of leerling…"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              aria-label="Zoek een klas of leerling"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEERJAREN.map((j) => (
              <section key={j} className="rounded-2xl bg-slate-100/70 p-3">
                <h2 className="mb-3 flex items-baseline justify-between px-1 text-lg font-bold">
                  {j}e jaar <span className="text-sm font-medium text-slate-500">{vanJaar(j).length}</span>
                </h2>
                <div className="space-y-3">
                  {vanJaar(j).map(kaart)}
                  {vanJaar(j).length === 0 && <p className="px-1 text-sm text-slate-400">{term ? 'Niets gevonden.' : 'Geen klassen.'}</p>}
                </div>
              </section>
            ))}
          </div>
          {andere.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">Zonder leerjaar</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{andere.map(kaart)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function KlasEditor({
  klas,
  onChange,
  onDelete,
}: {
  klas: Klas;
  onChange: (f: (k: Klas) => Klas) => void;
  onDelete: () => void;
}) {
  // Leerlingen toevoegen: open bij een lege klas, anders op vraag.
  const [toevoegen, setToevoegen] = useState(klas.leerlingen.length === 0);
  const [plak, setPlak] = useState('');
  const [bestand, setBestand] = useState<{ naam: string; rijen: string[][] } | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  // Namen komen ingekort binnen ("Anna P."): voornaam eerst.
  function voegToe(namen: string[]) {
    onChange((k) => ({ ...k, naamVolgorde: 'voornaam', leerlingen: sorteerOpNaam([...k.leerlingen, ...naarLeerlingen(namen)]) }));
    setPlak('');
    setBestand(null);
    setToevoegen(false);
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
  const volgorde = naamVolgordeVan(
    klas.leerlingen.map((l) => l.naam),
    klas.naamVolgorde,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="w-60">
          <label className={labelClass} htmlFor="klasnaam">
            Naam van de klas
          </label>
          <input id="klasnaam" className={`${inputClass} text-xl font-bold`} value={klas.naam} onChange={(e) => onChange((k) => ({ ...k, naam: e.target.value }))} />
        </div>
        <div className="w-44">
          <label className={labelClass} htmlFor="klasjaar">
            Leerjaar
          </label>
          <select
            id="klasjaar"
            className={inputClass}
            value={klas.jaar === undefined ? 'auto' : String(klas.jaar)}
            onChange={(e) => onChange((k) => ({ ...k, jaar: e.target.value === 'auto' ? undefined : Number(e.target.value) }))}
          >
            <option value="auto">{jaarVanKlas(klas.naam) ? `${jaarVanKlas(klas.naam)}e jaar (uit de naam)` : 'kies…'}</option>
            {LEERJAREN.map((j) => (
              <option key={j} value={j}>
                {j}e jaar
              </option>
            ))}
            <option value="0">geen jaar</option>
          </select>
        </div>
        <div className="pb-2 text-sm text-slate-500">
          👥 {klas.leerlingen.length} leerlingen
        </div>
        {!klas.leerlingen.every((l) => isIngekort(l.naam)) && (
          <>
            <div>
              <label className={labelClass} htmlFor="naamvolgorde">
                Namen staan als
              </label>
              <select
                id="naamvolgorde"
                className={inputClass}
                value={volgorde}
                onChange={(e) => onChange((k) => ({ ...k, naamVolgorde: e.target.value as NaamVolgorde }))}
              >
                <option value="achternaam">Achternaam Voornaam</option>
                <option value="voornaam">Voornaam Achternaam</option>
              </select>
            </div>
            <Button
              title="Bewaar enkel de voornaam en de initiaal van de achternaam (privacy)"
              onClick={() =>
                confirm('Alle namen inkorten tot voornaam en initiaal (bv. Peeters Anna → Anna P.)? De volledige namen worden niet meer bewaard.') &&
                onChange((k) => {
                  const kort = inkorten(
                    k.leerlingen.map((l) => l.naam),
                    volgorde,
                  );
                  return { ...k, naamVolgorde: 'voornaam', leerlingen: sorteerOpNaam(k.leerlingen.map((l, i) => ({ ...l, naam: kort[i] }))) };
                })
              }
            >
              🔒 Inkorten tot voornaam + initiaal
            </Button>
          </>
        )}
        <Button variant="danger" className="ml-auto" onClick={onDelete}>
          Klas verwijderen
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Leerlingen ({klas.leerlingen.length})</h2>
          {!toevoegen && (
            <Button variant="primary" onClick={() => setToevoegen(true)}>
              + Leerlingen toevoegen
            </Button>
          )}
          {klas.leerlingen.length > 0 && (
            <button
              type="button"
              className="ml-auto text-xs text-red-600 hover:underline"
              onClick={() => confirm('Alle leerlingen uit deze klas verwijderen?') && onChange((k) => ({ ...k, leerlingen: [] }))}
            >
              alles wissen
            </button>
          )}
        </div>

        {toevoegen && (
          <div className="mb-5 rounded-xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/40 p-4">
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
                  placeholder={'Peeters Anna\nClaes Bert\n…\n\nTitels en klasnummers mogen mee: je kiest straks wie je toevoegt.'}
                />
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <FileButton accept=".xlsx,.csv" onFile={importeer}>
                Importeren uit Excel…
              </FileButton>
              {klas.leerlingen.length > 0 && (
                <Button
                  onClick={() => {
                    setToevoegen(false);
                    setPlak('');
                    setBestand(null);
                  }}
                >
                  Annuleren
                </Button>
              )}
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
        )}

        {klas.leerlingen.length > 0 ? (
          <ol className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {klas.leerlingen.map((l, i) => (
              <li key={l.id} className="group flex items-center gap-2 rounded-lg px-1 hover:bg-slate-50">
                <span className="w-6 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                <input
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-slate-200 focus:border-[var(--accent)] focus:bg-surface focus:outline-none"
                  value={l.naam}
                  aria-label={`Naam van leerling ${i + 1}`}
                  onChange={(e) => onChange((k) => ({ ...k, leerlingen: k.leerlingen.map((x) => (x.id === l.id ? { ...x, naam: e.target.value } : x)) }))}
                />
                <button
                  type="button"
                  className="rounded px-2 py-1 text-slate-300 group-hover:text-slate-400 hover:bg-red-50 hover:!text-red-600"
                  aria-label={`${l.naam} verwijderen`}
                  onClick={() => onChange((k) => ({ ...k, leerlingen: k.leerlingen.filter((x) => x.id !== l.id) }))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        ) : (
          !toevoegen && <p className="text-slate-500">Nog geen leerlingen.</p>
        )}
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
  const ruw = useMemo(() => naamKandidaten(rijen, k, bestaand), [rijen, k, bestaand]);
  const breedte = Math.max(...rijen.map((r) => r.length));
  // Volgorde: zelf gekozen, anders herkend uit de kolomtitels of de lijst, anders achternaam eerst.
  const [eigenVolgorde, setEigenVolgorde] = useState<NaamVolgorde | null>(null);
  const volgorde =
    eigenVolgorde ??
    k.volgorde ??
    raadNaamVolgorde(
      ruw.filter((c) => c.aan).map((c) => c.naam),
      true,
    ) ??
    'achternaam';
  // Wie ingekort al in de klas staat ("Anna P."), wordt niet aangevinkt.
  const al = new Set(bestaand.map((n) => n.toLocaleLowerCase('nl')));
  const kandidaten = ruw.map((c) => (c.aan && al.has(inkorten([c.naam], volgorde)[0].toLocaleLowerCase('nl')) ? { ...c, aan: false, reden: 'staat al in de klas' } : c));
  const isAan = (c: NaamKandidaat, i: number) => gekozen[`${i}:${c.naam}`] ?? c.aan;
  const namen = kandidaten.filter(isAan).map((c) => c.naam);
  // Zo worden de aangevinkte leerlingen bewaard: voornaam en initiaal (privacy).
  const ingekortAan = inkorten(namen, volgorde, bestaand);
  const kort = new Map(kandidaten.flatMap((c, i) => (isAan(c, i) ? [i] : [])).map((i, j) => [i, ingekortAan[j]]));

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

      <div className="text-sm">
        <span className="mr-3 font-medium">De namen staan als:</span>
        {(['voornaam', 'achternaam'] as const).map((v) => (
          <label key={v} className="mr-4 inline-flex items-center gap-1.5">
            <input type="radio" name="volgorde" checked={volgorde === v} onChange={() => setEigenVolgorde(v)} />
            {v === 'voornaam' ? 'Voornaam Achternaam' : 'Achternaam Voornaam'}
          </label>
        ))}
        <p className="mt-1 text-xs text-slate-500">
          Achter elke naam zie je hoe de leerling bewaard wordt: enkel voornaam en initiaal van de achternaam (privacy). Op het scherm verschijnt de voornaam.
        </p>
      </div>

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
                {aan && <span className="text-xs text-slate-400">→ {kort.get(i)}</span>}
                {c.reden && <span className="ml-auto text-xs italic text-slate-400">{c.reden}</span>}
              </label>
            </li>
          );
        })}
        {kandidaten.length === 0 && <li className="px-2 py-1 text-sm text-slate-500">Geen namen gevonden. Kies een andere kolom.</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={namen.length === 0} onClick={() => onToevoegen(ingekortAan)}>
          ✓ {namen.length} {namen.length === 1 ? 'leerling' : 'leerlingen'} toevoegen
        </Button>
        <Button variant="ghost" onClick={onAnnuleren}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}
