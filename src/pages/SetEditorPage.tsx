import { useState } from 'react';
import { RichText } from '../components/RichText';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader } from '../components/ui';
import { newId, nu } from '../lib/ids';
import { QuestionImportError, readSpreadsheet, rowsToQuestions, UnsupportedFileError } from '../lib/importFile';
import { nieuweVraag, vraagProblemen } from '../lib/questions';
import { href } from '../lib/route';
import type { Store } from '../lib/store';
import type { Vak, Vraag, Vragenset } from '../lib/types';
import { VAK_LABELS } from './SetsPage';

const LETTERS = 'ABCDEFGH';

export function SetEditorPage({ id, store }: { id: string; store: Store }) {
  const set = store.sets.find((s) => s.id === id);
  const [melding, setMelding] = useState<string | null>(null);

  if (!set) {
    return (
      <div>
        <PageHeader title="Vragenset niet gevonden" back={{ href: href({ pagina: 'sets' }), label: 'Vragensets' }} />
        <Notice tone="warn">Deze vragenset bestaat niet (meer).</Notice>
      </div>
    );
  }

  const update = (f: (s: Vragenset) => Vragenset) =>
    store.setSets((all) => all.map((s) => (s.id === id ? { ...f(s), voorbeeld: undefined, gewijzigd: nu() } : s)));
  const updateVraag = (vraagId: string, f: (v: Vraag) => Vraag) => update((s) => ({ ...s, vragen: s.vragen.map((v) => (v.id === vraagId ? f(v) : v)) }));
  const verplaats = (index: number, richting: -1 | 1) =>
    update((s) => {
      const vragen = [...s.vragen];
      const j = index + richting;
      if (j < 0 || j >= vragen.length) return s;
      [vragen[index], vragen[j]] = [vragen[j], vragen[index]];
      return { ...s, vragen };
    });

  async function voegToeUitExcel(file: File) {
    try {
      const vragen = rowsToQuestions(await readSpreadsheet(file));
      update((s) => ({ ...s, vragen: [...s.vragen.filter((v) => v.tekst.trim()), ...vragen] }));
      setMelding(`${vragen.length} vragen toegevoegd.`);
    } catch (e) {
      const bekend = e instanceof QuestionImportError || e instanceof UnsupportedFileError;
      setMelding(bekend ? e.message : 'Het bestand kon niet gelezen worden.');
    }
  }

  const categorieen = [...new Set(set.vragen.map((v) => v.categorie.trim()).filter(Boolean))];

  return (
    <div>
      <PageHeader title={set.titel || 'Vragenset'} back={{ href: href({ pagina: 'sets' }), label: 'Vragensets' }}>
        <a href={href({ pagina: 'spelen', setId: set.id })} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
          Spelen
        </a>
      </PageHeader>

      <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className={labelClass}>Titel</label>
          <input className={inputClass} value={set.titel} onChange={(e) => update((s) => ({ ...s, titel: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass}>Vak</label>
          <select className={inputClass} value={set.vak} onChange={(e) => update((s) => ({ ...s, vak: e.target.value as Vak }))}>
            {Object.entries(VAK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Leerjaar / klas</label>
          <input className={inputClass} value={set.leerjaar} placeholder="bv. 3e jaar (5 u)" onChange={(e) => update((s) => ({ ...s, leerjaar: e.target.value }))} />
        </div>
        <div className="md:col-span-3">
          <label className={labelClass}>Beschrijving (optioneel)</label>
          <input className={inputClass} value={set.beschrijving} onChange={(e) => update((s) => ({ ...s, beschrijving: e.target.value }))} />
        </div>
      </div>

      <details className="mb-6 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium">Hoe typ ik formules en code?</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Formule in de tekst: tussen dollartekens, bv. <code>{'$x^2 + 3x$'}</code>, <code>{'$\\frac{1}{2}$'}</code>, <code>{'$\\sqrt{x}$'}</code>,{' '}
            <code>{'$\\dfrac{a}{b}$'}</code> (grote breuk), <code>{'$1{,}5$'}</code> (decimale komma).
          </li>
          <li>
            Formule op een aparte lijn: tussen dubbele dollartekens, bv. <code>{'$$\\int_0^1 x\\,dx$$'}</code>.
          </li>
          <li>
            Python-code: zet <code>```</code> op een eigen lijn voor en na de code. Kort stukje code in een zin: <code>`print(x)`</code>.
          </li>
          <li>
            Een gewoon dollarteken: <code>{'\\$'}</code>.
          </li>
        </ul>
      </details>

      {melding && (
        <div className="mb-4">
          <Notice>{melding}</Notice>
        </div>
      )}

      <datalist id="categorieen">
        {categorieen.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="space-y-4">
        {set.vragen.map((v, i) => (
          <VraagEditor
            key={v.id}
            nr={i + 1}
            vraag={v}
            onChange={(f) => updateVraag(v.id, f)}
            onUp={i > 0 ? () => verplaats(i, -1) : undefined}
            onDown={i < set.vragen.length - 1 ? () => verplaats(i, 1) : undefined}
            onDuplicate={() =>
              update((s) => ({ ...s, vragen: [...s.vragen.slice(0, i + 1), { ...v, id: newId(), opties: [...v.opties] }, ...s.vragen.slice(i + 1)] }))
            }
            onDelete={() => update((s) => ({ ...s, vragen: s.vragen.filter((x) => x.id !== v.id) }))}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => update((s) => ({ ...s, vragen: [...s.vragen, nieuweVraag(s.vragen.at(-1))] }))}>
          + Vraag toevoegen
        </Button>
        <FileButton accept=".xlsx,.csv" onFile={voegToeUitExcel}>
          Vragen toevoegen uit Excel…
        </FileButton>
      </div>
      <p className="mt-3 text-sm text-slate-500">Wijzigingen worden automatisch bewaard.</p>
    </div>
  );
}

function VraagEditor({
  nr,
  vraag: v,
  onChange,
  onUp,
  onDown,
  onDuplicate,
  onDelete,
}: {
  nr: number;
  vraag: Vraag;
  onChange: (f: (v: Vraag) => Vraag) => void;
  onUp?: () => void;
  onDown?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const problemen = vraagProblemen(v);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{nr}</span>
        <div className="w-56">
          <label className={labelClass}>Categorie</label>
          <input className={inputClass} list="categorieen" value={v.categorie} onChange={(e) => onChange((x) => ({ ...x, categorie: e.target.value }))} />
        </div>
        <div className="w-28">
          <label className={labelClass}>Punten</label>
          <input
            type="number"
            min={0}
            step={50}
            className={inputClass}
            value={v.punten}
            onChange={(e) => onChange((x) => ({ ...x, punten: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          {(['open', 'meerkeuze'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange((x) => ({ ...x, type: t }))}
              className={`px-3 py-2 ${v.type === t ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-slate-50'}`}
            >
              {t === 'open' ? 'Open vraag' : 'Meerkeuze'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={onUp} disabled={!onUp} title="Omhoog">
            ↑
          </Button>
          <Button variant="ghost" onClick={onDown} disabled={!onDown} title="Omlaag">
            ↓
          </Button>
          <Button variant="ghost" onClick={onDuplicate} title="Dupliceren">
            ⧉
          </Button>
          <Button variant="ghost" onClick={onDelete} title="Verwijderen" className="text-red-600">
            🗑
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Vraag</label>
            <textarea
              className={`${inputClass} min-h-24 font-mono`}
              rows={Math.min(12, Math.max(3, v.tekst.split('\n').length + 1))}
              value={v.tekst}
              onChange={(e) => onChange((x) => ({ ...x, tekst: e.target.value }))}
            />
          </div>
          {v.type === 'open' ? (
            <div>
              <label className={labelClass}>Antwoord</label>
              <input className={`${inputClass} font-mono`} value={v.antwoord} onChange={(e) => onChange((x) => ({ ...x, antwoord: e.target.value }))} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Opties (duid het juiste antwoord aan)</label>
              <div className="space-y-2">
                {v.opties.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`juist-${v.id}`}
                      checked={v.juisteOptie === oi}
                      onChange={() => onChange((x) => ({ ...x, juisteOptie: oi }))}
                      className="h-4 w-4 accent-emerald-600"
                      title="Juiste antwoord"
                    />
                    <span className="w-5 text-sm font-bold text-slate-500">{LETTERS[oi]}</span>
                    <input
                      className={`${inputClass} font-mono ${v.juisteOptie === oi ? 'border-emerald-400 bg-emerald-50' : ''}`}
                      value={o}
                      onChange={(e) => onChange((x) => ({ ...x, opties: x.opties.map((y, yi) => (yi === oi ? e.target.value : y)) }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                {v.opties.length < LETTERS.length && (
                  <Button variant="ghost" onClick={() => onChange((x) => ({ ...x, opties: [...x.opties, ''] }))}>
                    + optie
                  </Button>
                )}
                {v.opties.length > 2 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      onChange((x) => ({ ...x, opties: x.opties.slice(0, -1), juisteOptie: Math.min(x.juisteOptie, x.opties.length - 2) }))
                    }
                  >
                    − optie
                  </Button>
                )}
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Uitleg bij het antwoord (optioneel)</label>
            <input className={`${inputClass} font-mono`} value={v.uitleg} onChange={(e) => onChange((x) => ({ ...x, uitleg: e.target.value }))} />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Voorbeeld</div>
          {v.tekst.trim() ? <RichText text={v.tekst} className="text-lg" /> : <p className="text-slate-400 italic">Typ een vraag…</p>}
          {v.type === 'meerkeuze' ? (
            <ul className="mt-3 space-y-1">
              {v.opties.map(
                (o, oi) =>
                  o.trim() && (
                    <li key={oi} className={`flex gap-2 rounded-lg px-3 py-1.5 ${v.juisteOptie === oi ? 'bg-emerald-100' : 'bg-white'}`}>
                      <span className="font-bold">{LETTERS[oi]}</span>
                      <RichText text={o} />
                    </li>
                  ),
              )}
            </ul>
          ) : (
            v.antwoord.trim() && (
              <div className="mt-3 rounded-lg bg-emerald-100 px-3 py-2">
                <RichText text={v.antwoord} />
              </div>
            )
          )}
          {v.uitleg.trim() && <RichText text={v.uitleg} className="mt-2 text-sm text-slate-600" />}
          {problemen.length > 0 && <p className="mt-3 text-sm text-amber-700">⚠ {problemen.join(' ')}</p>}
        </div>
      </div>
    </div>
  );
}
