import type { Vraag } from '../lib/types';
import { gatenVan, LETTERS, WAAR_ONWAAR } from '../lib/vraagtypes';
import { GatSymbool } from './RichText';
import { Button, inputClass, labelClass } from './ui';

type Wijzig = (f: (v: Vraag) => Vraag) => void;

/** De invulvelden voor het antwoord, afhankelijk van het type vraag. */
export function AntwoordVelden({ vraag: v, onChange }: { vraag: Vraag; onChange: Wijzig }) {
  switch (v.type) {
    case 'open': {
      const extra = v.alternatieven ?? [];
      const zetExtra = (lijst: string[]) => onChange((x) => ({ ...x, alternatieven: lijst }));
      return (
        <div>
          <label className={labelClass}>Antwoord</label>
          <input className={`${inputClass} font-mono`} value={v.antwoord} onChange={(e) => onChange((x) => ({ ...x, antwoord: e.target.value }))} />
          {extra.map((a, i) => (
            <div key={i} className="mt-2 flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium text-slate-500">ook juist</span>
              <input
                className={`${inputClass} font-mono`}
                value={a}
                autoFocus={a === ''}
                onChange={(e) => zetExtra(extra.map((y, j) => (j === i ? e.target.value : y)))}
              />
              <button
                type="button"
                className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Dit juiste antwoord verwijderen"
                onClick={() => zetExtra(extra.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <Button variant="ghost" className="mt-1" onClick={() => zetExtra([...extra, ''])}>
            + ook juist
          </Button>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.gelijkwaardig ?? false} onChange={(e) => onChange((x) => ({ ...x, gelijkwaardig: e.target.checked || undefined }))} />
            Elke gelijkwaardige uitdrukking is juist (bv. bij integralen: <code>Bgtan(ln x)+C</code> = <code>arctan(ln(x))</code>)
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Voeg andere schrijfwijzen toe die ook juist zijn (bv. <code>x=6</code> en <code>6</code>, of <code>dalparabool</code> en <code>parabool met top onderaan</code>). Bij een live quiz
            wordt automatisch nagekeken (spaties, hoofdletters en $…$ maken niet uit); jij kan afwijkende antwoorden nog goedkeuren.
          </p>
        </div>
      );
    }
    case 'getal':
      return (
        <div className="flex flex-wrap gap-3">
          <div className="w-48">
            <label className={labelClass}>Juiste getal</label>
            <input className={`${inputClass} font-mono`} inputMode="decimal" placeholder="bv. 12,5 of 3/4" value={v.antwoord} onChange={(e) => onChange((x) => ({ ...x, antwoord: e.target.value }))} />
          </div>
          <div className="w-48">
            <label className={labelClass}>Foutmarge (±)</label>
            <input
              className={`${inputClass} font-mono`}
              inputMode="decimal"
              placeholder="0"
              value={v.tolerantie ? String(v.tolerantie).replace('.', ',') : ''}
              onChange={(e) => onChange((x) => ({ ...x, tolerantie: Math.abs(Number(e.target.value.replace(',', '.'))) || 0 }))}
            />
          </div>
          <p className="w-full text-xs text-slate-500">Leerlingen mogen een komma of punt gebruiken, een breuk (3/4) of “x = …”. Met foutmarge 0,1 is 12,4 tot 12,6 juist.</p>
        </div>
      );
    case 'waaronwaar':
      return (
        <div>
          <label className={labelClass}>De stelling is…</label>
          <div className="flex gap-2">
            {WAAR_ONWAAR.map((w, i) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange((x) => ({ ...x, juisteOptie: i }))}
                className={`rounded-lg border-2 px-5 py-2 font-medium ${v.juisteOptie === i ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      );
    case 'meerkeuze':
      return <MeerkeuzeVelden vraag={v} onChange={onChange} />;
    case 'invullen': {
      const gaten = gatenVan(v.tekst);
      return (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <p>
            Zet in de vraag elk te vullen stuk tussen dubbele vierkante haken: <code>{'De afgeleide van $x^2$ is [[2x]].'}</code> Meerdere juiste antwoorden scheid je met{' '}
            <code>|</code>, bv. <code>{'[[0,5|1/2]]'}</code>. Gaten mogen ook in Python-code staan, niet binnen een formule <code>$…$</code>.
          </p>
          {gaten.length > 0 && (
            <ul className="mt-2 space-y-1">
              {gaten.map((g, i) => (
                <li key={i} className="flex items-center gap-2">
                  <GatSymbool nr={i} />
                  <span className="font-mono">{g.join('  of  ') || '(leeg)'}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2">Leerlingen zien elk gat als een gekleurd symbool (★, ●, ▲ …), niet als een cijfer.</p>
        </div>
      );
    }
    case 'ordenen':
      return (
        <div>
          <label className={labelClass}>Items in de juiste volgorde (één per lijn)</label>
          <textarea
            className={`${inputClass} font-mono`}
            rows={Math.min(14, Math.max(4, v.opties.length + 1))}
            value={v.opties.join('\n')}
            onChange={(e) => onChange((x) => ({ ...x, opties: e.target.value.split('\n') }))}
            placeholder={'getal = int(input("Getal? "))\nif getal % 2 == 0:\n    print("even")\nelse:\n    print("oneven")'}
          />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.alsCode ?? false} onChange={(e) => onChange((x) => ({ ...x, alsCode: e.target.checked }))} />
            Toon als code (inspringing blijft zichtbaar, handig voor Python)
          </label>
          <p className="mt-1 text-xs text-slate-500">De leerlingen zien de items door elkaar.</p>
        </div>
      );
    case 'koppelen': {
      const paren = v.paren ?? [];
      const zet = (i: number, kant: 0 | 1, waarde: string) =>
        onChange((x) => ({ ...x, paren: (x.paren ?? []).map((p, j) => (j === i ? ((kant === 0 ? [waarde, p[1]] : [p[0], waarde]) as [string, string]) : p)) }));
      return (
        <div>
          <label className={labelClass}>Paren (links hoort bij rechts)</label>
          <div className="space-y-2">
            {paren.map(([l, r], i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-sm font-bold text-slate-500">{i + 1}</span>
                <input className={`${inputClass} font-mono`} value={l} placeholder="bv. $f(x)=x^2$" onChange={(e) => zet(i, 0, e.target.value)} />
                <span className="text-slate-400">↔</span>
                <input className={`${inputClass} font-mono`} value={r} placeholder="bv. dalparabool" onChange={(e) => zet(i, 1, e.target.value)} />
                <button
                  type="button"
                  className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Paar ${i + 1} verwijderen`}
                  onClick={() => onChange((x) => ({ ...x, paren: (x.paren ?? []).filter((_, j) => j !== i) }))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {paren.length < LETTERS.length && (
            <Button variant="ghost" className="mt-2" onClick={() => onChange((x) => ({ ...x, paren: [...(x.paren ?? []), ['', '']] }))}>
              + paar
            </Button>
          )}
          <p className="mt-1 text-xs text-slate-500">De rechterkolom wordt door elkaar getoond.</p>
        </div>
      );
    }
  }
}

function MeerkeuzeVelden({ vraag: v, onChange }: { vraag: Vraag; onChange: Wijzig }) {
  return (
    <div>
      <label className={labelClass}>Opties (duid het juiste antwoord aan)</label>
      <div className="space-y-2">
        {v.opties.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input
              type="radio"
              name={`juist-${v.id}`}
              checked={v.juisteOptie === oi}
              onChange={() => onChange((x) => ({ ...x, juisteOptie: oi }))}
              className="h-4 w-4 accent-emerald-600"
              title="Juiste antwoord"
            />
            <span className="w-5 text-sm font-bold text-slate-500">{LETTERS[oi]}</span>
            <input
              className={`${inputClass} font-mono ${v.juisteOptie === oi ? 'border-emerald-400 bg-emerald-50' : ''}`}
              value={o}
              onChange={(e) => onChange((x) => ({ ...x, opties: x.opties.map((y, yi) => (yi === oi ? e.target.value : y)) }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {v.opties.length < 8 && (
          <Button variant="ghost" onClick={() => onChange((x) => ({ ...x, opties: [...x.opties, ''] }))}>
            + optie
          </Button>
        )}
        {v.opties.length > 2 && (
          <Button variant="ghost" onClick={() => onChange((x) => ({ ...x, opties: x.opties.slice(0, -1), juisteOptie: Math.min(x.juisteOptie, x.opties.length - 2) }))}>
            − optie
          </Button>
        )}
      </div>
    </div>
  );
}
