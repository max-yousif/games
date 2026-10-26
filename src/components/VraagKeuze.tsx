import type { Vraag } from '../lib/types';
import { VRAAG_TYPES } from '../lib/vraagtypes';
import { RichText } from './RichText';

/**
 * Kies welke vragen van de set in dit spel komen: per soort (bv. geen open vragen), per categorie
 * of per vraag. De vragenset zelf verandert niet.
 */
export function VraagKeuze({ vragen, uit, onChange }: { vragen: Vraag[]; uit: Set<string>; onChange: (uit: Set<string>) => void }) {
  const aan = vragen.filter((v) => !uit.has(v.id)).length;
  const soorten = VRAAG_TYPES.filter((t) => vragen.some((v) => v.type === t.type));
  const categorieen = [...new Set(vragen.map((v) => v.categorie.trim()).filter(Boolean))];

  // Een groep aan- of uitzetten: staat ze (deels) aan, dan gaat ze uit; anders aan.
  function wissel(groep: Vraag[]) {
    const iedereenUit = groep.every((v) => uit.has(v.id));
    const n = new Set(uit);
    for (const v of groep) {
      if (iedereenUit) n.delete(v.id);
      else n.add(v.id);
    }
    onChange(n);
  }

  const chip = (label: string, groep: Vraag[]) => {
    const aantalAan = groep.filter((v) => !uit.has(v.id)).length;
    return (
      <button
        key={label}
        type="button"
        onClick={() => wissel(groep)}
        aria-pressed={aantalAan > 0}
        className={`rounded-full border px-3 py-1 text-sm ${
          aantalAan === groep.length
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-tekst)]'
            : aantalAan === 0
              ? 'border-slate-300 text-slate-400 line-through'
              : 'border-[var(--accent)] border-dashed text-[var(--accent-tekst)]'
        }`}
      >
        {label} ({aantalAan}/{groep.length})
      </button>
    );
  };

  return (
    <details className="mt-3 rounded-xl border border-slate-200 px-4 py-3 text-sm" open={uit.size > 0 || undefined}>
      <summary className="cursor-pointer font-medium">
        Vragen kiezen voor dit spel{' '}
        <span className={uit.size ? 'font-semibold text-[var(--accent-tekst)]' : 'text-slate-500'}>
          ({aan} van {vragen.length})
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        {soorten.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-slate-500">Soort</span>
            {soorten.map((t) =>
              chip(
                `${t.icoon} ${t.naam}`,
                vragen.filter((v) => v.type === t.type),
              ),
            )}
          </div>
        )}
        {categorieen.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-slate-500">Categorie</span>
            {categorieen.map((c) =>
              chip(
                c,
                vragen.filter((v) => v.categorie.trim() === c),
              ),
            )}
          </div>
        )}
        <ul className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {vragen.map((v) => (
            <li key={v.id}>
              <label className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 ${uit.has(v.id) ? 'text-slate-400' : ''}`}>
                <input
                  type="checkbox"
                  checked={!uit.has(v.id)}
                  onChange={() => {
                    const n = new Set(uit);
                    if (n.has(v.id)) n.delete(v.id);
                    else n.add(v.id);
                    onChange(n);
                  }}
                />
                <span className="shrink-0">{VRAAG_TYPES.find((t) => t.type === v.type)?.icoon}</span>
                <RichText text={v.tekst} className="line-clamp-1 min-w-0 flex-1" />
                {v.categorie && <span className="shrink-0 text-xs text-slate-400">{v.categorie}</span>}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button type="button" className="text-[var(--accent-tekst)] hover:underline" onClick={() => onChange(new Set())}>
            alles aan
          </button>
        </div>
      </div>
    </details>
  );
}
