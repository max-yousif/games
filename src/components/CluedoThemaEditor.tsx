import { useState } from 'react';
import { KAART_SOORTEN, lijstUitTekst, SOORT_NAMEN, themaProblemen } from '../live/cluedo';
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
  return (
    <div className="space-y-3">
      <div className="max-w-md">
        <label className={labelClass} htmlFor="cluedo-titel">
          Titel van de zaak
        </label>
        <input id="cluedo-titel" className={inputClass} value={thema.titel} onChange={(e) => onChange({ ...thema, titel: e.target.value })} />
      </div>
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
      <p className="text-sm text-slate-500">
        Eén naam per regel, 2 tot 12 per kolom. Elk juist antwoord streept één kaart weg: met {thema.verdachten.length + thema.locaties.length + thema.wapens.length} kaarten zijn er{' '}
        {Math.max(0, thema.verdachten.length + thema.locaties.length + thema.wapens.length - 3)} juiste antwoorden nodig om alles weg te strepen.
      </p>
      {problemen.length > 0 && <Notice tone="warn">{problemen.join(' ')}</Notice>}
    </div>
  );
}
