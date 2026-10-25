import { useState } from 'react';
import { BeurtScherm } from '../components/BeurtScherm';
import { Scorebord } from '../components/Scorebord';
import { bordIndeling } from '../lib/questions';
import { beeindig, gespeeldeVragen, teamAanDeBeurt, teamScores, voegBeurtToe } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';

export function QuizBord({ sessie, onUpdate }: { sessie: Sessie; onUpdate: (s: Sessie) => void }) {
  const [open, setOpen] = useState<Vraag | null>(null);
  const kolommen = bordIndeling(sessie.vragen);
  const gespeeld = gespeeldeVragen(sessie);
  const juistBeantwoord = new Map(sessie.beurten.map((b) => [b.vraagId, b]));
  const team = teamAanDeBeurt(sessie);
  const rijen = Math.max(...kolommen.map((k) => k.vragen.length));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${kolommen.length}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${rijen}, minmax(0, 1fr))` }}>
        {kolommen.map((k, ki) => (
          <div key={k.categorie} className="flex items-center justify-center rounded-xl bg-slate-800 px-2 py-3 text-center text-lg font-bold text-white" style={{ gridColumn: ki + 1, gridRow: 1 }}>
            {k.categorie}
          </div>
        ))}
        {kolommen.flatMap((k, ki) =>
          k.vragen.map((v, vi) => {
            const beurt = juistBeantwoord.get(v.id);
            const kleur = beurt ? sessie.teams[beurt.team].kleur : undefined;
            return (
              <button
                key={v.id}
                type="button"
                disabled={gespeeld.has(v.id)}
                onClick={() => setOpen(v)}
                style={{ gridColumn: ki + 1, gridRow: vi + 2, ...(beurt?.juist ? { background: kleur, color: 'white' } : {}) }}
                className={`flex min-h-16 items-center justify-center rounded-xl font-mono text-4xl font-bold transition ${
                  gespeeld.has(v.id) ? (beurt?.juist ? 'opacity-40' : 'bg-slate-200 text-slate-400') : 'bg-indigo-600 text-amber-300 shadow-md hover:-translate-y-0.5 hover:bg-indigo-500'
                }`}
                title={beurt ? `${sessie.teams[beurt.team].naam}: ${beurt.juist ? 'juist' : 'fout'}` : undefined}
              >
                {gespeeld.has(v.id) ? (beurt?.juist ? '✓' : '✗') : v.punten}
              </button>
            );
          }),
        )}
      </div>

      <Scorebord sessie={sessie} scores={teamScores(sessie)} actief={team} />

      {open && (
        <BeurtScherm
          sessie={sessie}
          team={team}
          vraag={open}
          punten={open.punten}
          onAnnuleer={() => setOpen(null)}
          onKlaar={({ leerlingId, juist }) => {
            let s = voegBeurtToe(sessie, { vraagId: open.id, team, leerlingId, juist, punten: juist ? open.punten : 0 });
            if (gespeeldeVragen(s).size >= s.vragen.length) s = beeindig(s);
            onUpdate(s);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
