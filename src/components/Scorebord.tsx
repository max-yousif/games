import type { Sessie } from '../lib/types';

export function Scorebord({ sessie, scores, actief, eenheid = 'punten' }: { sessie: Sessie; scores: number[]; actief: number | null; eenheid?: string }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${sessie.teams.length}, minmax(0, 1fr))` }}>
      {sessie.teams.map((t, i) => (
        <div
          key={i}
          className={`rounded-2xl border-4 bg-surface px-4 py-3 transition ${i === actief ? 'scale-[1.02] shadow-lg' : 'opacity-80'}`}
          style={{ borderColor: i === actief ? t.kleur : 'transparent' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xl font-bold" style={{ color: t.kleur }}>
              {i === actief && '▶ '}
              {t.naam}
            </span>
            <span className="font-mono text-3xl font-bold">
              {scores[i]}
              <span className="ml-1 text-sm font-normal text-slate-500">{eenheid}</span>
            </span>
          </div>
          {t.leerlingen.length > 0 && <div className="mt-1 truncate text-sm text-slate-500">{t.leerlingen.map((l) => l.naam.split(' ')[0]).join(', ')}</div>}
        </div>
      ))}
    </div>
  );
}
