import { useState } from 'react';
import { KAART_SOORTEN, lijstUitTekst, metOpgaven, opgaveVan, SOORT_NAMEN, themaProblemen, type KaartSoort } from '../live/cluedo';
import { RichText } from './RichText';
import type { CluedoThema } from '../lib/types';
import { inputClass, labelClass, Notice } from './ui';

/**
 * Verdachten, locaties en wapens van een Cluedo-spel: één naam per regel. Geef een andere `key` om
 * de tekstvakken opnieuw te vullen (bv. na "standaardthema").
 */
export function CluedoThemaEditor({ thema, onChange }: { thema: CluedoThema; onChange: (t: CluedoThema) => void }) {
  // De tekst zelf bijhouden: anders verdwijnt een lege regel terwijl je typt.
  const [tekst, setTekst] = useState(() => Object.fromEntries(KAART_SOORTEN.map((s) => [s, thema[s].join('\n')])) as Record<(typeof KAART_SOORTEN)[number], string>);
  const problemen = themaProblemen(thema);
  const [perKaart, setPerKaart] = useState(() => metOpgaven(thema));
  /** Opgaven per kaart: de lijsten even lang als de namen. */
  const opgaven = Object.fromEntries(KAART_SOORTEN.map((s) => [s, thema[s].map((_, i) => opgaveVan(thema, s, i))])) as NonNullable<CluedoThema['opgaven']>;
  const zetKaart = (s: KaartSoort, i: number, veld: 'naam' | 'opgave' | 'uitkomst', waarde: string) =>
    onChange(
      veld === 'naam'
        ? { ...thema, [s]: thema[s].map((n, j) => (j === i ? waarde : n)), opgaven }
        : { ...thema, opgaven: { ...opgaven, [s]: opgaven[s].map((o, j) => (j === i ? { ...o, [veld]: waarde } : o)) } },
    );
  return (
    <div className="space-y-3">
      <div className="max-w-md">
        <label className={labelClass} htmlFor="cluedo-titel">
          Titel van de zaak
        </label>
        <input id="cluedo-titel" className={inputClass} value={thema.titel} onChange={(e) => onChange({ ...thema, titel: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={perKaart}
          onChange={(e) => {
            setPerKaart(e.target.checked);
            onChange(e.target.checked ? { ...thema, opgaven } : { ...thema, opgaven: undefined });
          }}
        />
        Met een eigen opgave per kaart (bv. integralen): wie de uitkomst vindt, streept die kaart weg
      </label>
      {perKaart ? (
        <div className="space-y-5">
          {KAART_SOORTEN.map((s) => (
            <div key={s}>
              <div className="mb-1 flex items-center gap-3">
                <h4 className="font-semibold">
                  {SOORT_NAMEN[s].icoon} {SOORT_NAMEN[s].titel} ({thema[s].length})
                </h4>
                <button
                  type="button"
                  className="text-sm text-[var(--accent-tekst)] underline"
                  onClick={() => onChange({ ...thema, [s]: [...thema[s], ''], opgaven: { ...opgaven, [s]: [...opgaven[s], { opgave: '', uitkomst: '' }] } })}
                >
                  + kaart
                </button>
              </div>
              <div className="space-y-2">
                {thema[s].map((naam, i) => {
                  const op = opgaven[s][i];
                  return (
                    <div key={i} data-kaart className="grid items-start gap-2 rounded-xl border border-slate-200 p-2 lg:grid-cols-[12rem_1fr_1fr_auto]">
                      <input className={inputClass} aria-label={`${SOORT_NAMEN[s].titel} ${i + 1}: naam`} placeholder="Naam" value={naam} onChange={(e) => zetKaart(s, i, 'naam', e.target.value)} />
                      <div>
                        <input
                          className={`${inputClass} font-mono text-sm`}
                          aria-label={`${SOORT_NAMEN[s].titel} ${i + 1}: opgave`}
                          placeholder="Opgave, bv. $\int \frac{1}{x \ln x}\,dx$ (leeg = de oplossing)"
                          value={op.opgave}
                          onChange={(e) => zetKaart(s, i, 'opgave', e.target.value)}
                        />
                        {op.opgave.trim() ? <RichText text={op.opgave} className="mt-1 text-sm" /> : <span className="mt-1 inline-block rounded bg-amber-100 px-2 text-xs font-semibold text-amber-800">geen opgave: de oplossing</span>}
                      </div>
                      <div>
                        <input
                          className={`${inputClass} font-mono text-sm`}
                          aria-label={`${SOORT_NAMEN[s].titel} ${i + 1}: uitkomst`}
                          placeholder="Uitkomst in LaTeX, bv. \ln|\ln x|+C"
                          value={op.uitkomst}
                          onChange={(e) => zetKaart(s, i, 'uitkomst', e.target.value)}
                        />
                        {op.uitkomst.trim() && <RichText text={`$${op.uitkomst}$`} className="mt-1 text-sm" />}
                      </div>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`${SOORT_NAMEN[s].titel} ${i + 1} verwijderen`}
                        onClick={() => onChange({ ...thema, [s]: thema[s].filter((_, j) => j !== i), opgaven: { ...opgaven, [s]: opgaven[s].filter((_, j) => j !== i) } })}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-sm text-slate-500">
            Elke gelijkwaardige uitkomst is juist (de constante mag verschillen). Een kaart zonder opgave is de oplossing; heeft elke kaart een opgave, dan kiest de laptop bij elk spel
            zelf een oplossing.
          </p>
        </div>
      ) : (
      <div className="grid gap-3 sm:grid-cols-3">
        {KAART_SOORTEN.map((s) => (
          <div key={s}>
            <label className={labelClass} htmlFor={`cluedo-${s}`}>
              {SOORT_NAMEN[s].icoon} {SOORT_NAMEN[s].titel} ({thema[s].length})
            </label>
            <textarea
              id={`cluedo-${s}`}
              className={`${inputClass} h-48 font-normal`}
              value={tekst[s]}
              onChange={(e) => {
                setTekst((t) => ({ ...t, [s]: e.target.value }));
                onChange({ ...thema, [s]: lijstUitTekst(e.target.value) });
              }}
            />
          </div>
        ))}
      </div>
      )}
      {!perKaart && <p className="text-sm text-slate-500">
        Eén naam per regel, 2 tot 12 per kolom. Elk juist antwoord streept één kaart weg: met {thema.verdachten.length + thema.locaties.length + thema.wapens.length} kaarten zijn er{' '}
        {Math.max(0, thema.verdachten.length + thema.locaties.length + thema.wapens.length - 3)} juiste antwoorden nodig om alles weg te strepen.
      </p>}
      {problemen.length > 0 && <Notice tone="warn">{problemen.join(' ')}</Notice>}
    </div>
  );
}
