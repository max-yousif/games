import { exporteerSessie } from '../lib/exportResults';
import { AfsluitKnoppen } from './AfsluitKnoppen';
import { korteNaamVan, resultatenPerLeerling, teamScores } from '../lib/session';
import type { Sessie } from '../lib/types';
import { Button } from './ui';

export function EindScherm({ sessie, winnaar, onOpnieuw, onBewaar, onVerwijder }: { sessie: Sessie; winnaar?: number | null; onOpnieuw: () => void; onBewaar: () => void; onVerwijder: () => void }) {
  const scores = teamScores(sessie);
  const volgorde = sessie.teams.map((t, i) => ({ ...t, i, score: scores[i] })).sort((a, b) => b.score - a.score);
  const winnaars = winnaar !== undefined ? (winnaar === null ? [] : [winnaar]) : volgorde.filter((t) => t.score === volgorde[0].score && t.score > 0).map((t) => t.i);
  const kort = korteNaamVan(sessie);
  const rijen = resultatenPerLeerling(sessie)
    .filter((r) => r.beurten > 0)
    .map((r) => ({ ...r, naam: kort(r.naam) }));
  const besteJuist = Math.max(0, ...rijen.filter((r) => r.naam !== '(hele team)').map((r) => r.juist));
  const sterren = rijen.filter((r) => r.naam !== '(hele team)' && r.juist === besteJuist && besteJuist > 0).map((r) => r.naam);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="text-center">
        <div className="text-6xl">🏆</div>
        <h1 className="mt-2 text-4xl font-bold">
          {winnaars.length === 0 ? 'Gelijkspel!' : winnaars.length === 1 ? `${sessie.teams[winnaars[0]].naam} wint!` : `Gelijkspel: ${winnaars.map((i) => sessie.teams[i].naam).join(' en ')}`}
        </h1>
        {sterren.length > 0 && (
          <p className="mt-2 text-xl text-slate-600">
            ⭐ Meeste juiste antwoorden: {sterren.join(', ')} ({besteJuist})
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {volgorde.map((t, plaats) => (
          <div key={t.i} className="pop w-48 rounded-2xl border-4 bg-surface p-4 text-center" style={{ borderColor: t.kleur, animationDelay: `${plaats * 0.1}s` }}>
            <div className="text-3xl">{['🥇', '🥈', '🥉'][plaats] ?? `${plaats + 1}e`}</div>
            <div className="mt-1 text-lg font-bold" style={{ color: t.kleur }}>
              {t.naam}
            </div>
            <div className="font-mono text-3xl font-bold">{t.score}</div>
          </div>
        ))}
      </div>

      {rijen.length > 0 && (
        <table className="mt-10 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
          <thead className="bg-slate-100 text-sm text-slate-600">
            <tr>
              <th className="px-4 py-2">Leerling</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2 text-right">Beurten</th>
              <th className="px-4 py-2 text-right">Juist</th>
              <th className="px-4 py-2 text-right">Fout</th>
              <th className="px-4 py-2 text-right">Punten</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{r.naam}</td>
                <td className="px-4 py-2">{r.team}</td>
                <td className="px-4 py-2 text-right">{r.beurten}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{r.juist}</td>
                <td className="px-4 py-2 text-right text-red-700">{r.fout}</td>
                <td className="px-4 py-2 text-right font-mono">{r.punten}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => exporteerSessie(sessie)}>
          ⬇ Resultaten exporteren (Excel)
        </Button>
        <Button onClick={onOpnieuw}>↻ Opnieuw spelen met dezelfde teams</Button>
        <AfsluitKnoppen onBewaar={onBewaar} onVerwijder={onVerwijder} />
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">Afsluiten bewaart de resultaten onder Resultaten; zonder opslaan worden ze gewist.</p>
    </div>
  );
}
