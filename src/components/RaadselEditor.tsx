import { useState } from 'react';
import { hintsVoorOefening, raadselProblemen } from '../live/whodunit';
import type { Raadsel } from '../lib/types';
import { Button, inputClass, labelClass, Notice } from './ui';

/** Het raadsel van een vragenset voor het spel Whodunit: verhaal, tabel met de oplossing en hints. */
export function RaadselEditor({ raadsel: r, aantalOefeningen, onChange, onVerwijder }: { raadsel: Raadsel; aantalOefeningen: number; onChange: (f: (r: Raadsel) => Raadsel) => void; onVerwijder: () => void }) {
  // Hints als tekst (één per lijn); bewaard zonder lege lijnen.
  const [hintTekst, setHintTekst] = useState(r.hints.join('\n'));
  const problemen = raadselProblemen(r);
  const aantalHints = r.hints.length;

  const zetCel = (ci: number, k: number, w: string) =>
    onChange((x) => ({ ...x, categorieen: x.categorieen.map((c, i) => (i === ci ? { ...c, oplossing: c.oplossing.map((o, j) => (j === k ? w : o)) } : c)) }));
  const kolomErbij = () => onChange((x) => ({ ...x, kolommen: [...x.kolommen, `${x.kolommen.length + 1}e`], categorieen: x.categorieen.map((c) => ({ ...c, oplossing: [...c.oplossing, ''] })) }));
  const kolomWeg = (k: number) =>
    onChange((x) => ({ ...x, kolommen: x.kolommen.filter((_, j) => j !== k), categorieen: x.categorieen.map((c) => ({ ...c, oplossing: c.oplossing.filter((_, j) => j !== k) })) }));

  // Hoeveel hints levert elke oefening op?
  const verdeling =
    aantalOefeningen > 0 && aantalHints > 0
      ? aantalOefeningen === aantalHints
        ? 'Elke juiste oefening levert precies één hint op.'
        : aantalOefeningen > aantalHints
          ? `Er zijn meer oefeningen (${aantalOefeningen}) dan hints (${aantalHints}): ${Array.from({ length: aantalOefeningen }, (_, i) => hintsVoorOefening(i, aantalOefeningen, aantalHints).length).filter((n) => n === 0).length} oefening(en) leveren geen hint op.`
          : `Er zijn meer hints (${aantalHints}) dan oefeningen (${aantalOefeningen}): sommige oefeningen leveren twee of meer hints op.`
      : '';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="raadsel-titel">
            Titel van het raadsel
          </label>
          <input id="raadsel-titel" className={inputClass} value={r.titel} onChange={(e) => onChange((x) => ({ ...x, titel: e.target.value }))} />
        </div>
        <div>
          <label className={labelClass} htmlFor="raadsel-kolomtitel">
            Uitleg boven de kolommen
          </label>
          <input
            id="raadsel-kolomtitel"
            className={inputClass}
            placeholder="bv. Deze leerling is gecrasht als..."
            value={r.kolomTitel}
            onChange={(e) => onChange((x) => ({ ...x, kolomTitel: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="raadsel-verhaal">
          Verhaal
        </label>
        <textarea
          id="raadsel-verhaal"
          className={`${inputClass} h-32`}
          placeholder="Wat is er gebeurd? Leerlingen lezen dit bij de start."
          value={r.verhaal}
          onChange={(e) => onChange((x) => ({ ...x, verhaal: e.target.value }))}
        />
      </div>

      <div>
        <span className={labelClass}>Tabel met de oplossing</span>
        <p className="mb-2 text-sm text-slate-500">
          Elke rij is een categorie (bv. Naam, Drankje, Outfit). Vul in elke kolom de juiste waarde in. Leerlingen kiezen per vakje uit dezelfde waarden, alfabetisch.
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-1 text-left font-medium text-slate-500">Categorie</th>
                {r.kolommen.map((k, i) => (
                  <th key={i} className="p-1">
                    <div className="flex gap-1">
                      <input
                        aria-label={`Kolom ${i + 1}`}
                        className={`${inputClass} w-28 text-center font-semibold`}
                        value={k}
                        onChange={(e) => onChange((x) => ({ ...x, kolommen: x.kolommen.map((o, j) => (j === i ? e.target.value : o)) }))}
                      />
                      {r.kolommen.length > 2 && (
                        <button type="button" className="px-1 text-slate-400 hover:text-red-600" title="Kolom verwijderen" onClick={() => kolomWeg(i)}>
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-1">
                  <Button variant="ghost" onClick={kolomErbij}>
                    + kolom
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {r.categorieen.map((c, ci) => (
                <tr key={ci}>
                  <td className="p-1">
                    <input
                      aria-label={`Categorie ${ci + 1}`}
                      className={`${inputClass} w-36 font-semibold`}
                      placeholder="bv. Drankje"
                      value={c.naam}
                      onChange={(e) => onChange((x) => ({ ...x, categorieen: x.categorieen.map((o, i) => (i === ci ? { ...o, naam: e.target.value } : o)) }))}
                    />
                  </td>
                  {r.kolommen.map((_, k) => (
                    <td key={k} className="p-1">
                      <input aria-label={`${c.naam || 'Categorie'} ${r.kolommen[k]}`} className={`${inputClass} w-36`} value={c.oplossing[k] ?? ''} onChange={(e) => zetCel(ci, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="p-1">
                    <button
                      type="button"
                      className="px-2 text-slate-400 hover:text-red-600"
                      title="Categorie verwijderen"
                      onClick={() => onChange((x) => ({ ...x, categorieen: x.categorieen.filter((_, i) => i !== ci) }))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="ghost"
          className="mt-1"
          onClick={() => onChange((x) => ({ ...x, categorieen: [...x.categorieen, { naam: '', oplossing: x.kolommen.map(() => '') }] }))}
        >
          + categorie
        </Button>
      </div>

      <div>
        <label className={labelClass} htmlFor="raadsel-hints">
          Hints ({aantalHints}) · één per lijn
        </label>
        <textarea
          id="raadsel-hints"
          className={`${inputClass} h-48`}
          placeholder={'De bierdrinker hing heel de avond aan de paal.\nWietse is de voorlaatste die gecrasht is.'}
          value={hintTekst}
          onChange={(e) => {
            setHintTekst(e.target.value);
            const hints = e.target.value
              .split(/\r?\n/)
              .map((h) => h.trim())
              .filter(Boolean);
            onChange((x) => ({ ...x, hints }));
          }}
        />
        <p className="mt-1 text-sm text-slate-500">
          Leerlingen verdienen de hints in deze volgorde met de oefeningen hierboven (oefening 1 geeft hint 1 ...). {verdeling}
        </p>
      </div>

      {problemen.length > 0 && <Notice tone="warn">Nog te doen: {problemen.join(' ')}</Notice>}
      <div className="flex justify-end">
        <Button variant="danger" onClick={() => confirm('Het raadsel verwijderen? De oefeningen blijven staan.') && onVerwijder()}>
          Raadsel verwijderen
        </Button>
      </div>
    </div>
  );
}
