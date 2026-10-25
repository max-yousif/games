import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useMemo, type ReactNode } from 'react';
import { splitsTekst } from '../lib/richText';
import { gatKleur, gatSymbool } from '../lib/vraagtypes';

/** Een gat in een invulvraag: gekleurd symbool (★, ●, ▲ ...). */
export function GatSymbool({ nr, groot = false }: { nr: number; groot?: boolean }) {
  return (
    <span
      className={`mx-[0.1em] inline-flex items-center justify-center rounded-md align-baseline leading-none font-bold text-white not-italic ${groot ? 'min-w-10 px-2 py-1.5 text-xl' : 'min-w-[2.2em] px-[0.4em] py-[0.1em]'}`}
      style={{ background: gatKleur(nr) }}
      title={`gat ${gatSymbool(nr)}`}
    >
      {gatSymbool(nr)}
    </span>
  );
}

/** Vervangt de merktekens ⟦1⟧, ⟦2⟧ ... in gewone tekst of code door gekleurde symbolen. */
function metGaten(tekst: string): ReactNode {
  const delen = tekst.split(/⟦(\d+)⟧/);
  if (delen.length === 1) return tekst;
  return delen.map((d, i) => (i % 2 === 1 ? <GatSymbool key={i} nr={Number(d) - 1} /> : d));
}

function Formule({ tex, blok }: { tex: string; blok: boolean }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: blok, throwOnError: false }), [tex, blok]);
  return blok ? <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Toont tekst met $formules$, `code` en ```codeblokken```; regeleindes blijven behouden. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const stukken = useMemo(() => splitsTekst(text), [text]);
  return (
    <div className={`rich-text ${className}`}>
      {stukken.map((s, i) => {
        if (s.soort === 'formule') return <Formule key={i} tex={s.tex} blok={s.blok} />;
        if (s.soort === 'code' && s.blok)
          return (
            <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 text-left font-mono text-[0.85em] leading-snug text-gray-100">
              <code>{metGaten(s.code)}</code>
            </pre>
          );
        if (s.soort === 'code')
          return (
            <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800">
              {metGaten(s.code)}
            </code>
          );
        return <Fragment key={i}>{metGaten(s.tekst)}</Fragment>;
      })}
    </div>
  );
}
