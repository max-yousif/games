import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import type { Raadsel } from '../lib/types';
import { EINDCODE } from './escape';
import { laatstePoging, type Status } from './EscapeSpeler';
import { Beantwoord, foutTekst } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';
import { hintsUitBeloning, rasterNaarTekst, rasterUitTekst, type Hint, type PubliekRaadsel } from './whodunit';

/** De oplossing van het raadsel als tabel (voor de leerkracht). */
export function OplossingTabel({ raadsel }: { raadsel: Raadsel }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">{raadsel.kolomTitel}</th>
            {raadsel.kolommen.map((k, i) => (
              <th key={i} className="px-4 py-2 text-center">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {raadsel.categorieen.map((c, ci) => (
            <tr key={ci} className="border-t border-slate-100 text-lg">
              <th className="px-4 py-2 font-semibold">{c.naam}</th>
              {c.oplossing.map((w, k) => (
                <td key={k} className="px-4 py-2 text-center">
                  {w}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const leegRaster = (r: PubliekRaadsel) => r.categorieen.map(() => r.kolommen.map(() => ''));

/** Ingevulde tabel per sessie bewaren, zodat herladen niets wist. */
function useRaster(sessieId: string, raadsel: PubliekRaadsel): [string[][], (r: string[][]) => void] {
  const sleutel = `klasspelen.whodunit.${sessieId}`;
  const [raster, setRaster] = useState<string[][]>(() => {
    try {
      const r = rasterUitTekst(localStorage.getItem(sleutel) ?? '');
      if (r && r.length === raadsel.categorieen.length && r.every((rij) => rij.length === raadsel.kolommen.length)) return r;
    } catch {
      // geen opslag
    }
    return leegRaster(raadsel);
  });
  const zet = (r: string[][]) => {
    setRaster(r);
    try {
      localStorage.setItem(sleutel, rasterNaarTekst(r));
    } catch {
      // geen opslag: enkel in het geheugen
    }
  };
  return [raster, zet];
}

/** Whodunit voor de leerling: oefeningen oplossen voor hints en de tabel invullen. */
export function WhodunitSpeler({
  be,
  sessie,
  antwoorden,
  spelerId,
  nieuwSpel,
}: {
  be: LiveBackend;
  sessie: LiveSessie;
  antwoorden: LiveAntwoord[];
  spelerId: string | null;
  nieuwSpel: ReactNode;
}) {
  const raadsel = sessie.raadsel!;
  const vragen = sessie.vragen ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [raster, setRaster] = useRaster(sessie.id, raadsel);
  const [nu, setNu] = useState(() => Date.now());
  const foutGezien = useRef(new Map<string, number>());

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

  const hints = new Map<number, Hint>();
  for (const a of antwoorden) if (a.juist && a.vraagNr !== EINDCODE) for (const h of hintsUitBeloning(a.beloning)) hints.set(h.nr, h);
  const juist = new Set(antwoorden.filter((a) => a.juist && a.vraagNr !== EINDCODE).map((a) => a.vraagNr));
  const opgelost = antwoorden.find((a) => a.vraagNr === EINDCODE && a.juist);
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  function status(nr: number): Status {
    const laatste = laatstePoging(antwoorden, nr);
    if (!laatste) return { soort: 'open' };
    if (laatste.juist) return { soort: 'klaar' };
    if (laatste.juist === null) return { soort: 'nakijken' };
    const rest = sessie.wachttijd * 1000 - (nu - (foutGezien.current.get(laatste.id) ?? nu));
    return rest > 0 ? { soort: 'wachten', seconden: Math.ceil(rest / 1000), fout: true } : { soort: 'open', fout: true };
  }

  if (sessie.status === 'einde') {
    const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">{opgelost ? '🎉' : '🕵️'}</div>
        <h1 className="mt-3 text-3xl font-bold">{opgelost ? `Opgelost in ${tijdTekst(opgelost.tijdMs)}!` : 'Het spel is afgelopen'}</h1>
        <p className="mt-2 text-xl text-slate-600">
          Je loste {juist.size} van de {vragen.length} oefeningen op{plaats > 0 && ` · plaats ${plaats}`}.
        </p>
        {nieuwSpel}
      </div>
    );
  }

  if (opgelost) {
    return (
      <div className="space-y-5">
        <div className="pop rounded-2xl bg-emerald-600 p-10 text-center text-white shadow-sm">
          <div className="text-7xl">🎉</div>
          <h1 className="mt-3 text-4xl font-bold">Raadsel opgelost!</h1>
          <p className="mt-2 text-2xl">in {tijdTekst(opgelost.tijdMs)}</p>
          <p className="mt-4 text-lg opacity-90">Wacht tot de leerkracht het spel afsluit.</p>
        </div>
        <Tabel raadsel={raadsel} raster={raster} />
      </div>
    );
  }

  if (resterend !== null && resterend <= 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">⏰</div>
        <h1 className="mt-3 text-3xl font-bold">De tijd is om!</h1>
        <p className="mt-2 text-xl text-slate-600">
          Je loste {juist.size} van de {vragen.length} oefeningen op.
        </p>
      </div>
    );
  }

  // Oefeningen gegroepeerd per categorie (bv. Reeks 1, Reeks 2 ...).
  const groepen: { naam: string; nrs: number[] }[] = [];
  vragen.forEach((v, nr) => {
    const g = groepen.at(-1);
    if (g && g.naam === v.categorie) g.nrs.push(nr);
    else groepen.push({ naam: v.categorie, nrs: [nr] });
  });

  return (
    <div className="breed space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xl font-semibold">🕵️ {sessie.titel}</span>
        <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
          ⏱ {tijdTekst(resterend !== null ? resterend : verstreken)}
        </span>
      </div>

      <details open className="rounded-2xl bg-surface p-5 shadow-sm">
        <summary className="cursor-pointer text-2xl font-bold">{raadsel.titel}</summary>
        {raadsel.verhaal && <RichText text={raadsel.verhaal} className="mt-3 text-lg leading-relaxed" />}
        <ul className="mt-3 space-y-1">
          {raadsel.categorieen.map((c) => (
            <li key={c.naam}>
              <strong>{c.naam}:</strong> {c.opties.join(', ')}
            </li>
          ))}
        </ul>
      </details>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Oefeningen <span className="text-base font-normal text-slate-500">· elke juiste oefening geeft een roddel</span>
          </h2>
          {groepen.map((g, gi) => (
            <div key={gi} className="space-y-2">
              {g.naam && <h3 className="font-semibold text-slate-600">{g.naam}</h3>}
              {g.nrs.map((nr) => (
                <Oefening key={nr} nr={nr} be={be} sessie={sessie} status={status(nr)} open={open === nr} onOpen={() => setOpen(open === nr ? null : nr)} />
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <div className="rounded-2xl bg-surface p-5 shadow-sm">
            <h2 className="text-xl font-semibold">
              🗣️ Roddels{' '}
              <span className="text-base font-normal text-slate-500">
                {hints.size} / {raadsel.aantalHints}
              </span>
            </h2>
            <ol className="mt-3 space-y-1.5">
              {Array.from({ length: raadsel.aantalHints }, (_, i) => {
                const h = hints.get(i + 1);
                return (
                  <li key={i} className={`flex gap-2 ${h ? 'pop' : 'text-slate-400'}`}>
                    <span className="w-6 shrink-0 text-right font-mono">{i + 1}.</span>
                    {h ? <RichText text={h.tekst} /> : <span>🔒 nog te verdienen</span>}
                  </li>
                );
              })}
            </ol>
          </div>
          <Oplossen be={be} sessie={sessie} raadsel={raadsel} raster={raster} setRaster={setRaster} status={status(EINDCODE)} />
        </div>
      </div>
    </div>
  );
}

function Oefening({ nr, be, sessie, status, open, onOpen }: { nr: number; be: LiveBackend; sessie: LiveSessie; status: Status; open: boolean; onOpen: () => void }) {
  const v = sessie.vragen![nr];
  return (
    <div className={`rounded-2xl border-2 bg-surface ${status.soort === 'klaar' ? 'border-emerald-300' : open ? 'border-[var(--accent)]' : 'border-slate-200'}`}>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="text-2xl">{status.soort === 'klaar' ? '✅' : status.soort === 'nakijken' ? '⏳' : '✏️'}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-500">Oefening {nr + 1}</span>
          <RichText text={v.tekst} className={open ? 'text-lg font-medium' : 'line-clamp-2'} />
        </span>
        {status.soort === 'wachten' && <span className="shrink-0 text-sm text-red-600">opnieuw over {status.seconden}s</span>}
        {status.soort === 'open' && status.fout && <span className="shrink-0 text-sm text-red-600">fout</span>}
      </button>
      {open && status.soort !== 'klaar' && (
        <div className="border-t border-slate-100 p-4">
          {status.soort === 'nakijken' && <p className="text-slate-500">Wordt nagekeken…</p>}
          {status.soort === 'wachten' && <p className="font-semibold text-red-600">Fout! Opnieuw proberen over {status.seconden} s, of probeer intussen een andere oefening.</p>}
          {status.soort === 'open' && (
            <>
              {status.fout && <p className="mb-2 rounded-lg bg-red-50 px-4 py-2 text-red-700">Dat was fout. Probeer opnieuw!</p>}
              <Beantwoord key={String(status.fout)} vraag={v} onVerstuur={(a) => be.antwoord(sessie.id, nr, a)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Tabel({ raadsel, raster, onChange }: { raadsel: PubliekRaadsel; raster: string[][]; onChange?: (ci: number, k: number, waarde: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          {raadsel.kolomTitel && (
            <tr>
              <th />
              <th colSpan={raadsel.kolommen.length} className="pb-1 text-center font-normal text-slate-500">
                {raadsel.kolomTitel}
              </th>
            </tr>
          )}
          <tr>
            <th />
            {raadsel.kolommen.map((k, i) => (
              <th key={i} className="px-1 pb-1 text-center font-semibold">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {raadsel.categorieen.map((c, ci) => (
            <tr key={ci}>
              <th className="py-1 pr-2 font-semibold">{c.naam}</th>
              {raadsel.kolommen.map((_, k) => {
                const waarde = raster[ci]?.[k] ?? '';
                const elders = new Set(raster[ci]?.filter((w, j) => j !== k && w));
                return (
                  <td key={k} className="px-1 py-1">
                    {onChange ? (
                      <select
                        aria-label={`${c.naam} ${raadsel.kolommen[k]}`}
                        value={waarde}
                        onChange={(e) => onChange(ci, k, e.target.value)}
                        className={`w-full rounded-lg border px-2 py-1.5 ${waarde ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium' : 'border-slate-300 bg-surface text-slate-400'}`}
                      >
                        <option value="">…</option>
                        {c.opties.map((o) => (
                          <option key={o} value={o}>
                            {o}
                            {elders.has(o) ? ' (al gekozen)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="block rounded-lg bg-emerald-100 px-2 py-1.5 text-center font-medium text-emerald-900">{waarde}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Oplossen({
  be,
  sessie,
  raadsel,
  raster,
  setRaster,
  status,
}: {
  be: LiveBackend;
  sessie: LiveSessie;
  raadsel: PubliekRaadsel;
  raster: string[][];
  setRaster: (r: string[][]) => void;
  status: Status;
}) {
  const [fout, setFout] = useState<string | null>(null);
  const volledig = raster.every((rij) => rij.every(Boolean));

  async function controleer() {
    try {
      setFout(null);
      await be.antwoord(sessie.id, EINDCODE, rasterNaarTekst(raster));
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  return (
    <div className="rounded-2xl border-4 border-amber-300 bg-surface p-5 shadow-sm">
      <h2 className="mb-3 text-xl font-semibold">🕵️ Wie deed wat?</h2>
      <Tabel raadsel={raadsel} raster={raster} onChange={(ci, k, w) => setRaster(raster.map((rij, i) => (i === ci ? rij.map((x, j) => (j === k ? w : x)) : rij)))} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {status.soort === 'nakijken' ? (
          <span className="text-slate-500">Je oplossing wordt gecontroleerd…</span>
        ) : status.soort === 'wachten' ? (
          <span className="font-semibold text-red-600">Niet juist! Opnieuw controleren over {status.seconden} s.</span>
        ) : (
          <>
            <button
              type="button"
              disabled={!volledig}
              onClick={() => void controleer()}
              className="rounded-xl bg-amber-500 px-6 py-2 text-lg font-semibold text-white disabled:opacity-50"
            >
              Controleer mijn oplossing
            </button>
            {!volledig && <span className="text-sm text-slate-500">Vul eerst de hele tabel in.</span>}
            {status.fout && volledig && <span className="text-sm text-red-600">Je vorige oplossing klopte niet. Lees de roddels nog eens.</span>}
          </>
        )}
      </div>
      {fout && <p className="mt-2 text-red-600">{fout}</p>}
    </div>
  );
}
