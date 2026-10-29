import { useEffect, useState } from 'react';
import { Button, FileButton, inputClass, Notice, PageHeader } from '../components/ui';
import { BackupError, bestandsnaam, downloadJson, leesBestand, setBestand, voegSamen } from '../lib/backup';
import { nu } from '../lib/ids';
import { dupliceerSet, nieuweSet, speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { ontbrekendeVoorbeelden, type Store } from '../lib/store';
import type { Vak, Vragenset } from '../lib/types';

export const VAK_LABELS: Record<Vak, string> = { wiskunde: 'Wiskunde', python: 'Python', ict: 'ICT', andere: 'Andere' };

const WOORDEN: Record<string, number> = { eerste: 1, tweede: 2, derde: 3, vierde: 4, vijfde: 5, zesde: 6 };

/** De leerjaren in een vrije tekst: "3e jaar (5 u)" = [3], "5e–6e jaar" = [5, 6], "derdes" = [3]. */
export function jarenVan(leerjaar: string): number[] {
  const t = leerjaar.toLowerCase();
  const jaren = new Set<number>();
  for (const m of t.matchAll(/\b([1-6])\s*(?:e|de|ste)\b/g)) jaren.add(Number(m[1]));
  for (const [woord, n] of Object.entries(WOORDEN)) if (new RegExp(`\\b${woord}s?\\b`).test(t)) jaren.add(n);
  return [...jaren].sort();
}

type Sortering = 'gewijzigd' | 'titel' | 'gespeeld';
const FILTER_SLEUTEL = 'games.v1.setfilter';

function leesFilter(): { jaar: number | 0 | -1; vak: Vak | ''; sortering: Sortering } {
  try {
    return { jaar: 0, vak: '', sortering: 'gewijzigd', ...JSON.parse(localStorage.getItem(FILTER_SLEUTEL) ?? '{}') };
  } catch {
    return { jaar: 0, vak: '', sortering: 'gewijzigd' };
  }
}

const VAK_ICONEN: Record<Vak, string> = { wiskunde: '📐', python: '🐍', ict: '💻', andere: '📚' };

export function SetsPage({ store }: { store: Store }) {
  const [melding, setMelding] = useState<{ tone: 'ok' | 'warn'; tekst: string } | null>(null);
  // Filter en sortering (onthouden in deze browser). jaar: 0 = alle, -1 = zonder jaar.
  const [filter, setFilter] = useState(leesFilter);
  const [zoek, setZoek] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_SLEUTEL, JSON.stringify(filter));
    } catch {
      // niet onthouden
    }
  }, [filter]);
  const zet = (f: Partial<typeof filter>) => setFilter((x) => ({ ...x, ...f }));
  const zoekterm = zoek.trim().toLowerCase();
  const jarenPerSet = new Map(store.sets.map((s) => [s.id, jarenVan(s.leerjaar)]));
  const sets = store.sets
    .filter((s) => {
      const jaren = jarenPerSet.get(s.id)!;
      if (filter.jaar === -1 ? jaren.length > 0 : filter.jaar !== 0 && !jaren.includes(filter.jaar)) return false;
      if (filter.vak && s.vak !== filter.vak) return false;
      if (!zoekterm) return true;
      const categorieen = s.vragen.map((v) => v.categorie).join(' ');
      return `${s.titel} ${s.beschrijving} ${s.leerjaar} ${categorieen}`.toLowerCase().includes(zoekterm);
    })
    .sort((a, b) =>
      filter.sortering === 'titel'
        ? a.titel.localeCompare(b.titel, 'nl', { numeric: true })
        : filter.sortering === 'gespeeld'
          ? (b.statistiek?.gespeeld ?? 0) - (a.statistiek?.gespeeld ?? 0) || b.gewijzigd.localeCompare(a.gewijzigd)
          : b.gewijzigd.localeCompare(a.gewijzigd),
    );
  const telJaar = (j: number) => store.sets.filter((s) => (j === -1 ? jarenPerSet.get(s.id)!.length === 0 : jarenPerSet.get(s.id)!.includes(j))).length;
  const vakken = (Object.keys(VAK_LABELS) as Vak[]).filter((v) => store.sets.some((s) => s.vak === v));
  const ontbrekend = ontbrekendeVoorbeelden(store.sets);

  function nieuw() {
    const s = nieuweSet();
    store.setSets((all) => [...all, s]);
    ga({ pagina: 'set', id: s.id });
  }

  async function importeerJson(file: File) {
    try {
      const data = leesBestand(await file.text());
      const nieuwe = data.soort === 'set' ? [data.set] : data.backup.sets;
      store.setSets((all) => voegSamen(all, nieuwe));
      setMelding({ tone: 'ok', tekst: `${nieuwe.length} vragenset(s) toegevoegd.` });
    } catch (e) {
      setMelding({ tone: 'warn', tekst: e instanceof BackupError ? e.message : 'Het bestand kon niet gelezen worden.' });
    }
  }

  function verwijder(s: Vragenset) {
    if (confirm(`Vragenset "${s.titel}" verwijderen? Gespeelde resultaten blijven bewaard.`)) {
      store.setSets((all) => all.filter((x) => x.id !== s.id));
    }
  }

  const chip = (actief: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition ${actief ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`;

  return (
    <div>
      <PageHeader title="Vragensets">
        <Button variant="primary" onClick={nieuw}>
          + Nieuwe vragenset
        </Button>
        <a href={href({ pagina: 'importeren' })} className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium hover:bg-slate-50">
          📥 Vragen importeren
        </a>
        <FileButton accept=".json,application/json" onFile={importeerJson}>
          Openen uit bestand…
        </FileButton>
      </PageHeader>

      {melding && (
        <div className="mb-4">
          <Notice tone={melding.tone}>{melding.tekst}</Notice>
        </div>
      )}

      {/* Filters */}
      <div className="sticky top-0 z-10 -mx-2 mb-4 space-y-3 rounded-2xl border border-slate-200 bg-surface/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className={`${inputClass} max-w-xs`}
            placeholder="🔍 Zoek op titel, onderwerp…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            aria-label="Zoek een vragenset"
          />
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
            Sorteren
            <select className={`${inputClass} w-auto`} value={filter.sortering} onChange={(e) => zet({ sortering: e.target.value as Sortering })}>
              <option value="gewijzigd">laatst gewijzigd</option>
              <option value="titel">titel (A–Z)</option>
              <option value="gespeeld">meest gespeeld</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Leerjaar">
          <span className="w-14 text-sm font-semibold text-slate-500">Jaar</span>
          <button type="button" className={chip(filter.jaar === 0)} aria-pressed={filter.jaar === 0} onClick={() => zet({ jaar: 0 })}>
            Alle ({store.sets.length})
          </button>
          {[3, 4, 5, 6, 1, 2]
            .filter((j) => j >= 3 || telJaar(j) > 0)
            .map((j) => (
              <button key={j} type="button" className={chip(filter.jaar === j)} aria-pressed={filter.jaar === j} onClick={() => zet({ jaar: j })}>
                {j}e jaar ({telJaar(j)})
              </button>
            ))}
          {telJaar(-1) > 0 && (
            <button type="button" className={chip(filter.jaar === -1)} aria-pressed={filter.jaar === -1} onClick={() => zet({ jaar: -1 })}>
              Zonder jaar ({telJaar(-1)})
            </button>
          )}
        </div>
        {vakken.length > 1 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vak">
            <span className="w-14 text-sm font-semibold text-slate-500">Vak</span>
            <button type="button" className={chip(filter.vak === '')} aria-pressed={filter.vak === ''} onClick={() => zet({ vak: '' })}>
              Alle vakken
            </button>
            {vakken.map((v) => (
              <button key={v} type="button" className={chip(filter.vak === v)} aria-pressed={filter.vak === v} onClick={() => zet({ vak: v })}>
                {VAK_ICONEN[v]} {VAK_LABELS[v]}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mb-2 text-sm text-slate-500">
        {sets.length} {sets.length === 1 ? 'vragenset' : 'vragensets'}
      </p>

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-sm">
        {sets.map((s) => {
          const categorieen = [...new Set(s.vragen.map((v) => v.categorie.trim()).filter(Boolean))];
          const klaar = speelbareVragen(s).length;
          const jaren = jarenPerSet.get(s.id)!;
          return (
            <li key={s.id} data-set className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
              <a href={href({ pagina: 'set', id: s.id })} className="shrink-0" tabIndex={-1} aria-hidden>
                {s.cover ? (
                  <img src={s.cover} alt="" className="aspect-video w-28 rounded-lg object-cover" />
                ) : (
                  <div className="flex aspect-video w-28 items-center justify-center rounded-lg bg-slate-100 text-3xl">{VAK_ICONEN[s.vak]}</div>
                )}
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={href({ pagina: 'set', id: s.id })} className="font-semibold hover:underline">
                    {s.titel}
                  </a>
                  {jaren.map((j) => (
                    <span key={j} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                      {j}e jaar
                    </span>
                  ))}
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent-tekst)]">{VAK_LABELS[s.vak]}</span>
                  {s.voorbeeld && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">voorbeeld</span>}
                </div>
                <div className="mt-0.5 truncate text-sm text-slate-600" title={s.beschrijving || s.leerjaar}>
                  {[s.leerjaar, s.beschrijving].filter(Boolean).join(' · ') || '\u00a0'}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500" title={categorieen.join(', ')}>
                  {s.vragen.length} vragen{klaar < s.vragen.length && ` (${s.vragen.length - klaar} onvolledig)`}
                  {categorieen.length > 0 && ` · ${categorieen.join(', ')}`}
                </div>
              </div>
              <div className="w-40 shrink-0 text-sm text-slate-500">
                {s.statistiek?.gespeeld
                  ? `▶ ${s.statistiek.gespeeld}× gespeeld · ${s.statistiek.spelers} ${s.statistiek.spelers === 1 ? 'speler' : 'spelers'}`
                  : '▶ nog niet gespeeld'}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={href({ pagina: 'spelen', setId: s.id })} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
                  Spelen
                </a>
                <a href={href({ pagina: 'set', id: s.id })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  Bewerken
                </a>
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label={`Meer voor ${s.titel}`}>
                    ⋯
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-surface p-1 shadow-lg">
                    <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => store.setSets((all) => [...all, dupliceerSet(s)])}>
                      Dupliceren
                    </button>
                    <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => downloadJson(bestandsnaam(s.titel, 'json'), setBestand(s))}>
                      Als bestand
                    </button>
                    <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" aria-label={`${s.titel} verwijderen`} onClick={() => verwijder(s)}>
                      🗑 Verwijderen
                    </button>
                  </div>
                </details>
              </div>
            </li>
          );
        })}
        {sets.length === 0 && store.sets.length > 0 && <li className="p-6 text-center text-slate-500">Geen vragensets met deze filter.</li>}
      </ul>

      {store.sets.length === 0 && <Notice>Nog geen vragensets. Maak een nieuwe set of importeer vragen.</Notice>}

      <div className="mt-8 space-y-2 text-sm text-slate-600">
        <p>
          <strong>Vragen importeren:</strong> plak cellen uit Excel of Google Sheets, tekst uit Word of van een AI-chatbot, of sleep een Excel-bestand. Je ziet meteen
          een voorbeeld van elke vraag voor je ze toevoegt.{' '}
          <a className="text-[var(--accent-tekst)] underline" href={href({ pagina: 'importeren' })}>
            Vragen importeren
          </a>
        </p>
        {ontbrekend.length > 0 && (
          <p>
            <button
              type="button"
              className="text-[var(--accent-tekst)] underline"
              onClick={() => store.setSets((all) => [...all, ...ontbrekend.map((v) => ({ ...v, gewijzigd: nu() }))])}
            >
              Voorbeeldsets opnieuw toevoegen
            </button>{' '}
            ({ontbrekend.map((v) => v.titel).join(', ')})
          </p>
        )}
      </div>
    </div>
  );
}
