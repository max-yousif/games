import { useState } from 'react';
import { AntwoordVelden } from '../components/AntwoordVelden';
import { RichText } from '../components/RichText';
import { Button, FileButton, inputClass, labelClass, Notice, PageHeader } from '../components/ui';
import { VraagWeergave } from '../components/VraagWeergave';
import { CoverFout, maakCover } from '../lib/cover';
import { nu } from '../lib/ids';
import { juistAntwoord, kopieVraag, nieuweVraag, speelbareVragen, vakkenVan, vraagProblemen } from '../lib/questions';
import { CluedoThemaEditor } from '../components/CluedoThemaEditor';
import { RaadselEditor } from '../components/RaadselEditor';
import { VakKeuze } from '../components/VakKeuze';
import { JaarKeuze } from '../components/JaarKeuze';
import { jaarTekst, jarenVanSet } from './SetsPage';
import { nieuwRaadsel } from '../live/whodunit';
import { href } from '../lib/route';
import type { Store } from '../lib/store';
import type { Vraag, VraagType, Vragenset } from '../lib/types';
import { isKeuzeVraag, VRAAG_TYPES } from '../lib/vraagtypes';

export function SetEditorPage({ id, store }: { id: string; store: Store }) {
  const set = store.sets.find((s) => s.id === id);

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

  const categorieen = [...new Set(set.vragen.map((v) => v.categorie.trim()).filter(Boolean))];

  return (
    <div>
      <PageHeader title={set.titel || 'Vragenset'} back={{ href: href({ pagina: 'sets' }), label: 'Vragensets' }}>
        <a href={href({ pagina: 'spelen', setId: set.id })} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
          Spelen
        </a>
      </PageHeader>

      <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className={labelClass}>Titel</label>
          <input className={inputClass} value={set.titel} onChange={(e) => update((s) => ({ ...s, titel: e.target.value }))} />
        </div>
        <div>
          <span className={labelClass}>Vakken (één of meer)</span>
          <VakKeuze vakken={vakkenVan(set)} onChange={(vakken) => update((s) => ({ ...s, vak: vakken[0], vakken }))} />
        </div>
        <div>
          <span className={labelClass}>Leerjaar (één of meer)</span>
          <JaarKeuze jaren={jarenVanSet(set)} onChange={(jaren) => update((s) => ({ ...s, jaren, leerjaar: jaarTekst(jaren) }))} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Beschrijving (optioneel)</label>
          <input className={inputClass} value={set.beschrijving} onChange={(e) => update((s) => ({ ...s, beschrijving: e.target.value }))} />
        </div>
        <CoverKiezer cover={set.cover} onChange={(cover) => update((s) => ({ ...s, cover }))} />
      </div>

      <details className="mb-6 rounded-xl border border-slate-200 bg-surface px-5 py-3 text-sm text-slate-700">
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
              update((s) => ({ ...s, vragen: [...s.vragen.slice(0, i + 1), kopieVraag(v), ...s.vragen.slice(i + 1)] }))
            }
            onDelete={() => update((s) => ({ ...s, vragen: s.vragen.filter((x) => x.id !== v.id) }))}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => update((s) => ({ ...s, vragen: [...s.vragen, nieuweVraag(s.vragen.at(-1))] }))}>
          + Vraag toevoegen
        </Button>
        <a href={href({ pagina: 'importeren', setId: set.id })} className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium hover:bg-slate-50">
          📥 Vragen importeren (plakken, Excel, AI)
        </a>
      </div>
      <p className="mt-3 text-sm text-slate-500">Wijzigingen worden automatisch bewaard.</p>

      {/* Het raadsel verschijnt enkel als de set er een heeft (toevoegen via Spelen → Whodunit). */}
      {set.raadsel && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">🕵️ Whodunit-raadsel</h2>
          <div className="mt-4">
            <RaadselEditor
              raadsel={set.raadsel}
              aantalOefeningen={speelbareVragen(set).length}
              onChange={(f) => update((s) => ({ ...s, raadsel: f(s.raadsel ?? nieuwRaadsel()) }))}
              onVerwijder={() => update((s) => ({ ...s, raadsel: undefined }))}
            />
          </div>
        </section>
      )}

      {/* Het Cluedo-thema verschijnt enkel als de set een eigen thema heeft (bewaren via Spelen → Cluedo). */}
      {set.cluedo && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">🔎 Cluedo-thema</h2>
            <button
              type="button"
              className="ml-auto text-sm text-slate-500 underline"
              onClick={() => confirm('Het eigen Cluedo-thema verwijderen? Dan wordt het standaardthema gebruikt.') && update((s) => ({ ...s, cluedo: undefined }))}
            >
              Verwijderen (standaardthema gebruiken)
            </button>
          </div>
          <div className="mt-4">
            <CluedoThemaEditor thema={set.cluedo} onChange={(cluedo) => update((s) => ({ ...s, cluedo }))} />
          </div>
        </section>
      )}
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
    <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm">
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
        <div className="w-52">
          <label className={labelClass}>Type</label>
          <select
            className={inputClass}
            value={v.type}
            onChange={(e) => {
              const type = e.target.value as VraagType;
              onChange((x) => ({
                ...x,
                type,
                juisteOptie: type === 'waaronwaar' ? Math.min(x.juisteOptie, 1) : x.juisteOptie,
                opties: type === 'meerkeuze' && x.opties.length < 2 ? ['', '', '', ''] : x.opties,
                paren: x.paren ?? [['', ''], ['', ''], ['', '']],
              }));
            }}
          >
            {VRAAG_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.icoon} {t.naam}
              </option>
            ))}
          </select>
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
            <label className={labelClass}>{v.type === 'waaronwaar' ? 'Stelling' : v.type === 'invullen' ? 'Tekst met [[gaten]]' : 'Vraag'}</label>
            <textarea
              className={`${inputClass} min-h-24 font-mono`}
              rows={Math.min(12, Math.max(3, v.tekst.split('\n').length + 1))}
              value={v.tekst}
              onChange={(e) => onChange((x) => ({ ...x, tekst: e.target.value }))}
            />
          </div>
          <AntwoordVelden vraag={v} onChange={onChange} />
          <div>
            <label className={labelClass}>Uitleg bij het antwoord (optioneel)</label>
            <input className={`${inputClass} font-mono`} value={v.uitleg} onChange={(e) => onChange((x) => ({ ...x, uitleg: e.target.value }))} />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Voorbeeld</div>
          {v.tekst.trim() ? <VraagWeergave vraag={v} getoond /> : <p className="text-slate-400 italic">Typ een vraag…</p>}
          {!isKeuzeVraag(v) && juistAntwoord(v).trim() && (
            <div className="mt-3 rounded-lg bg-emerald-100 px-3 py-2">
              <RichText text={juistAntwoord(v)} />
            </div>
          )}
          {v.uitleg.trim() && <RichText text={v.uitleg} className="mt-2 text-sm text-slate-600" />}
          {problemen.length > 0 && <p className="mt-3 text-sm text-amber-700">⚠ {problemen.join(' ')}</p>}
        </div>
      </div>
    </div>
  );
}

