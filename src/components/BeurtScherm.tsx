import { useEffect, useRef, useState, type ReactNode } from 'react';
import { juistAntwoord } from '../lib/questions';
import { aantalBeurten, kiesLeerling, korteNamenVan } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { isKeuzeVraag, keuzeOpties, LETTERS } from '../lib/vraagtypes';
import { RichText } from './RichText';
import { VraagWeergave } from './VraagWeergave';

export interface BeurtUitkomst {
  leerlingId: string | null;
  juist: boolean;
}

/**
 * Volledig scherm met één vraag voor het team dat aan de beurt is. De vraag verschijnt pas wanneer
 * gekozen is wie antwoordt (een leerling, willekeurig of het hele team). Met dubbel krijgt een
 * leerling die alleen antwoordt (zonder overleggen) dubbele punten.
 * Sneltoetsen: W = willekeurige leerling, T = hele team, spatie = antwoord tonen, J = juist, F = fout, Esc = terug.
 */
export function BeurtScherm({
  sessie,
  team,
  vraag,
  punten,
  dubbel = false,
  onKlaar,
  onAnnuleer,
}: {
  sessie: Sessie;
  team: number;
  vraag: Vraag;
  punten: number;
  /** Dubbele punten als één leerling alleen antwoordt. */
  dubbel?: boolean;
  onKlaar: (u: BeurtUitkomst) => void;
  onAnnuleer: () => void;
}) {
  const t = sessie.teams[team];
  const [leerlingId, setLeerlingId] = useState<string | null>(null);
  // Is gekozen wie antwoordt? Zonder namen antwoordt altijd het hele team.
  const [gekozen, setGekozen] = useState(t.leerlingen.length === 0);
  // Willekeurig gekozen: de naam even groot tonen.
  const [inBeeld, setInBeeld] = useState<string | null>(null);
  const [rollend, setRollend] = useState(false);
  const [getoond, setGetoond] = useState(false);
  const [gekozenOptie, setGekozenOptie] = useState<number | null>(null);
  const [resterend, setResterend] = useState(sessie.timer);
  const rolTimer = useRef<number | undefined>(undefined);

  const voorstel = isKeuzeVraag(vraag) && gekozenOptie !== null ? gekozenOptie === vraag.juisteOptie : null;

  const individueel = gekozen && leerlingId !== null;
  const kort = korteNamenVan(sessie);
  const naam = (id: string | null) => (id ? (kort.get(id) ?? '') : '');

  // Timer loopt vanaf het moment dat de vraag verschijnt tot het antwoord getoond wordt.
  useEffect(() => {
    if (!gekozen || inBeeld || resterend === null || resterend <= 0 || getoond) return;
    const id = window.setTimeout(() => setResterend((r) => (r === null ? r : r - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resterend, getoond, gekozen, inBeeld]);

  useEffect(() => () => window.clearInterval(rolTimer.current), []);

  // De grote naam verdwijnt snel weer.
  useEffect(() => {
    if (!inBeeld) return;
    const id = window.setTimeout(() => setInBeeld(null), 1400);
    return () => window.clearTimeout(id);
  }, [inBeeld]);

  function kies(id: string | null) {
    if (rollend) return;
    setLeerlingId(id);
    setGekozen(true);
  }

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
        setGekozen(true);
        setInBeeld(eind ? naam(eind.id) : null);
      } else {
        setLeerlingId(t.leerlingen[n % t.leerlingen.length].id);
      }
    }, 80);
  }

  const klaar = (juist: boolean) => !rollend && gekozen && onKlaar({ leerlingId, juist });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') onAnnuleer();
      else if (k === 'w') willekeurig();
      else if (!gekozen || inBeeld) {
        if (k === 't') kies(null);
      } else if (k === ' ' && !getoond) {
        e.preventDefault();
        setGetoond(true);
      } else if (getoond && k === 'j') klaar(true);
      else if (getoond && k === 'f') klaar(false);
      else if (getoond && k === 'enter' && voorstel !== null) klaar(voorstel);
      else if (!getoond && isKeuzeVraag(vraag)) {
        const i = LETTERS.toLowerCase().indexOf(k);
        if (i >= 0 && i < keuzeOpties(vraag).length) kiesOptie(i);
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
          {individueel && dubbel ? (
            <>
              <s className="opacity-70">{punten}</s> <strong>{punten * 2} punten</strong>
            </>
          ) : (
            <>
              {punten} {punten === 1 ? 'punt' : 'punten'}
            </>
          )}
        </span>
        {gekozen && t.leerlingen.length > 0 && (
          <span className="rounded-full bg-white/20 px-3 py-1 text-lg font-semibold">
            {individueel ? `🙋 ${naam(leerlingId)}${dubbel ? ' · alleen, zonder overleggen: ×2' : ''}` : '👥 Hele team'}
          </span>
        )}
        {resterend !== null && (
          <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${tijdOp ? 'animate-pulse bg-surface text-red-600' : 'bg-white/20'}`}>
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
          <div className="relative min-h-0 flex-1 overflow-y-auto px-10 py-8">
          {inBeeld && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
              <div className="pop text-center">
                <div className="text-3xl text-slate-500">🎲 Deze vraag is voor</div>
                <div className="mt-2 text-8xl font-bold" style={{ color: t.kleur }}>
                  {inBeeld}
                </div>
              </div>
            </div>
          )}
          {!gekozen ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-5xl">{rollend ? '🎲' : '🙋'}</div>
              <h2 className="mt-3 text-4xl font-bold">{rollend ? naam(leerlingId) || '…' : 'Wie beantwoordt deze vraag?'}</h2>
              {!rollend && (
                <>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={willekeurig} className="rounded-xl px-8 py-4 text-2xl font-semibold text-white hover:brightness-110" style={{ background: t.kleur }}>
                      🎲 Willekeurig <span className="text-base opacity-70">(W)</span>
                    </button>
                    <button type="button" onClick={() => kies(null)} className="rounded-xl border-2 bg-surface px-8 py-4 text-2xl font-semibold hover:bg-slate-50" style={{ borderColor: t.kleur }}>
                      👥 Hele team <span className="text-base opacity-60">(T)</span>
                    </button>
                  </div>
                  <p className="mt-4 text-lg text-slate-500">
                    Of kies rechts een leerling.{dubbel && ' Wie alleen antwoordt, zonder te overleggen, verdient dubbele punten.'}
                  </p>
                </>
              )}
            </div>
          ) : (
          <VraagWeergave vraag={vraag} groot getoond={getoond} gekozenOptie={gekozenOptie} onKiesOptie={isKeuzeVraag(vraag) ? kiesOptie : undefined} />
          )}

          {getoond && (
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })} className="pop mt-8 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-6 py-5">
              <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Antwoord</div>
              <RichText text={juistAntwoord(vraag)} className="mt-1 text-3xl font-semibold" />
              {vraag.uitleg && <RichText text={vraag.uitleg} className="mt-3 text-xl text-slate-700" />}
            </div>
          )}

          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-surface px-10 py-4">
            {!gekozen || inBeeld ? (
              <span className="py-3 text-lg text-slate-500">De vraag verschijnt zodra gekozen is wie antwoordt.</span>
            ) : !getoond ? (
              <button type="button" onClick={() => setGetoond(true)} className="rounded-xl bg-gray-800 px-8 py-3 text-xl font-semibold text-white hover:bg-gray-700">
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

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-surface px-5 py-6">
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
            <Kies actief={gekozen && leerlingId === null} onClick={() => kies(null)} kleur={t.kleur}>
              Hele team
            </Kies>
            {t.leerlingen.map((l) => (
              <Kies key={l.id} actief={(gekozen || rollend) && leerlingId === l.id} onClick={() => kies(l.id)} kleur={t.kleur}>
                <span>{naam(l.id)}</span>
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
