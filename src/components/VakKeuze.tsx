import type { Vak } from '../lib/types';
import { VAK_ICONEN, VAK_LABELS } from '../pages/SetsPage';

/** Eén of meer vakken aanduiden (minstens één blijft aan). */
export function VakKeuze({ vakken, onChange, id }: { vakken: Vak[]; onChange: (v: Vak[]) => void; id?: string }) {
  return (
    <div id={id} className="flex flex-wrap gap-2" role="group" aria-label="Vakken">
      {(Object.keys(VAK_LABELS) as Vak[]).map((v) => {
        const aan = vakken.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={aan}
            onClick={() => {
              const nieuw = aan ? vakken.filter((x) => x !== v) : [...vakken, v];
              if (nieuw.length) onChange(nieuw);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${aan ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`}
          >
            {aan ? '✓ ' : ''}
            {VAK_ICONEN[v]} {VAK_LABELS[v]}
          </button>
        );
      })}
    </div>
  );
}
