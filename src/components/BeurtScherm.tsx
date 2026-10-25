import { useEffect, useRef, useState, type ReactNode } from 'react';
import { juistAntwoord } from '../lib/questions';
import { aantalBeurten, kiesLeerling } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { RichText } from './RichText';

const LETTERS = 'ABCDEFGH';

export interface BeurtUitkomst {
  leerlingId: string | null;
  juist: boolean;
}

/**
 * Volledig scherm met één vraag voor het team dat aan de beurt is.
 * Sneltoetsen: spatie = antwoord tonen, J = juist, F = fout, W = willekeurige leerling, Esc = terug.
 */
export function BeurtScherm({
  sessie,
  team,
  vraag,
  punten,
  onKlaar,
  onAnnuleer,
}: {
  sessie: Sessie;
  team: number;
  vraag: Vraag;
  punten: number;
  onKlaar: (u: BeurtUitkomst) => void;
  onAnnuleer: () => void;
}) {
  const t = sessie.teams[team];
  const [leerlingId, setLeerlingId] = useState<string | null>(null);
  const [rollend, setRollend] = useState(false);
  const [getoond, setGetoond] = useState(false);
  const [gekozenOptie, setGekozenOptie] = useState<number | null>(null);
  const [resterend, setResterend] = useState(sessie.timer);
  const rolTimer = useRef<number | undefined>(undefined);

  const voorstel = vraag.type === 'meerkeuze' && gekozenOptie !== null ? gekozenOptie === vraag.juisteOptie : null;

  // Timer loopt tot het antwoord getoond wordt.
  useEffect(() => {
    if (resterend === null || resterend <= 0 || getoond) return;
    const id = window.setTimeout(() => setResterend((r) => (r === null ? r : r - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resterend, getoond]);

  useEffect(() => () => window.clearInterval(rolTimer.current), []);

  function willekeurig() {
    if (rollend || t.leerlingen.length === 0) return;
    const eind = kiesLeerling(sessie, team);
    setRollend(true);
    let n = 0;
    rolTimer.current = window.setInterval(() => {
      n++;
      if (n >= 12) {
        window.clearInterval(rolTimer.current);
        setLeerlingId(eind?.id ?? null);
        setRollend(false);
      } else {
        setLeerlingId(t.leerlingen[n % t.leerlingen.length].id);
      }
    }, 80);
  }

  const klaar = (juist: boolean) => !rollend && onKlaar({ leerlingId, juist });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') onAnnuleer();
      else if (k === ' ' && !getoond) {
        e.preventDefault();
        setGetoond(true);
      } else if (k === 'w') willekeurig();
      else if (getoond && k === 'j') klaar(true);
      else if (getoond && k === 'f') klaar(false);
      else if (getoond && k === 'enter' && voorstel !== null) klaar(voorstel);
      else if (!getoond && vraag.type === 'meerkeuze') {
        const i = LETTERS.toLowerCase().indexOf(k);
        if (i >= 0 && i < vraag.opties.length) kiesOptie(i);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function kiesOptie(i: number) {
    if (getoond) return;
    setGekozenOptie(i);
    setGetoond(true);
  }

  const tijdOp = resterend !== null && resterend <= 0 && !getoond;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      <div className="flex items-center gap-4 px-8 py-4 text-white" style={{ background: t.kleur }}>
        <span className="text-2xl font-bold">{t.naam}</span>
        <span className="text-lg opacity-90">
          {vraag.categorie && `${vraag.categorie} · `}
          {punten} {punten === 1 ? 'punt' : 'punten'}
        </span>
        {resterend !== null && (
          <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${tijdOp ? 'animate-pulse bg-white text-red-600' : 'bg-white/20'}`}>
            {tijdOp ? 'Tijd is om!' : `${Math.floor(Math.max(resterend, 0) / 60)}:${String(Math.max(resterend, 0) % 60).padStart(2, '0')}`}
          </span>
        )}
        <button type="button" onClick={onAnnuleer} className={`${resterend === null ? 'ml-auto' : ''} rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30`}>
          ← Terug (Esc)
        </button>
      </div>
      {sessie.timer !== null && resterend !== null && (
        <div className="h-2 bg-slate-200">
          <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${(Math.max(resterend, 0) / sessie.timer) * 100}%`, background: t.kleur }} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
          <RichText text={vraag.tekst} className="text-4xl leading-snug font-medium" />

          {vraag.type === 'meerkeuze' && (
            <div className="mt-8 grid grid-cols-2 gap-4">
              {vraag.opties.map((o, i) => {
                const isJuist = i === vraag.juisteOptie;
                const kleur = !getoond
                  ? 'border-slate-200 bg-white hover:border-slate-400'
                  : isJuist
                    ? 'border-emerald-500 bg-emerald-100'
                    : i === gekozenOptie
                      ? 'border-red-400 bg-red-100'
                      : 'border-slate-200 bg-white opacity-50';
                return (
                  <button key={i} type="button" onClick={() => kiesOptie(i)} className={`flex items-center gap-4 rounded-2xl border-2 px-6 py-5 text-left text-3xl transition ${kleur}`}>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-2xl font-bold text-white">{LETTERS[i]}</span>
                    <RichText text={o} />
                  </button>
                );
              })}
            </div>
          )}

          {getoond && (
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })} className="pop mt-8 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-6 py-5">
              <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Antwoord</div>
              <RichText text={juistAntwoord(vraag)} className="mt-1 text-3xl font-semibold" />
              {vraag.uitleg && <RichText text={vraag.uitleg} className="mt-3 text-xl text-slate-700" />}
            </div>
          )}

          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white px-10 py-4">
            {!getoond ? (
              <button type="button" onClick={() => setGetoond(true)} className="rounded-xl bg-slate-800 px-8 py-3 text-xl font-semibold text-white hover:bg-slate-700">
                Toon antwoord <span className="text-sm opacity-60">(spatie)</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => klaar(true)}
                  className={`rounded-xl bg-emerald-600 px-8 py-3 text-xl font-semibold text-white hover:bg-emerald-500 ${voorstel === true ? 'ring-4 ring-emerald-300' : ''}`}
                >
                  ✓ Juist <span className="text-sm opacity-70">(J)</span>
                </button>
                <button
                  type="button"
                  onClick={() => klaar(false)}
                  className={`rounded-xl bg-red-600 px-8 py-3 text-xl font-semibold text-white hover:bg-red-500 ${voorstel === false ? 'ring-4 ring-red-300' : ''}`}
                >
                  ✗ Fout <span className="text-sm opacity-70">(F)</span>
                </button>
                {voorstel !== null && <span className="text-slate-500">Enter = {voorstel ? 'juist' : 'fout'}</span>}
              </>
            )}
          </div>
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white px-5 py-6">
          <div className="mb-3 text-lg font-semibold">Wie antwoordt?</div>
          {t.leerlingen.length > 0 && (
            <button
              type="button"
              onClick={willekeurig}
              disabled={rollend}
              className="mb-4 w-full rounded-xl px-4 py-3 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-70"
              style={{ background: t.kleur }}
            >
              🎲 Willekeurig <span className="text-sm opacity-70">(W)</span>
            </button>
          )}
          <div className="space-y-1.5">
            <Kies actief={leerlingId === null} onClick={() => setLeerlingId(null)} kleur={t.kleur}>
              Hele team
            </Kies>
            {t.leerlingen.map((l) => (
              <Kies key={l.id} actief={leerlingId === l.id} onClick={() => setLeerlingId(l.id)} kleur={t.kleur}>
                <span>{l.naam}</span>
                <span className="text-xs opacity-60">{aantalBeurten(sessie, l.id)}×</span>
              </Kies>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Kies({ actief, onClick, kleur, children }: { actief: boolean; onClick: () => void; kleur: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-base transition ${actief ? 'font-semibold text-white' : 'border-transparent bg-slate-50 hover:bg-slate-100'}`}
      style={actief ? { background: kleur, borderColor: kleur } : undefined}
    >
      {children}
    </button>
  );
}