/** Coverafbeelding van de vragenset: kiezen, slepen of verwijderen. */
function CoverKiezer({ cover, onChange }: { cover?: string; onChange: (cover: string | undefined) => void }) {
  const [fout, setFout] = useState<string | null>(null);
  async function kies(f: File) {
    try {
      setFout(null);
      onChange(await maakCover(f));
    } catch (e) {
      setFout(e instanceof CoverFout ? e.message : 'De afbeelding kon niet verwerkt worden.');
    }
  }
  return (
    <div>
      <span className={labelClass}>Coverafbeelding (optioneel)</span>
      <div
        className="flex items-center gap-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void kies(f);
        }}
      >
        {cover ? (
          <img src={cover} alt="Cover" className="aspect-video w-28 rounded-lg object-cover shadow-sm" />
        ) : (
          <div className="flex aspect-video w-28 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-2xl text-slate-400">🖼️</div>
        )}
        <div className="flex flex-col items-start gap-1">
          <FileButton accept="image/*" onFile={(f) => void kies(f)}>
            {cover ? 'Andere afbeelding…' : 'Afbeelding kiezen…'}
          </FileButton>
          {cover && (
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => onChange(undefined)}>
              verwijderen
            </button>
          )}
        </div>
      </div>
      {fout && <p className="mt-1 text-sm text-red-600">{fout}</p>}
    </div>
  );
}
