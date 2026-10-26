import { useEffect, useRef, useState } from 'react';
import { RichText } from '../components/RichText';
import { VraagWeergave } from '../components/VraagWeergave';
import { bomAntwoord, bomTijd, bomVragenOver, ontploffing } from '../lib/bom';
import { speel, useMuziek } from '../lib/geluid';
import { juistAntwoord } from '../lib/questions';
import { volgendeVraag } from '../lib/session';
import type { Sessie } from '../lib/types';
import { isKeuzeVraag, keuzeOpties, LETTERS } from '../lib/vraagtypes';

type Fase = 'klaar' | 'tikt' | 'pauze' | 'boem';

/**
 * Bom doorgeven op het bord. De verborgen tijd loopt enkel tijdens een ronde (niet bij pauze); hoe
 * dichter bij de ontploffing, hoe sneller de bom tikt.
 * Sneltoetsen: spatie = start / antwoord tonen, J = juist, F = fout, P = pauze, A-D = keuze.
 */
export function BomSpel({ sessie, onUpdate }: { sessie: Sessie; onUpdate: (s: Sessie) => void }) {
  // De bom is de muziek: geen achtergrondmuziek.
  useMuziek(null);
  const bom = sessie.bom!;
  const team = sessie.teams[bom.houder];
  const [fase, setFase] = useState<Fase>('klaar');
  const [getoond, setGetoond] = useState(false);
  const [gekozenOptie, setGekozenOptie] = useState<number | null>(null);
  const [uitkomst, setUitkomst] = useState<boolean | null>(null);
  // Het team dat getroffen werd bij de laatste ontploffing.
  const [geraakt, setGeraakt] = useState<string | null>(null);
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const vraag = volgendeVraag(sessie);
  const over = bomVragenOver(sessie);
  // Verborgen tijd: totaal en resterend (ms), enkel op deze laptop.
  const totaal = useRef(bomTijd(bom.tijd));
  const rest = useRef(totaal.current);
  const [deel, setDeel] = useState(1);
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;

  // Klok en tikken: van 1 tik per seconde naar 7 per seconde vlak voor de ontploffing.
  useEffect(() => {
    if (fase !== 'tikt') return;
    let vorige = Date.now();
    let volgendeTik = 0;
    const id = window.setInterval(() => {
      const nu = Date.now();
      rest.current -= nu - vorige;
      vorige = nu;
      if (rest.current <= 0) {
        window.clearInterval(id);
        setFase('boem');
        setGeraakt(sessieRef.current.teams[sessieRef.current.bom!.houder].naam);
        speel('boem');
        onUpdate(ontploffing(sessieRef.current));
        return;
      }
      setDeel(rest.current / totaal.current);
      if (nu >= volgendeTik) {
        speel('lont');
        volgendeTik = nu + 140 + (860 * rest.current) / totaal.current;
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [fase, onUpdate]);

  function nieuweRonde() {
    totaal.current = bomTijd(bom.tijd);
    rest.current = totaal.current;
    setDeel(1);
    setGetoond(false);
    setGekozenOptie(null);
    setUitkomst(null);
    setFase('tikt');
    speel('start');
  }

  function antwoord(juist: boolean) {
    if (!vraag || fase !== 'tikt' || uitkomst !== null) return;
    setUitkomst(juist);
    speel(juist ? 'juist' : 'fout');
    // Even tonen, dan de volgende vraag (bij juist voor het volgende team).
    window.setTimeout(() => {
      // Intussen ontploft? Dan telt het antwoord niet meer.
      if (faseRef.current === 'boem') return;
      onUpdate(bomAntwoord(sessieRef.current, vraag, juist));
      setGetoond(false);
      setGekozenOptie(null);
      setUitkomst(null);
    }, juist ? 900 : 1300);
  }

  function kiesOptie(i: number) {
    if (!vraag || fase !== 'tikt' || getoond) return;
    setGekozenOptie(i);
    setGetoond(true);
    antwoord(i === vraag.juisteOptie);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        if (fase === 'klaar' || fase === 'boem') nieuweRonde();
        else if (fase === 'tikt' && !getoond) setGetoond(true);
      } else if (k === 'p') setFase((f) => (f === 'tikt' ? 'pauze' : f === 'pauze' ? 'tikt' : f));
      else if (fase === 'tikt' && k === 'j') antwoord(true);
      else if (fase === 'tikt' && k === 'f') antwoord(false);
      else if (fase === 'tikt' && vraag && isKeuzeVraag(vraag) && !getoond) {
        const i = LETTERS.toLowerCase().indexOf(k);
        if (i >= 0 && i < keuzeOpties(vraag).length) kiesOptie(i);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });


  return (
    <div className="flex min-h-0 flex-1 gap-6 px-6 pb-6">
      <div className="flex min-w-0 flex-1 flex-col rounded-3xl bg-surface p-8 shadow-sm">
        <div className="flex items-center gap-5">
          <div
            className={`text-8xl ${fase === 'tikt' ? 'animate-pulse' : ''}`}
            style={fase === 'tikt' ? { animationDuration: `${0.25 + deel * 1.5}s` } : undefined}
            aria-hidden
          >
            💣
          </div>
          <div>
            <div className="text-lg text-slate-500">De bom ligt bij</div>
            <div className="text-5xl font-bold" style={{ color: team.kleur }}>
              {team.naam}
            </div>
          </div>
          {fase === 'tikt' && (
            <button type="button" onClick={() => setFase('pauze')} className="ml-auto rounded-xl bg-slate-100 px-4 py-2 text-lg hover:bg-slate-200">
              ⏸ Pauze <span className="text-sm opacity-60">(P)</span>
            </button>
          )}
        </div>

        {fase === 'klaar' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="max-w-xl text-xl text-slate-600">
              Beantwoord de vraag juist om de bom door te geven. Fout? Dan krijg je een nieuwe vraag, terwijl de bom verder tikt. Niemand weet wanneer ze ontploft… Het team met
              de minste ontploffingen wint, als alle vragen gesteld zijn.
            </p>
            <button type="button" onClick={nieuweRonde} className="mt-6 rounded-2xl bg-red-600 px-10 py-4 text-3xl font-bold text-white hover:bg-red-500">
              🔥 Steek de lont aan <span className="text-base opacity-70">(spatie)</span>
            </button>
          </div>
        )}

        {fase === 'pauze' && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="text-4xl font-bold">⏸ Gepauzeerd</div>
            <button type="button" onClick={() => setFase('tikt')} className="mt-6 rounded-2xl bg-[var(--accent)] px-8 py-3 text-2xl font-semibold text-white">
              ▶ Verder <span className="text-base opacity-70">(P)</span>
            </button>
          </div>
        )}

        {fase === 'boem' && (
          <div className="pop flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-9xl">💥</div>
            <div className="mt-2 text-5xl font-black text-red-600">BOEM!</div>
            {geraakt && <div className="mt-3 text-3xl font-semibold">De bom ontplofte bij {geraakt}!</div>}
            <div className="mt-2 text-xl text-slate-600">{team.naam} begint de volgende ronde.</div>
            <button type="button" onClick={nieuweRonde} className="mt-6 rounded-2xl bg-red-600 px-10 py-4 text-2xl font-bold text-white hover:bg-red-500">
              🔥 Volgende ronde <span className="text-base opacity-70">(spatie)</span>
            </button>
          </div>
        )}

        {fase === 'tikt' && vraag && (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <VraagWeergave vraag={vraag} groot getoond={getoond} gekozenOptie={gekozenOptie} onKiesOptie={isKeuzeVraag(vraag) ? kiesOptie : undefined} />
              {getoond && !isKeuzeVraag(vraag) && (
                <div className="pop mt-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-6 py-4">
                  <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Antwoord</div>
                  <RichText text={juistAntwoord(vraag)} className="mt-1 text-3xl font-semibold" />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {uitkomst !== null ? (
                <span className={`pop text-3xl font-bold ${uitkomst ? 'text-emerald-600' : 'text-red-600'}`}>
                  {uitkomst ? '✓ Juist! De bom gaat door…' : '✗ Fout! Nieuwe vraag…'}
                </span>
              ) : !getoond ? (
                <button type="button" onClick={() => setGetoond(true)} className="rounded-xl bg-gray-800 px-8 py-3 text-xl font-semibold text-white hover:bg-gray-700">
                  Toon antwoord <span className="text-sm opacity-60">(spatie)</span>
                </button>
              ) : (
                gekozenOptie === null && (
                  <>
                    <button type="button" onClick={() => antwoord(true)} className="rounded-xl bg-emerald-600 px-8 py-3 text-xl font-semibold text-white hover:bg-emerald-500">
                      ✓ Juist <span className="text-sm opacity-70">(J)</span>
                    </button>
                    <button type="button" onClick={() => antwoord(false)} className="rounded-xl bg-red-600 px-8 py-3 text-xl font-semibold text-white hover:bg-red-500">
                      ✗ Fout <span className="text-sm opacity-70">(F)</span>
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="w-72 shrink-0 space-y-3">
        <div className="rounded-2xl bg-surface px-4 py-3 text-center shadow-sm">
          <div className="text-sm text-slate-500">Nog te stellen</div>
          <div className="font-mono text-3xl font-bold">
            {over} <span className="text-base font-normal text-slate-500">van {sessie.vraagVolgorde.length} vragen</span>
          </div>
        </div>
        {sessie.teams.map((t, i) => {
          const n = bom.ontploffingen[i];
          return (
            <div
              key={i}
              className={`rounded-2xl border-4 bg-surface px-4 py-3 transition ${i === bom.houder ? 'scale-[1.03] shadow-lg' : ''}`}
              style={{ borderColor: i === bom.houder ? t.kleur : 'transparent' }}
            >
              <div className="truncate text-xl font-bold" style={{ color: t.kleur }}>
                {i === bom.houder && '💣 '}
                {t.naam}
              </div>
              <div className="mt-1 flex items-center justify-between text-lg">
                <span aria-label={`${n} keer ontploft`}>{n > 0 ? '💥'.repeat(Math.min(n, 8)) + (n > 8 ? ` ×${n}` : '') : <span className="text-slate-400">nog geen ontploffing</span>}</span>
                <span className="font-mono font-bold">{n}</span>
              </div>
            </div>
          );
        })}
        <p className="text-sm text-slate-500">Juist = bom naar het volgende team. Het spel stopt als alle vragen gesteld zijn; het team met de minste ontploffingen wint.</p>
      </aside>
    </div>
  );
}

