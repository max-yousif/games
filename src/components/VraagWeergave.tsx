import type { Vraag } from '../lib/types';
import { isKeuzeVraag, keuzeOpties, koppelenRechts, LETTERS, ordenenGetoond, tekstMetGaten } from '../lib/vraagtypes';
import { RichText } from './RichText';

/**
 * Toont een vraag zoals op het bord: tekst (met genummerde gaten bij invullen), opties,
 * te ordenen items of de twee kolommen om te koppelen. Na `getoond` kleurt het juiste antwoord
 * en verschijnt bij ordenen/koppelen de oplossing in letters (bv. "C – A – B").
 */
export function VraagWeergave({
  vraag: v,
  groot = false,
  getoond = false,
  gekozenOptie = null,
  onKiesOptie,
}: {
  vraag: Vraag;
  groot?: boolean;
  getoond?: boolean;
  gekozenOptie?: number | null;
  onKiesOptie?: (i: number) => void;
}) {
  const tekst = v.type === 'invullen' ? tekstMetGaten(v.tekst) : v.tekst;
  const itemTekst = groot ? 'text-3xl' : 'text-base';

  return (
    <div>
      <RichText text={tekst} className={groot ? 'text-4xl leading-snug font-medium' : 'text-lg'} />

      {isKeuzeVraag(v) && (
        <div className={`grid ${groot ? 'gap-4' : 'gap-2'} ${groot ? 'mt-8' : 'mt-3'} ${groot || v.type === 'waaronwaar' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {keuzeOpties(v).map((o, i) => {
            if (!o.trim()) return null;
            const isJuist = i === v.juisteOptie;
            const kleur = !getoond
              ? 'border-slate-200 bg-white' + (onKiesOptie ? ' hover:border-slate-400' : '')
              : isJuist
                ? 'border-emerald-500 bg-emerald-100'
                : i === gekozenOptie
                  ? 'border-red-400 bg-red-100'
                  : 'border-slate-200 bg-white opacity-50';
            const inhoud = (
              <>
                <span className={`flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white ${groot ? 'h-12 w-12 text-2xl' : 'h-7 w-7 text-sm'}`}>
                  {LETTERS[i]}
                </span>
                <RichText text={o} />
              </>
            );
            const klasse = `flex items-center ${groot ? 'gap-4' : 'gap-2'} rounded-2xl border-2 text-left transition ${groot ? 'px-6 py-5' : 'px-3 py-1.5'} ${itemTekst} ${kleur}`;
            return onKiesOptie ? (
              <button key={i} type="button" onClick={() => onKiesOptie(i)} className={klasse}>
                {inhoud}
              </button>
            ) : (
              <div key={i} className={klasse}>
                {inhoud}
              </div>
            );
          })}
        </div>
      )}

      {v.type === 'ordenen' && <Ordenen vraag={v} groot={groot} getoond={getoond} />}
      {v.type === 'koppelen' && <Koppelen vraag={v} groot={groot} getoond={getoond} />}
    </div>
  );
}

function Item({ tekst, code, groot }: { tekst: string; code?: boolean; groot: boolean }) {
  return code ? (
    <pre className={`overflow-x-auto font-mono whitespace-pre ${groot ? 'text-2xl' : 'text-sm'}`}>{tekst}</pre>
  ) : (
    <RichText text={tekst} className={groot ? 'text-2xl' : 'text-base'} />
  );
}

function Letter({ l, groot, kleur = 'bg-slate-800' }: { l: string; groot: boolean; kleur?: string }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${kleur} ${groot ? 'h-10 w-10 text-xl' : 'h-7 w-7 text-sm'}`}>{l}</span>;
}

function Ordenen({ vraag: v, groot, getoond }: { vraag: Vraag; groot: boolean; getoond: boolean }) {
  const getoondeItems = ordenenGetoond(v);
  // Letter van elk item in de juiste volgorde (dubbele items krijgen elk hun eigen letter).
  const gebruikt = new Set<number>();
  const oplossing = v.opties.map((o) => {
    const i = getoondeItems.findIndex((x, j) => x === o && !gebruikt.has(j));
    gebruikt.add(i);
    return LETTERS[i];
  });
  return (
    <div className={groot ? 'mt-6' : 'mt-3'}>
      <ul className={`${groot ? 'space-y-3' : 'space-y-1.5'}`}>
        {getoondeItems.map((o, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white ${groot ? 'px-5 py-3' : 'px-3 py-1.5'}`}>
            <Letter l={LETTERS[i]} groot={groot} />
            <Item tekst={o} code={v.alsCode} groot={groot} />
          </li>
        ))}
      </ul>
      {getoond && (
        <div className={`pop mt-4 font-semibold text-emerald-700 ${groot ? 'text-3xl' : 'text-base'}`}>Juiste volgorde: {oplossing.join(' – ')}</div>
      )}
    </div>
  );
}

function Koppelen({ vraag: v, groot, getoond }: { vraag: Vraag; groot: boolean; getoond: boolean }) {
  const paren = v.paren ?? [];
  const rechts = koppelenRechts(v);
  const gebruikt = new Set<number>();
  const letterVan = paren.map(([, r]) => {
    const i = rechts.findIndex((x, j) => x === r && !gebruikt.has(j));
    gebruikt.add(i);
    return LETTERS[i];
  });
  return (
    <div className={`grid grid-cols-2 ${groot ? 'gap-8' : 'gap-3'} ${groot ? 'mt-6' : 'mt-3'}`}>
      <ul className={`${groot ? 'space-y-3' : 'space-y-1.5'}`}>
        {paren.map(([l], i) => (
          <li key={i} className={`flex items-center gap-3 rounded-xl border-2 bg-white ${getoond ? 'border-emerald-400' : 'border-slate-200'} ${groot ? 'px-5 py-3' : 'px-3 py-1.5'}`}>
            <Letter l={String(i + 1)} groot={groot} kleur="bg-[var(--accent)]" />
            <div className="flex-1">
              <Item tekst={l} groot={groot} />
            </div>
            {getoond && <Letter l={letterVan[i]} groot={groot} kleur="bg-emerald-600" />}
          </li>
        ))}
      </ul>
      <ul className={`${groot ? 'space-y-3' : 'space-y-1.5'}`}>
        {rechts.map((r, i) => (
          <li key={i} className={`flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white ${groot ? 'px-5 py-3' : 'px-3 py-1.5'}`}>
            <Letter l={LETTERS[i]} groot={groot} />
            <Item tekst={r} groot={groot} />
          </li>
        ))}
      </ul>
    </div>
  );
}
