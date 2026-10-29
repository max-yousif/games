import { Fragment, useMemo, useState } from 'react';
import { Button, Notice, PageHeader } from '../components/ui';
import { beeindigSpel } from '../lib/beeindigen';
import { datumTekst, exporteerAlles, exporteerSessie, SPEL_NAMEN } from '../lib/exportResults';
import { href } from '../lib/route';
import { isBewaard, leerlingNaam, overzichtPerLeerling, procentJuist, resultatenPerLeerling, teamScores, type LeerlingOverzicht } from '../lib/session';
import type { Store } from '../lib/store';
import type { Sessie } from '../lib/types';

export function ResultatenPage({ store }: { store: Store }) {
  const [klasFilter, setKlasFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [weergave, setWeergave] = useState<'spel' | 'leerling'>('spel');
  // Enkel de spellen waarvan de resultaten bewaard werden.
  const bewaard = store.sessies.filter(isBewaard);
  const klassen = [...new Set(bewaard.map((s) => s.klasNaam))].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }));
  const sessies = bewaard.filter((s) => !klasFilter || s.klasNaam === klasFilter).sort((a, b) => b.gestart.localeCompare(a.gestart));

  return (
    <div>
      <PageHeader title="Resultaten">
        {klassen.length > 1 && (
          <select className="rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm" value={klasFilter} onChange={(e) => setKlasFilter(e.target.value)}>
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

      {sessies.length === 0 && <Notice>Nog geen bewaarde resultaten. Kies op het einde van een spel “💾 Resultaten bewaren” om ze hier te zien.</Notice>}

      {sessies.length > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-slate-300 bg-surface p-1 text-sm" role="tablist">
          {(
            [
              ['spel', 'Per spel'],
              ['leerling', 'Per leerling'],
            ] as const
          ).map(([w, label]) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={weergave === w}
              onClick={() => setWeergave(w)}
              className={`rounded-md px-4 py-1.5 font-medium ${weergave === w ? 'bg-[var(--accent)] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {weergave === 'leerling' && sessies.length > 0 && <PerLeerling sessies={sessies} />}

      <div className={`space-y-3 ${weergave === 'spel' ? '' : 'hidden'}`}>
        {sessies.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-200 bg-surface shadow-sm">
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

type Sortering = 'naam' | 'spellen' | 'procent' | 'punten';

/** Totalen per leerling over alle (gefilterde) spellen; klik op een leerling voor de spellen. */
function PerLeerling({ sessies }: { sessies: Sessie[] }) {
  const [sortering, setSortering] = useState<Sortering>('naam');
  const [open, setOpen] = useState<string | null>(null);
  const alle = useMemo(() => overzichtPerLeerling(sessies), [sessies]);
  const klassen = [...new Set(alle.map((o) => o.klas))];

  const sorteer = (lijst: LeerlingOverzicht[]) =>
    [...lijst].sort((a, b) => {
      if (sortering === 'spellen') return b.spellen - a.spellen || a.naam.localeCompare(b.naam, 'nl');
      if (sortering === 'procent') return (procentJuist(b) ?? -1) - (procentJuist(a) ?? -1) || a.naam.localeCompare(b.naam, 'nl');
      if (sortering === 'punten') return b.punten - a.punten || a.naam.localeCompare(b.naam, 'nl');
      return a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' });
    });

  const kop = (s: Sortering, label: string, rechts = true) => (
    <th className={`px-3 py-2 ${rechts ? 'text-right' : ''}`}>
      <button type="button" className={`font-medium hover:underline ${sortering === s ? 'text-[var(--accent-tekst)]' : ''}`} onClick={() => setSortering(s)}>
        {label}
        {sortering === s && ' ▾'}
      </button>
    </th>
  );

  if (alle.length === 0) return <Notice>Nog geen resultaten per leerling: speel met een klas (namen per team of live).</Notice>;

  return (
    <div className="space-y-6">
      {klassen.map((klas) => (
        <div key={klas} className="overflow-x-auto rounded-2xl border border-slate-200 bg-surface shadow-sm">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">{klas}</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                {kop('naam', 'Leerling', false)}
                {kop('spellen', 'Spellen')}
                <th className="px-3 py-2 text-right font-medium">Juist</th>
                <th className="px-3 py-2 text-right font-medium">Fout</th>
                {kop('procent', '% juist')}
                {kop('punten', 'Punten')}
              </tr>
            </thead>
            <tbody>
              {sorteer(alle.filter((o) => o.klas === klas)).map((o) => {
                const sleutel = `${o.klas}:${o.naam}`;
                const p = procentJuist(o);
                return (
                  <Fragment key={sleutel}>
                    <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setOpen(open === sleutel ? null : sleutel)}>
                      <td className="px-3 py-2 font-medium">
                        <span className="mr-1 text-slate-400">{open === sleutel ? '▾' : '▸'}</span>
                        {o.naam}
                      </td>
                      <td className="px-3 py-2 text-right">{o.spellen}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{o.juist}</td>
                      <td className="px-3 py-2 text-right text-red-700">{o.fout}</td>
                      <td className="px-3 py-2 text-right">
                        {p !== null && (
                          <span className="inline-flex items-center gap-2">
                            <span className="hidden h-2 w-16 overflow-hidden rounded-full bg-slate-200 sm:inline-block">
                              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${p}%` }} />
                            </span>
                            {p}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{o.punten}</td>
                    </tr>
                    {open === sleutel && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="px-3 py-2">
                          <ul className="space-y-1">
                            {o.perSpel.map(({ sessie, resultaat }) => (
                              <li key={sessie.id} className="flex flex-wrap gap-x-3 text-sm">
                                <span className="w-32 text-slate-500">{datumTekst(sessie.gestart)}</span>
                                <span className="font-medium">{sessie.setTitel}</span>
                                <span className="text-slate-500">{SPEL_NAMEN[sessie.spelType]}</span>
                                <span className="ml-auto">
                                  <span className="text-emerald-700">{resultaat.juist} juist</span> · <span className="text-red-700">{resultaat.fout} fout</span> ·{' '}
                                  <span className="font-mono">{resultaat.punten}</span> punten
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-sm text-slate-500">
        Leerlingen worden per klas op naam samengeteld. Beurten van het hele team tellen niet mee. De export (Excel) bevat ook een blad "Per leerling".
      </p>
    </div>
  );
}
