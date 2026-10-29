import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { volgendeActieNr } from './codekraker';
import { escapeStaat, slotVraag, STRAF, type SlotKeuze } from './escape';
import { AntwoordTekst, Beantwoord, foutTekst } from './Invoer';
import { vastGeschud } from '../lib/vraagtypes';
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

/**
 * Escape room voor de leerling: elk antwoord geeft een cijfer (ook een fout antwoord, dan een
 * ander cijfer). Wie denkt alle cijfers te hebben, test de code; een foute code geeft straftijd.
 */
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
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  const ik = { id: spelerId ?? '', naam: '', bijnaam: null, verbonden: true };
  const st = escapeStaat(vragen, [ik], eigen, sessie.wachttijd)[0];
  const cijfers = vragen.map((_, nr) => st.cijfers.get(nr) ?? null);
  const ingevuld = cijfers.filter((c) => c !== null).length;
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;
  const straf = Math.max(0, Math.ceil((st.strafTot - verstreken) / 1000));
  // De laatste codepoging: nog niet nagekeken, of fout.
  const codes = eigen.filter((a) => a.antwoord.includes('"code"')).sort((a, b) => a.tijdMs - b.tijdMs);
  const laatsteCode = codes.at(-1);
  const codeBezig = laatsteCode?.juist === null;

  async function stuur(actie: object) {
    setFout(null);
    try {
      await be.antwoord(sessie.id, volgendeActieNr(eigen), JSON.stringify(actie));
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  if (sessie.status === 'einde' || (resterend !== null && resterend <= 0)) {
    const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">{st.ontsnaptMs !== null ? '🎉' : '🔒'}</div>
        <h1 className="mt-3 text-3xl font-bold">{st.ontsnaptMs !== null ? `Ontsnapt in ${tijdTekst(st.ontsnaptMs)}!` : 'De tijd is om!'}</h1>
        {st.ontsnaptMs !== null && plaats > 0 && <p className="mt-2 text-xl text-slate-600">Plaats {plaats}</p>}
        {sessie.status === 'einde' && nieuwSpel}
      </div>
    );
  }

  if (st.ontsnaptMs !== null) {
    return (
      <div className="pop rounded-2xl bg-emerald-600 p-10 text-center text-white shadow-sm">
        <div className="text-7xl">🎉</div>
        <h1 className="mt-3 text-4xl font-bold">Je bent ontsnapt!</h1>
        <p className="mt-2 text-2xl">in {tijdTekst(st.ontsnaptMs)}</p>
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
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-sm tracking-wide uppercase opacity-70">Jouw code</div>
            <div className="mt-2 flex flex-wrap gap-2" data-code>
              {cijfers.map((c, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`flex h-16 w-14 items-center justify-center rounded-xl font-mono text-4xl font-bold ${c !== null ? 'bg-amber-400 text-slate-900' : 'bg-white/10 text-white/40'}`}>
                    {c ?? '?'}
                  </div>
                  <div className="mt-1 text-xs opacity-60">slot {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-auto text-right">
            {straf > 0 ? (
              <div className="rounded-xl bg-red-600 px-5 py-3 text-xl font-bold">⛔ Straftijd: nog {straf} s</div>
            ) : codeBezig ? (
              <div className="px-5 py-3 text-xl opacity-80">Code wordt getest…</div>
            ) : (
              <button
                type="button"
                disabled={ingevuld < vragen.length}
                onClick={() => void stuur({ soort: 'code', code: cijfers.join('') })}
                className="rounded-xl bg-amber-400 px-6 py-3 text-xl font-bold text-slate-900 hover:brightness-105 disabled:opacity-40"
              >
                🔓 Test de code
              </button>
            )}
          </div>
        </div>
        {laatsteCode?.juist === false && laatsteCode.beloning !== STRAF && !codeBezig && (
          <p className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-lg">❌ Er zit nog ergens een fout in de code{st.fout > 1 ? ` (${st.fout} pogingen)` : ''}. Zoek ze!</p>
        )}
      </div>
      {fout && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{fout}</p>}

      {open === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {vragen.map((_, nr) => {
            const v = vragen[slotVraag(spelerId ?? '', nr, vragen)];
            return (
              <button
                key={nr}
                type="button"
                onClick={() => setOpen(nr)}
                className="rounded-2xl border-2 border-slate-200 bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Slot {nr + 1}</span>
                  <span className={`rounded-lg px-3 py-1 font-mono text-2xl font-bold ${cijfers[nr] !== null ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>{cijfers[nr] ?? '?'}</span>
                </div>
                {v.categorie && <div className="text-sm text-slate-500">{v.categorie}</div>}
              </button>
            );
          })}
        </div>
      ) : (
        <Slot
          key={open}
          nr={open}
          spelerId={spelerId ?? ''}
          sessie={sessie}
          keuze={st.keuzes.get(open) ?? null}
          bezig={st.bezig}
          straf={straf}
          onKies={(antwoord) => stuur({ soort: 'slot', slot: open, ...antwoord })}
          onTerug={terug}
        />
      )}
    </div>
  );
}

const OPTIE_KLEUREN = ['bg-red-500', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-600'];

function Slot({
  nr,
  spelerId,
  sessie,
  keuze,
  bezig,
  straf,
  onKies,
  onTerug,
}: {
  nr: number;
  spelerId: string;
  sessie: LiveSessie;
  keuze: SlotKeuze | null;
  bezig: boolean;
  straf: number;
  onKies: (antwoord: { keuze: number } | { antwoord: string }) => Promise<void>;
  onTerug: () => void;
}) {
  const v = sessie.vragen![slotVraag(spelerId, nr, sessie.vragen!)];
  // Na een keuze even laten zien en dan terug naar de sloten.
  const [gekozen, setGekozen] = useState(false);
  useEffect(() => {
    if (!gekozen || bezig) return;
    const id = window.setTimeout(onTerug, 1200);
    return () => window.clearTimeout(id);
  }, [gekozen, bezig, onTerug]);
  // Elke leerling ziet de antwoorden in een andere volgorde.
  const keuzevraag = v.type === 'meerkeuze' || v.type === 'waaronwaar';
  const volgorde = v.type === 'waaronwaar' ? [0, 1] : vastGeschud(v.opties.map((_, i) => i).filter((i) => v.opties[i]?.trim()), `${spelerId}:${nr}`);

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
      {straf > 0 && <p className="rounded-lg bg-red-50 px-4 py-3 font-semibold text-red-700">⛔ Straftijd: je kan pas over {straf} s weer antwoorden.</p>}
      {keuzevraag ? (
      <div className="grid gap-3 sm:grid-cols-2">
          {volgorde.map((i, plaats) => (
            <button
              key={i}
              type="button"
              disabled={straf > 0 || bezig}
              aria-pressed={keuze?.keuze === i}
              aria-label={v.opties[i]}
              onClick={() => {
                setGekozen(true);
                void onKies({ keuze: i });
              }}
              className={`flex min-h-20 items-center gap-4 rounded-2xl px-5 py-4 text-left text-2xl font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50 ${
                v.type === 'waaronwaar' ? (i === 0 ? 'bg-emerald-600' : 'bg-red-600') : OPTIE_KLEUREN[plaats % OPTIE_KLEUREN.length]
              } ${keuze?.keuze === i ? 'ring-4 ring-slate-900 ring-offset-2' : ''}`}
            >
              <span className="w-8 shrink-0 text-center text-2xl">{keuze?.keuze === i ? '✓' : ''}</span>
              <RichText text={v.opties[i]} className="[&_code]:bg-white/20 [&_code]:text-white" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {keuze?.antwoord !== undefined && (
            <p className="rounded-lg bg-slate-100 px-4 py-2 text-lg">
              Jouw antwoord: <AntwoordTekst vraag={v} antwoord={keuze.antwoord} />
            </p>
          )}
          {straf === 0 && !bezig && (
            <Beantwoord
              vraag={v}
              zaad={`${spelerId}:${nr}`}
              onVerstuur={async (antwoord) => {
                setGekozen(true);
                await onKies({ antwoord });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
