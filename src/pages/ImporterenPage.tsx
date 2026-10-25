import { useMemo, useState, type DragEvent } from 'react';
import { RichText } from '../components/RichText';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader, Section } from '../components/ui';
import { nu } from '../lib/ids';
import {
  downloadQuestionTemplate,
  herkenKolommen,
  KOLOM_NAMEN,
  parseCsv,
  readSpreadsheet,
  rijenNaarVragen,
  UnsupportedFileError,
  type ImportItem,
  type Kolom,
} from '../lib/importFile';
import { juistAntwoord, nieuweSet, vraagProblemen } from '../lib/questions';
import { ga, href } from '../lib/route';
import type { Store } from '../lib/store';
import { aiOpdracht, lijktTabel, TEKST_VOORBEELD, tekstNaarVragen } from '../lib/tekstImport';
import type { Vak } from '../lib/types';
import { tekstMetGaten, VRAAG_TYPES } from '../lib/vraagtypes';
import { VAK_LABELS } from './SetsPage';

type Bron = { soort: 'tekst'; tekst: string } | { soort: 'bestand'; naam: string; rijen: string[][] };

const PLACEHOLDER = `Plak hier je vragen, bv. cellen gekopieerd uit Excel of Google Sheets, of tekst uit Word.

Of typ ze zo (lege lijn tussen twee vragen):

Bereken: $2^{-3}$
* $\\frac{1}{8}$
- $-8$
- $8$

Ontbind: $x^2-49$
= $(x-7)(x+7)$`;

