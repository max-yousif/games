import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useMemo } from 'react';
import { splitsTekst } from '../lib/richText';

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
            <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-left font-mono text-[0.85em] leading-snug text-slate-100">
              <code>{s.code}</code>
            </pre>
          );
        if (s.soort === 'code')
          return (
            <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800">
              {s.code}
            </code>
          );
        return <Fragment key={i}>{s.tekst}</Fragment>;
      })}
    </div>
  );
}
