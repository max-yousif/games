import { KAART_SOORTEN, kaartenUitVragen, nodigeVragen, SOORT_NAMEN, themaProblemen, type KaartSoort } from '../live/cluedo';
import type { CluedoOplossing, CluedoThema, Vraag } from '../lib/types';
import { inputClass, labelClass, Notice } from './ui';

const OPLOSSING_VELD: Record<KaartSoort, keyof CluedoOplossing> = { verdachten: 'verdachte', locaties: 'locatie', wapens: 'wapen' };
const ENKELVOUD: Record<KaartSoort, string> = { verdachten: 'verdachte', locaties: 'locatie', wapens: 'wapen' };

/**
 * De kaarten van een Cluedo-spel: per soort de namen, en welke de oplossing is (anders kiest de
 * laptop). Met "elke kaart een vraag" krijgt bij de start elke kaart behalve de oplossing een eigen
 * vraag uit de set.
 */
export function CluedoThemaEditor({
  thema,
  vragen = [],
  setTitel,
  onChange,
}: {
  thema: CluedoThema;
  vragen?: readonly Vraag[];
  /** Titel van de vragenset: de titel van de zaak als de kaarten uit de set komen. */
  setTitel?: string;
  onChange: (t: CluedoThema) => void;
}) {
  const problemen = themaProblemen(thema);
  const metVragen = !!thema.metVragen;
  // Namen uit de vragenset: in de uitleg van een vraag staat "Wie? Naam", "Hoe? ..." of "Waar? ...".
  const uitSet = kaartenUitVragen(setTitel || thema.titel, vragen);
  const nodig = nodigeVragen(thema);
  const oplossingVan = (s: KaartSoort) => thema.oplossing?.[OPLOSSING_VELD[s]];
  /** Nieuwe namen voor een soort; de aanduiding als oplossing volgt de naam. */
  const zet = (s: KaartSoort, namen: string[], hernoemd?: [string, string]) => {
    const opl = oplossingVan(s);
    const nieuweOpl = hernoemd && opl === hernoemd[0] ? hernoemd[1] : opl && namen.includes(opl) ? opl : undefined;
    onChange({ ...thema, [s]: namen, oplossing: { ...thema.oplossing, [OPLOSSING_VELD[s]]: nieuweOpl } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-md flex-1">
          <label className={labelClass} htmlFor="cluedo-titel">
            Titel van de zaak
          </label>
          <input id="cluedo-titel" className={inputClass} value={thema.titel} onChange={(e) => onChange({ ...thema, titel: e.target.value })} />
        </div>
        {uitSet && (
          <button
            type="button"
            className="rounded-lg border border-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-tekst)] hover:bg-[var(--accent-soft)]"
            onClick={() =>
              onChange({ ...thema, titel: uitSet.titel, verdachten: uitSet.verdachten.filter(Boolean), locaties: uitSet.locaties.filter(Boolean), wapens: uitSet.wapens.filter(Boolean), metVragen: true, opgaven: undefined })
            }
          >
            📥 Namen uit de vragenset (uitleg “Wie?/Hoe?/Waar? …”)
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {KAART_SOORTEN.map((s) => (
          <div key={s}>
            <div className="mb-1 font-semibold">
              {SOORT_NAMEN[s].icoon} {SOORT_NAMEN[s].titel} ({thema[s].length})
            </div>
            <div className="space-y-1.5">
              {thema[s].map((naam, i) => {
                const isOplossing = !!naam && oplossingVan(s) === naam;
                return (
                  <div key={i} data-kaart className={`flex items-center gap-1.5 rounded-lg p-0.5 ${isOplossing ? 'bg-amber-100 ring-2 ring-amber-400' : ''}`}>
                    <input
                      type="radio"
                      name={`oplossing-${s}`}
                      className="ml-1"
                      checked={isOplossing}
                      disabled={!naam.trim()}
                      title="Dit is de oplossing"
                      aria-label={`${naam || `${SOORT_NAMEN[s].titel} ${i + 1}`} is de oplossing`}
                      onChange={() => onChange({ ...thema, oplossing: { ...thema.oplossing, [OPLOSSING_VELD[s]]: naam } })}
                    />
                    <input
                      className={`${inputClass} py-1.5`}
                      aria-label={`${SOORT_NAMEN[s].titel} ${i + 1}: naam`}
                      placeholder="Naam"
                      value={naam}
                      onChange={(e) =>
                        zet(
                          s,
                          thema[s].map((n, j) => (j === i ? e.target.value : n)),
                          [naam, e.target.value],
                        )
                      }
                      onPaste={(e) => {
                        // Een lijst plakken (bv. uit Excel): elke regel een kaart.
                        const regels = e.clipboardData
                          .getData('text')
                          .split(/\r?\n/)
                          .map((x) => x.trim())
                          .filter(Boolean);
                        if (regels.length < 2) return;
                        e.preventDefault();
                        zet(s, [...thema[s].slice(0, i), ...regels, ...thema[s].slice(i + 1)]);
                      }}
                    />
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`${naam || `${SOORT_NAMEN[s].titel} ${i + 1}`} verwijderen`}
                      onClick={() =>
                        zet(
                          s,
                          thema[s].filter((_, j) => j !== i),
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="mt-1.5 text-sm text-[var(--accent-tekst)] underline" onClick={() => zet(s, [...thema[s], ''])}>
              + {ENKELVOUD[s]}
            </button>
            {oplossingVan(s) && (
              <button type="button" className="mt-1.5 ml-3 text-sm text-slate-500 underline" onClick={() => zet(s, thema[s], [oplossingVan(s)!, ''])}>
                laptop kiest de oplossing
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">Duid per soort de oplossing aan met het rondje; zonder aanduiding kiest de laptop bij elk spel zelf. Je kan ook een lijst plakken.</p>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={metVragen} onChange={(e) => onChange({ ...thema, metVragen: e.target.checked || undefined, opgaven: undefined })} />
        <span>
          Elke kaart krijgt een eigen vraag uit de set (behalve de oplossing): het juiste antwoord streept die kaart weg, een fout antwoord stil een andere.
          {metVragen && (
            <span className={`block ${vragen.length >= nodig ? 'text-slate-500' : 'font-semibold text-red-600'}`}>
              Nodig: {nodig} vragen, de set heeft er {vragen.length}. Een vraag met “Wie? Naam” in de uitleg hoort bij die kaart; de andere worden willekeurig verdeeld.
            </span>
          )}
        </span>
      </label>
      {problemen.length > 0 && <Notice tone="warn">{problemen.join(' ')}</Notice>}
    </div>
  );
}
