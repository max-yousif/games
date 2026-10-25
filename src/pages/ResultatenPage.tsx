import { useState } from 'react';
import { Button, Notice, PageHeader } from '../components/ui';
import { beeindigSpel } from '../lib/beeindigen';
import { datumTekst, exporteerAlles, exporteerSessie, SPEL_NAMEN } from '../lib/exportResults';
import { href } from '../lib/route';
import { leerlingNaam, resultatenPerLeerling, teamScores } from '../lib/session';
import type { Store } from '../lib/store';
import type { Sessie } from '../lib/types';

export function ResultatenPage({ store }: { store: Store }) {
  const [klasFilter, setKlasFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const klassen = [...new Set(store.sessies.map((s) => s.klasNaam))].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }));
  const sessies = store.sessies.filter((s) => !klasFilter || s.klasNaam === klasFilter).sort((a, b) => b.gestart.localeCompare(a.gestart));

  return (
    <div>
      <PageHeader title="Resultaten">
        {klassen.length > 1 && (
          <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={klasFilter} onChange={(e) => setKlasFilter(e.target.value)}>
            <option value="">Alle klassen</option>
            {klassen.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        )}
        <Button variant="primary" disabled={sessies.length === 0} onClick={() => exporteerAlles(sessies)}>
          ⬇ {klasFilter ? `Alles van ${klasFilter}` : 'Alles'} exporteren (Excel)
        </Button>
      </PageHeader>

      {sessies.length === 0 && <Notice>Nog geen gespeelde spellen.</Notice>}

      <div className="space-y-3">
        {sessies.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left">
              <span className="font-semibold">{s.setTitel}</span>
              <span className="text-sm text-slate-500">
                {SPEL_NAMEN[s.spelType]} · {s.klasNaam} · {datumTekst(s.gestart)} · {s.beurten.length} beurten
              </span>
              {!s.beeindigd && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">niet afgewerkt</span>}
              <span className="ml-auto flex gap-2 text-sm">
                {s.teams.map((t, i) => (
                  <span key={i} className="font-mono font-semibold" style={{ color: t.kleur }}>
                    {teamScores(s)[i]}
                  </span>
                ))}
              </span>
              <span className="text-slate-400">{open === s.id ? '▲' : '▼'}</span>
            </button>
            {open === s.id && (
              <SessieDetail
                sessie={s}
                onDelete={() => confirm('Dit resultaat verwijderen?') && store.setSessies((all) => all.filter((x) => x.id !== s.id))}
                onBeeindig={async () => {
                  if (confirm('Dit spel beëindigen? De resultaten blijven bewaard.')) store.bewaarSessie(await beeindigSpel(s));
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SessieDetail({ sessie: s, onDelete, onBeeindig }: { sessie: Sessie; onDelete: () => void; onBeeindig: () => void }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Leerling</th>
              <th className="py-1">Team</th>
              <th className="py-1 text-right">Juist</th>
              <th className="py-1 text-right">Fout</th>
              <th className="py-1 text-right">Punten</th>
            </tr>
          </thead>
          <tbody>
            {resultatenPerLeerling(s).map((r, i) => (
              <tr key={i} className={`border-t border-slate-100 ${r.beurten === 0 ? 'text-slate-400' : ''}`}>
                <td className="py-1">{r.naam}</td>
                <td className="py-1">{r.team}</td>
                <td className="py-1 text-right">{r.juist}</td>
                <td className="py-1 text-right">{r.fout}</td>
                <td className="py-1 text-right font-mono">{r.punten}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ol className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {s.beurten.map((b, i) => {
            const v = s.vragen.find((x) => x.id === b.vraagId);
            return (
              <li key={i} className="flex gap-2">
                <span className="w-6 text-right text-slate-400">{i + 1}.</span>
                <span className={b.juist ? 'text-emerald-600' : 'text-red-600'}>{b.juist ? '✓' : '✗'}</span>
                <span style={{ color: s.teams[b.team]?.kleur }}>{leerlingNaam(s, b.leerlingId)}</span>
                <span className="truncate text-slate-500">
                  {v?.categorie} {v && `(${v.punten})`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => exporteerSessie(s)}>
          ⬇ Exporteren (Excel)
        </Button>
        {!s.beeindigd && (
          <>
            <a href={href({ pagina: 'sessie', id: s.id })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              Hervatten
            </a>
            <Button onClick={onBeeindig}>Beëindigen</Button>
          </>
        )}
        <Button variant="danger" className="ml-auto" onClick={onDelete}>
          Verwijderen
        </Button>
      </div>
    </div>
  );
}