export function ImporterenPage({ store, setId }: { store: Store; setId?: string }) {
  const [bron, setBron] = useState<Bron>({ soort: 'tekst', tekst: '' });
  const [fout, setFout] = useState<string | null>(null);
  const [sleep, setSleep] = useState(false);
  const [kolomKeuze, setKolomKeuze] = useState<{ kolommen: (Kolom | null)[]; metTitels: boolean } | null>(null);
  const [uit, setUit] = useState<Set<number>>(new Set());
  const bestaand = store.sets.find((s) => s.id === setId);
  const [doel, setDoel] = useState<string>(bestaand?.id ?? 'nieuw');
  const [titel, setTitel] = useState('');
  const [vak, setVak] = useState<Vak>('wiskunde');
  const [leerjaar, setLeerjaar] = useState('');
  const [onderwerp, setOnderwerp] = useState('');
  const [gekopieerd, setGekopieerd] = useState(false);

  // Tabel (uit een bestand of geplakt uit Excel) of tekst in het snelformaat?
  const rijen = useMemo(() => (bron.soort === 'bestand' ? bron.rijen : lijktTabel(bron.tekst) ? parseCsv(bron.tekst) : null), [bron]);
  const herkend = useMemo(() => (rijen ? herkenKolommen(rijen) : null), [rijen]);
  const kolommen = kolomKeuze ?? herkend;
  const items: ImportItem[] = useMemo(() => {
    if (rijen && kolommen) return rijenNaarVragen(rijen, kolommen.kolommen, kolommen.metTitels);
    return bron.soort === 'tekst' ? tekstNaarVragen(bron.tekst) : [];
  }, [rijen, kolommen, bron]);

  const vragen = items.flatMap((it, i) => (it.vraag && !uit.has(i) ? [it.vraag] : []));
  const metProbleem = items.filter((it, i) => it.vraag && !uit.has(i) && vraagProblemen(it.vraag).length > 0).length;
  const nietGelezen = items.filter((it) => it.fout).length;

  function nieuweBron(b: Bron) {
    setBron(b);
    setKolomKeuze(null);
    setUit(new Set());
    setFout(null);
  }

  async function leesBestand(file: File) {
    try {
      const r = await readSpreadsheet(file);
      if (r.length === 0) throw new Error('leeg');
      nieuweBron({ soort: 'bestand', naam: file.name, rijen: r });
      if (!titel) setTitel(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setFout(e instanceof UnsupportedFileError ? e.message : 'Het bestand kon niet gelezen worden of is leeg.');
    }
  }

  function opDrop(e: DragEvent) {
    e.preventDefault();
    setSleep(false);
    const f = e.dataTransfer.files[0];
    if (f) void leesBestand(f);
  }

  function zetKolom(i: number, k: Kolom | null) {
    const huidig = kolommen!;
    setKolomKeuze({ ...huidig, kolommen: huidig.kolommen.map((x, j) => (j === i ? k : x)) });
  }

  function importeer() {
    if (vragen.length === 0) return;
    if (doel === 'nieuw') {
      const s = { ...nieuweSet(), titel: titel.trim() || 'Geïmporteerde vragen', vak, leerjaar: leerjaar.trim(), vragen };
      store.setSets((all) => [...all, s]);
      ga({ pagina: 'set', id: s.id });
    } else {
      store.setSets((all) =>
        all.map((s) => (s.id === doel ? { ...s, vragen: [...s.vragen.filter((v) => v.tekst.trim()), ...vragen], voorbeeld: undefined, gewijzigd: nu() } : s)),
      );
      ga({ pagina: 'set', id: doel });
    }
  }

  async function kopieerOpdracht() {
    try {
      await navigator.clipboard.writeText(aiOpdracht(onderwerp.trim()));
      setGekopieerd(true);
      window.setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      setFout('Kopiëren lukte niet. Selecteer de opdracht en kopieer ze zelf.');
    }
  }

  const terug = bestaand ? { href: href({ pagina: 'set', id: bestaand.id }), label: bestaand.titel } : { href: href({ pagina: 'sets' }), label: 'Vragensets' };

  return (
    <div className="space-y-6">
      <PageHeader title="Vragen importeren" back={terug} />

      <Section step={1} title="Plak, typ of sleep je vragen">
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <div>
            {bron.soort === 'bestand' ? (
              <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-5 text-sm">
                <span className="text-2xl">📄</span>
                <span>
                  <strong>{bron.naam}</strong> · {bron.rijen.length} rijen
                </span>
                <Button className="ml-auto" onClick={() => nieuweBron({ soort: 'tekst', tekst: '' })}>
                  ✕ Ander bestand of plakken
                </Button>
              </div>
            ) : (
              <textarea
                aria-label="Vragen"
                className={`${inputClass} min-h-72 font-mono text-[13px] leading-relaxed ${sleep ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]' : ''}`}
                placeholder={PLACEHOLDER}
                value={bron.tekst}
                spellCheck={false}
                onChange={(e) => nieuweBron({ soort: 'tekst', tekst: e.target.value })}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSleep(true);
                }}
                onDragLeave={() => setSleep(false)}
                onDrop={opDrop}
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <FileButton accept=".xlsx,.csv,.txt" onFile={leesBestand}>
                📄 Excel- of CSV-bestand kiezen…
              </FileButton>
              <Button onClick={() => nieuweBron({ soort: 'tekst', tekst: TEKST_VOORBEELD })}>Voorbeeld invullen</Button>
              <Button variant="ghost" onClick={() => downloadQuestionTemplate()}>
                Excel-sjabloon downloaden
              </Button>
            </div>
            {fout && (
              <div className="mt-3">
                <Notice tone="warn">{fout}</Notice>
              </div>
            )}
          </div>

          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold">Snelformaat</h3>
              <ul className="space-y-1 text-slate-600">
                <li>
                  Eerste lijn: <strong>de vraag</strong> (eventueel <code>(200)</code> punten achteraan)
                </li>
                <li>
                  <code className="font-bold">* </code> juist antwoord, <code className="font-bold">- </code> fout antwoord → meerkeuze
                </li>
                <li>
                  <code className="font-bold">= </code> antwoord → open vraag (meerdere <code>=</code> lijnen: ook juist)
                </li>
                <li>
                  <code>= waar</code> / <code>= onwaar</code> → waar of onwaar
                </li>
                <li>
                  <code>= 6,67 ± 0,01</code> → getal met foutmarge
                </li>
                <li>
                  <code>[[gat]]</code> in de vraag → invullen
                </li>
                <li>
                  <code>= links -&gt; rechts</code> op elke lijn → koppelen
                </li>
                <li>
                  <code className="font-bold">&gt; </code> uitleg, <code className="font-bold"># </code> categorie voor de vragen eronder
                </li>
                <li>Lege lijn tussen twee vragen. Formules tussen $...$, code tussen `...`.</li>
              </ul>
              <p className="mt-2 text-slate-500">
                Uit Excel of Google Sheets: selecteer de cellen, kopieer en plak. Kolommen kies je in stap 2.
              </p>
            </div>
            <details className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold">🤖 Vragen laten maken door AI (ChatGPT, Claude …)</summary>
              <p className="mt-2 text-slate-600">Kopieer deze opdracht naar een AI-chatbot, controleer het resultaat en plak het hier.</p>
              <label className={`${labelClass} mt-3`} htmlFor="ai-onderwerp">
                Onderwerp en leerjaar
              </label>
              <input
                id="ai-onderwerp"
                className={inputClass}
                placeholder="bv. ontbinden in factoren, 3e jaar (5 u wiskunde)"
                value={onderwerp}
                onChange={(e) => setOnderwerp(e.target.value)}
              />
              <Button className="mt-3" onClick={() => void kopieerOpdracht()}>
                {gekopieerd ? '✅ Gekopieerd' : '📋 Opdracht kopiëren'}
              </Button>
            </details>
          </div>
        </div>
      </Section>

      {rijen && kolommen && (
        <Section step={2} title="Welke kolom is wat?">
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={kolommen.metTitels} onChange={(e) => setKolomKeuze({ ...kolommen, metTitels: e.target.checked })} />
            De eerste rij bevat kolomtitels (wordt niet geïmporteerd)
          </label>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {kolommen.kolommen.map((k, i) => (
                    <th key={i} className="min-w-36 p-2 font-normal">
                      <select
                        aria-label={`Kolom ${i + 1}`}
                        className={`${inputClass} ${k ? 'font-semibold' : 'text-slate-400'}`}
                        value={k ?? ''}
                        onChange={(e) => zetKolom(i, (e.target.value || null) as Kolom | null)}
                      >
                        <option value="">— niet gebruiken —</option>
                        {(Object.entries(KOLOM_NAMEN) as [Kolom, string][]).map(([waarde, naam]) => (
                          <option key={waarde} value={waarde}>
                            {naam}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rijen.slice(0, 4).map((r, ri) => (
                  <tr key={ri} className={`border-t border-slate-100 ${ri === 0 && kolommen.metTitels ? 'text-slate-400 line-through' : ''}`}>
                    {kolommen.kolommen.map((_, i) => (
                      <td key={i} className="max-w-56 truncate p-2" title={r[i]}>
                        {r[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rijen.length > 4 && <p className="mt-2 text-sm text-slate-500">… en nog {rijen.length - 4} rijen.</p>}
          {!kolommen.kolommen.includes('vraag') && (
            <div className="mt-3">
              <Notice tone="warn">Kies welke kolom de vraag bevat.</Notice>
            </div>
          )}
        </Section>
      )}

      {items.length > 0 && (
        <Section
          step={rijen ? 3 : 2}
          title="Controleer de vragen"
          aside={
            <span>
              <strong className="text-slate-800">{vragen.length}</strong> geselecteerd
              {metProbleem > 0 && <span className="text-amber-700"> · {metProbleem} onvolledig</span>}
              {nietGelezen > 0 && <span className="text-red-700"> · {nietGelezen} niet gelezen</span>}
            </span>
          }
        >
          <ol className="space-y-2">
            {items.map((it, i) => {
              if (it.fout)
                return (
                  <li key={i} className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    ⚠️ {it.fout}
                  </li>
                );
              const v = it.vraag!;
              const t = VRAAG_TYPES.find((x) => x.type === v.type)!;
              const problemen = vraagProblemen(v);
              const aan = !uit.has(i);
              return (
                <li key={i} className={`flex gap-3 rounded-xl border px-4 py-3 ${aan ? 'border-slate-200 bg-surface' : 'border-dashed border-slate-200 opacity-50'}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={aan}
                    aria-label={`Vraag ${i + 1} importeren`}
                    onChange={() =>
                      setUit((u) => {
                        const n = new Set(u);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent-tekst)]">
                        {t.icoon} {t.naam}
                      </span>
                      {v.categorie && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{v.categorie}</span>}
                      <span className="text-slate-400">{v.punten} punten</span>
                    </div>
                    <RichText text={v.type === 'invullen' ? tekstMetGaten(v.tekst) : v.tekst} className="font-medium" />
                    {v.type === 'meerkeuze' ? (
                      <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                        {v.opties.map((o, oi) => (
                          <li key={oi} className={`rounded-lg px-2 py-0.5 ${oi === v.juisteOptie ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`}>
                            <RichText text={o} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      juistAntwoord(v) && (
                        <div className="mt-1 flex gap-2 text-sm text-emerald-700">
                          <span>✓</span>
                          <RichText text={juistAntwoord(v)} />
                        </div>
                      )
                    )}
                    {problemen.length > 0 && <p className="mt-1 text-sm text-amber-700">⚠️ {problemen.join(' ')} Je kan dit na het importeren aanvullen.</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {vragen.length > 0 && (
        <Section step={rijen ? 4 : 3} title="Waar komen de vragen?">
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="doel">
                Vragenset
              </label>
              <select id="doel" className={inputClass} value={doel} onChange={(e) => setDoel(e.target.value)}>
                <option value="nieuw">➕ Nieuwe vragenset</option>
                {store.sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    Toevoegen aan: {s.titel}
                  </option>
                ))}
              </select>
            </div>
            {doel === 'nieuw' && (
              <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                <div>
                  <label className={labelClass} htmlFor="nieuw-titel">
                    Titel
                  </label>
                  <input id="nieuw-titel" className={inputClass} placeholder="bv. Machten herhaling" value={titel} onChange={(e) => setTitel(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="nieuw-vak">
                    Vak
                  </label>
                  <select id="nieuw-vak" className={inputClass} value={vak} onChange={(e) => setVak(e.target.value as Vak)}>
                    {Object.entries(VAK_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="nieuw-leerjaar">
                    Leerjaar / klas
                  </label>
                  <input id="nieuw-leerjaar" className={inputClass} placeholder="bv. 3e jaar (5 u)" value={leerjaar} onChange={(e) => setLeerjaar(e.target.value)} />
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="primary" className="px-8 py-3 text-base" onClick={importeer}>
                ✓ {vragen.length} {vragen.length === 1 ? 'vraag' : 'vragen'} importeren
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
