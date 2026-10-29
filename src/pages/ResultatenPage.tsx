import { Fragment, useMemo, useState } from 'react';
import { Button, inputClass, Notice, PageHeader } from '../components/ui';
import { beeindigSpel } from '../lib/beeindigen';
import { datumTekst, exporteerAlles, exporteerSessie, SPEL_NAMEN } from '../lib/exportResults';
import { href } from '../lib/route';
import { aantalSpelers, isBewaard, leerlingNaam, overzichtPerLeerling, procentJuist, resultatenPerLeerling, teamScores, type LeerlingOverzicht } from '../lib/session';
import type { Store } from '../lib/store';
import type { Sessie } from '../lib/types';
import { jaarVanKlas, klasJaar } from './KlassenPage';

const SPEL_ICONEN: Record<Sessie['spelType'], string> = {
  quizbord: '🟦',
  vieropeenrij: '🔴',
  bom: '💣',
  live: '💻',
  escape: '🗝️',
  whodunit: '🕵️',
  codekraker: '🔐',
  cluedo: '🔎',
  territorium: '🖌️',
};

/** Kerncijfers van één spel voor de lijst. */
function samenvatting(s: Sessie) {
  const juist = s.beurten.filter((b) => b.juist).length;
  const procent = s.beurten.length ? Math.round((juist / s.beurten.length) * 100) : null;
  const scores = teamScores(s);
  const perLeerling = resultatenPerLeerling(s).filter((r) => r.naam !== '(hele team)' && r.beurten > 0);
  // Live spellen: de beste leerling; spellen in teams: het winnende team.
  const winnaar =
    s.teams.length > 1
      ? s.teams[scores.indexOf(Math.max(...scores))]?.naam
      : [...perLeerling].sort((a, b) => b.punten - a.punten || b.juist - a.juist)[0]?.naam;
  return { procent, spelers: aantalSpelers(s), winnaar };
}

const maand = (iso: string) => new Date(iso).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });

