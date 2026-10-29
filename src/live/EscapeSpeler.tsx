import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { EINDCODE, slotVraag } from './escape';
import { Beantwoord, foutTekst } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';

export interface Status {
  soort: 'open' | 'nakijken' | 'wachten' | 'klaar';
  /** Wachten: resterende seconden. */
  seconden?: number;
  /** De vorige poging was fout. */
  fout?: boolean;
}

/** Laatste poging per slot. */
export function laatstePoging(antwoorden: readonly LiveAntwoord[], nr: number): LiveAntwoord | undefined {
  return antwoorden.filter((a) => a.vraagNr === nr).sort((a, b) => b.poging - a.poging)[0];
}

/** Escape room voor de leerling: sloten openen, cijfers verzamelen en de code ingeven. */
export function EscapeSpeler({
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
  /** Knop om na afloop aan een nieuw spel deel te nemen. */
  nieuwSpel: ReactNode;
}) {
  const vragen = sessie.vragen ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const terug = useCallback(() => setOpen(null), []);
  const [nu, setNu] = useState(() => Date.now());
  // Wanneer deze laptop een fout antwoord voor het eerst zag (voor het aftellen van de wachttijd).
  const foutGezien = useRef(new Map<string, number>());

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

  const cijfers = vragen.map((_, nr) => antwoorden.find((a) => a.vraagNr === nr && a.juist)?.beloning ?? null);
  const opgelost = cijfers.filter((c) => c !== null).length;
  const ontsnapt = antwoorden.find((a) => a.vraagNr === EINDCODE && a.juist);
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  /** Status van een slot of de eindcode. */
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
        <div className="text-6xl">{ontsnapt ? '🎉' : '🔒'}</div>
        <h1 className="mt-3 text-3xl font-bold">{ontsnapt ? `Ontsnapt in ${tijdTekst(ontsnapt.tijdMs)}!` : 'De tijd is om!'}</h1>
        <p className="mt-2 text-xl text-slate-600">
          Je opende {opgelost} van de {vragen.length} sloten{plaats > 0 && ` · plaats ${plaats}`}.
        </p>
        {nieuwSpel}
      </div>
    );
  }

  if (ontsnapt) {
    return (
      <div className="pop rounded-2xl bg-emerald-600 p-10 text-center text-white shadow-sm">
        <div className="text-7xl">🎉</div>
        <h1 className="mt-3 text-4xl font-bold">Je bent ontsnapt!</h1>
        <p className="mt-2 text-2xl">in {tijdTekst(ontsnapt.tijdMs)}</p>
        <p className="mt-4 text-lg opacity-90">Wacht tot de leerkracht de escape room afsluit.</p>
      </div>
    );
  }

  if (resterend !== null && resterend <= 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">⏰</div>
        <h1 className="mt-3 text-3xl font-bold">De tijd is om!</h1>
        <p className="mt-2 text-xl text-slate-600">
          Je opende {opgelost} van de {vragen.length} sloten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xl font-semibold">🗝️ {sessie.titel}</span>
        <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
          ⏱ {tijdTekst(resterend !== null ? resterend : verstreken)}
        </span>
      </div>

      <div className="rounded-2xl bg-gray-800 p-5 text-white shadow-sm">
        <div className="text-sm tracking-wide uppercase opacity-70">De geheime code</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {cijfers.map((c, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`flex h-16 w-14 items-center justify-center rounded-xl font-mono text-4xl font-bold ${c !== null ? 'pop bg-amber-400 text-slate-900' : 'bg-white/10 text-white/40'}`}>
                {c ?? '?'}
              </div>
              <div className="mt-1 text-xs opacity-60">slot {i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {open === null ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {vragen.map((_, nr) => {
              const v = vragen[slotVraag(spelerId ?? '', nr, vragen)];
              const st = status(nr);
              return (
                <button
                  key={nr}
                  type="button"
                  disabled={st.soort === 'klaar'}
                  onClick={() => setOpen(nr)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    st.soort === 'klaar' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-surface hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md'
                  }`}
                >
                  <div className="text-3xl">{st.soort === 'klaar' ? '🔓' : '🔒'}</div>
                  <div className="mt-1 text-lg font-semibold">Slot {nr + 1}</div>
                  {v.categorie && <div className="text-sm text-slate-500">{v.categorie}</div>}
                  <div className="mt-1 text-sm">
                    {st.soort === 'klaar' && <span className="text-emerald-700">open: cijfer {cijfers[nr]}</span>}
                    {st.soort === 'nakijken' && <span className="text-slate-500">wordt nagekeken…</span>}
                    {st.soort === 'wachten' && <span className="text-red-600">opnieuw over {st.seconden}s</span>}
                    {st.soort === 'open' && st.fout && <span className="text-red-600">fout, probeer opnieuw</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {opgelost === vragen.length && <Eindcode be={be} sessie={sessie} status={status(EINDCODE)} aantal={vragen.length} />}
        </>
      ) : (
        <Slot key={open} nr={open} spelerId={spelerId ?? ''} be={be} sessie={sessie} status={status(open)} cijfer={cijfers[open]} onTerug={terug} />
      )}
    </div>
  );
}

function Slot({ nr, spelerId, be, sessie, status, cijfer, onTerug }: { nr: number; spelerId: string; be: LiveBackend; sessie: LiveSessie; status: Status; cijfer: string | null; onTerug: () => void }) {
  const v = sessie.vragen![slotVraag(spelerId, nr, sessie.vragen!)];
  // Na een juist antwoord even het cijfer tonen en dan terug naar de sloten.
  useEffect(() => {
    if (status.soort !== 'klaar') return;
    const id = window.setTimeout(onTerug, 2500);
    return () => window.clearTimeout(id);
  }, [status.soort, onTerug]);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onTerug} className="text-slate-500 underline">
        ← Terug naar de sloten
      </button>
      <div className="rounded-2xl bg-surface p-6 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-slate-500">
          Slot {nr + 1}
          {v.categorie && ` · ${v.categorie}`}
        </div>
        <RichText text={v.tekst} className="text-2xl leading-snug font-medium" />
      </div>
      {status.soort === 'klaar' && (
        <div className="pop rounded-2xl bg-emerald-600 p-6 text-center text-white">
          <div className="text-5xl">🔓</div>
          <div className="mt-2 text-3xl font-bold">Slot open! Je cijfer: {cijfer}</div>
        </div>
      )}
      {status.soort === 'nakijken' && <div className="rounded-2xl bg-surface p-6 text-center text-xl text-slate-500">Wordt nagekeken…</div>}
      {status.soort === 'wachten' && (
        <div className="rounded-2xl bg-red-600 p-6 text-center text-white">
          <div className="text-4xl">✗</div>
          <div className="mt-1 text-2xl font-bold">Fout! Opnieuw proberen over {status.seconden} s</div>
          <div className="mt-1 opacity-90">Of probeer intussen een ander slot.</div>
        </div>
      )}
      {status.soort === 'open' && (
        <>
          {status.fout && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">Dat was fout. Probeer opnieuw!</p>}
          <Beantwoord key={String(status.fout)} vraag={v} zaad={`${spelerId}:${nr}`} onVerstuur={(a) => be.antwoord(sessie.id, nr, a)} />
        </>
      )}
    </div>
  );
}

function Eindcode({ be, sessie, status, aantal }: { be: LiveBackend; sessie: LiveSessie; status: Status; aantal: number }) {
  const [code, setCode] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  async function verstuur(e: FormEvent) {
    e.preventDefault();
    try {
      setFout(null);
      await be.antwoord(sessie.id, EINDCODE, code);
      setCode('');
    } catch (err) {
      setFout(foutTekst(err));
    }
  }
  return (
    <div className="pop rounded-2xl border-4 border-amber-400 bg-amber-50 p-6 text-center">
      <div className="text-5xl">🚪</div>
      <h2 className="mt-2 text-2xl font-bold">Alle sloten zijn open! Typ de code om te ontsnappen.</h2>
      {status.soort === 'nakijken' ? (
        <p className="mt-4 text-xl text-slate-500">Code wordt gecontroleerd…</p>
      ) : status.soort === 'wachten' ? (
        <p className="mt-4 text-xl font-semibold text-red-600">Verkeerde code! Opnieuw over {status.seconden} s.</p>
      ) : (
        <form className="mt-4 flex flex-wrap justify-center gap-3" onSubmit={verstuur}>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, aantal))}
            inputMode="numeric"
            aria-label="Code"
            placeholder={'•'.repeat(aantal)}
            className="w-64 rounded-xl border-2 border-slate-300 px-4 py-3 text-center font-mono text-4xl tracking-[0.3em] outline-none focus:border-amber-500"
          />
          <button type="submit" disabled={code.length !== aantal} className="rounded-xl bg-amber-500 px-8 py-3 text-xl font-semibold text-white disabled:opacity-50">
            Ontsnappen
          </button>
          {status.fout && <p className="w-full text-red-600">Die code was fout. Kijk goed naar de volgorde van de cijfers.</p>}
        </form>
      )}
      {fout && <p className="mt-3 text-red-600">{fout}</p>}
    </div>
  );
}