export function ResultatenPage({ store }: { store: Store }) {
  const [klasFilter, setKlasFilter] = useState('');
  const [jaarFilter, setJaarFilter] = useState(0);
  const [spelFilter, setSpelFilter] = useState<Sessie['spelType'] | ''>('');
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [weergave, setWeergave] = useState<'spel' | 'leerling'>('spel');
  // Enkel de spellen waarvan de resultaten bewaard werden.
  const bewaard = store.sessies.filter(isBewaard);
  // Leerjaar van een klas (zelf gekozen of uit de naam); ook voor klassen die intussen verwijderd zijn.
  const jaarVan = (klasNaam: string) => {
    const k = store.klassen.find((x) => x.naam === klasNaam);
    return k ? klasJaar(k) : jaarVanKlas(klasNaam);
  };
  const term = zoek.trim().toLowerCase();
  const naJaar = bewaard.filter((s) => !jaarFilter || jaarVan(s.klasNaam) === jaarFilter);
  const klassen = [...new Set(naJaar.map((s) => s.klasNaam))].sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }));
  const jaren = [...new Set(bewaard.map((s) => jaarVan(s.klasNaam)).filter((j): j is number => j !== null))].sort();
  const spellen = [...new Set(bewaard.map((s) => s.spelType))];
  const sessies = naJaar
    .filter((s) => !klasFilter || s.klasNaam === klasFilter)
    .filter((s) => !spelFilter || s.spelType === spelFilter)
    .filter((s) => !term || `${s.setTitel} ${s.klasNaam}`.toLowerCase().includes(term))
    .sort((a, b) => b.gestart.localeCompare(a.gestart));

  // Kerncijfers van wat gefilterd is.
  const beurten = sessies.flatMap((s) => s.beurten);
  const gemiddeld = beurten.length ? Math.round((beurten.filter((b) => b.juist).length / beurten.length) * 100) : null;
  const leerlingen = new Set(sessies.flatMap((s) => resultatenPerLeerling(s).filter((r) => r.naam !== '(hele team)').map((r) => `${s.klasNaam}:${r.naam}`))).size;

  // Per maand groeperen.
  const perMaand: { maand: string; sessies: Sessie[] }[] = [];
  for (const s of sessies) {
    const m = maand(s.gestart);
    if (perMaand.at(-1)?.maand !== m) perMaand.push({ maand: m, sessies: [] });
    perMaand.at(-1)!.sessies.push(s);
  }

  const chip = (actief: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition ${actief ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`;
  const filterTekst = [klasFilter, jaarFilter ? `${jaarFilter}e jaar` : '', spelFilter ? SPEL_NAMEN[spelFilter] : ''].filter(Boolean).join(', ');

  return (
    <div>
      <PageHeader title="Resultaten">
        <Button variant="primary" disabled={sessies.length === 0} onClick={() => exporteerAlles(sessies)}>
          ⬇ {filterTekst ? `Selectie (${sessies.length})` : 'Alles'} exporteren (Excel)
        </Button>
      </PageHeader>

      {bewaard.length === 0 ? (
        <Notice>Nog geen bewaarde resultaten. Kies op het einde van een spel “💾 Resultaten bewaren” om ze hier te zien.</Notice>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                className={`${inputClass} max-w-xs`}
                placeholder="🔍 Zoek op vragenset of klas…"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                aria-label="Zoek in de resultaten"
              />
              {spellen.length > 1 && (
                <select className={`${inputClass} max-w-[14rem]`} value={spelFilter} onChange={(e) => setSpelFilter(e.target.value as Sessie['spelType'] | '')} aria-label="Spel">
                  <option value="">Alle spellen</option>
                  {spellen.map((t) => (
                    <option key={t} value={t}>
                      {SPEL_ICONEN[t]} {SPEL_NAMEN[t]}
                    </option>
                  ))}
                </select>
              )}
              <div className="ml-auto inline-flex rounded-lg border border-slate-300 bg-surface p-1 text-sm" role="tablist">
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
            </div>
            {jaren.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Leerjaar">
                <span className="w-14 text-sm font-semibold text-slate-500">Jaar</span>
                <button type="button" className={chip(jaarFilter === 0)} aria-pressed={jaarFilter === 0} onClick={() => setJaarFilter(0)}>
                  Alle
                </button>
                {jaren.map((j) => (
                  <button
                    key={j}
                    type="button"
                    className={chip(jaarFilter === j)}
                    aria-pressed={jaarFilter === j}
                    onClick={() => {
                      setJaarFilter(j);
                      setKlasFilter('');
                    }}
                  >
                    {j}e jaar
                  </button>
                ))}
              </div>
            )}
            {klassen.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Klas">
                <span className="w-14 text-sm font-semibold text-slate-500">Klas</span>
                <button type="button" className={chip(klasFilter === '')} aria-pressed={klasFilter === ''} onClick={() => setKlasFilter('')}>
                  Alle klassen
                </button>
                {klassen.map((k) => (
                  <button key={k} type="button" className={chip(klasFilter === k)} aria-pressed={klasFilter === k} onClick={() => setKlasFilter(k)}>
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kerncijfers */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {[
              ['Spellen', String(sessies.length)],
              ['Leerlingen', String(leerlingen)],
              ['Gemiddeld juist', gemiddeld === null ? '—' : `${gemiddeld}%`],
            ].map(([label, waarde]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-surface px-4 py-3 shadow-sm">
                <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
                <div className="mt-1 text-3xl font-bold">{waarde}</div>
              </div>
            ))}
          </div>

          {sessies.length === 0 && <Notice>Geen resultaten met deze filter.</Notice>}

          {weergave === 'leerling' && sessies.length > 0 && <PerLeerling sessies={sessies} />}

          {weergave === 'spel' && (
            <div className="space-y-6">
              {perMaand.map((g) => (
                <section key={g.maand}>
                  <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{g.maand}</h2>
                  <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
                    {g.sessies.map((s) => {
                      const sam = samenvatting(s);
                      const d = new Date(s.gestart);
                      return (
                        <li key={s.id} data-resultaat>
                          <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-slate-50">
                            <span className="w-12 shrink-0 text-center leading-tight">
                              <span className="block text-xl font-bold">{d.getDate()}</span>
                              <span className="block text-xs text-slate-500 uppercase">{d.toLocaleDateString('nl-BE', { month: 'short' })}</span>
                            </span>
                            <span className="text-2xl" aria-hidden>
                              {SPEL_ICONEN[s.spelType]}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{s.setTitel}</span>
                              <span className="block text-sm text-slate-500">
                                {SPEL_NAMEN[s.spelType]} · {d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                                {!s.beeindigd && ' · niet afgewerkt'}
                              </span>
                            </span>
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-semibold text-indigo-800">{s.klasNaam}</span>
                            <span className="w-24 text-sm text-slate-500">👥 {sam.spelers} spelers</span>
                            <span className="w-28 text-sm">
                              {sam.procent !== null && (
                                <span className="inline-flex items-center gap-2">
                                  <span className="inline-block h-2 w-12 overflow-hidden rounded-full bg-slate-200">
                                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${sam.procent}%` }} />
                                  </span>
                                  {sam.procent}%
                                </span>
                              )}
                            </span>
                            <span className="w-36 truncate text-sm" title="Winnaar">
                              {sam.winnaar ? `🏆 ${sam.winnaar}` : ''}
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
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
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
