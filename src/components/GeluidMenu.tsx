import { useEffect, useRef, useState } from 'react';
import { MAX_GROOTTE, useEigenNummers, verwijderNummer, voegNummerToe } from '../lib/eigenMuziek';
import { beluister, MUZIEK_NAMEN, speel, speeltMuziek, useGeluid, type MuziekStijl } from '../lib/geluid';
import { inputClass, labelClass } from './ui';

const INGEBOUWD = Object.keys(MUZIEK_NAMEN) as MuziekStijl[];

/** Knop met de keuze van wacht- en spelmuziek, eigen nummers, geluidseffecten en volume (onthouden per browser). */
export function GeluidMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [g, zet] = useGeluid();
  const nummers = useEigenNummers();
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const bestand = useRef<HTMLInputElement>(null);
  // Beluisteren kan enkel als er nog geen spelmuziek speelt (bv. op de pagina Spelen).
  const [luistert, setLuistert] = useState<'wacht' | 'spel' | null>(null);
  const [kanLuisteren, setKanLuisteren] = useState(false);
  useEffect(() => {
    if (open) setKanLuisteren(!speeltMuziek() || luistert !== null);
  }, [open, luistert]);
  useEffect(() => {
    if (!luistert) return;
    beluister(g[luistert]);
  }, [luistert, g]);
  // Stoppen bij sluiten van het menu of verlaten van de pagina.
  useEffect(() => {
    if (!open && luistert) {
      beluister(null);
      setLuistert(null);
    }
  }, [open, luistert]);
  const luisterRef = useRef(luistert);
  luisterRef.current = luistert;
  useEffect(() => () => void (luisterRef.current && beluister(null)), []);
  const stil = g.volume === 0 || (!g.effecten && g.wacht === 'uit' && g.spel === 'uit');

  async function voegToe(lijst: FileList | null) {
    if (!lijst?.length) return;
    setBezig(true);
    setFout(null);
    const fouten: string[] = [];
    for (const f of Array.from(lijst)) {
      try {
        await voegNummerToe(f);
      } catch (e) {
        fouten.push(e instanceof Error ? e.message : `${f.name} kon niet bewaard worden.`);
      }
    }
    setFout(fouten.length ? fouten.join(' ') : null);
    setBezig(false);
    if (bestand.current) bestand.current.value = '';
  }

  const keuzes = (id: string, label: string, waarde: MuziekStijl, veld: 'wacht' | 'spel') => (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className={labelClass} htmlFor={id}>
          {label}
        </label>
        {kanLuisteren && waarde !== 'uit' && (
          <button
            type="button"
            className="mb-1 text-xs font-semibold text-[var(--accent-tekst)]"
            onClick={() => {
              if (luistert === veld) beluister(null);
              setLuistert((l) => (l === veld ? null : veld));
            }}
          >
            {luistert === veld ? '⏹ Stop' : '▶ Beluister'}
          </button>
        )}
      </div>
      <select id={id} className={inputClass} value={waarde} onChange={(e) => zet({ [veld]: e.target.value as MuziekStijl })}>
        {INGEBOUWD.map((s) => (
          <option key={s} value={s}>
            {MUZIEK_NAMEN[s]}
          </option>
        ))}
        {nummers.length > 0 && (
          <optgroup label="Eigen muziek">
            {nummers.length > 1 && <option value="eigen">🎵 Alle eigen nummers (willekeurig)</option>}
            {nummers.map((n) => (
              <option key={n.id} value={`eigen:${n.id}`}>
                🎵 {n.naam}
              </option>
            ))}
          </optgroup>
        )}
        {/* Een gekozen nummer dat intussen verwijderd is. */}
        {waarde.startsWith('eigen') && !nummers.some((n) => waarde === `eigen:${n.id}`) && !(waarde === 'eigen' && nummers.length > 1) && (
          <option value={waarde}>(eigen nummer niet gevonden)</option>
        )}
      </select>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Muziek en geluid"
        className="rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
      >
        {stil ? '🔇' : '🔊'} Geluid
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[80vh] w-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-surface p-4 text-sm shadow-lg">
          {keuzes('muziek-wacht', 'Wachtmuziek (wachtruimte)', g.wacht, 'wacht')}
          {keuzes('muziek-spel', 'Achtergrondmuziek tijdens het spel', g.spel, 'spel')}
          <p className="text-xs text-slate-500">De muziek wordt al spelend gemaakt: nooit twee keer hetzelfde nummer.</p>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="font-semibold">🎵 Eigen muziek</div>
            <ul className="mt-1 space-y-1">
              {nummers.map((n) => (
                <li key={n.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate" title={n.naam}>
                    {n.naam}
                  </span>
                  <span className="text-xs text-slate-400">{(n.grootte / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`${n.naam} verwijderen`}
                    onClick={() => confirm(`"${n.naam}" verwijderen?`) && void verwijderNummer(n.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
              {nummers.length === 0 && <li className="text-slate-500">Nog geen eigen nummers.</li>}
            </ul>
            <label className={`mt-2 inline-block cursor-pointer rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 font-medium text-[var(--accent-tekst)] ${bezig ? 'opacity-50' : ''}`}>
              {bezig ? 'Bezig…' : '+ Nummer toevoegen'}
              <input ref={bestand} type="file" accept="audio/*" multiple className="sr-only" disabled={bezig} onChange={(e) => void voegToe(e.target.files)} />
            </label>
            {fout && <p className="mt-1 text-red-600">{fout}</p>}
            <p className="mt-1 text-xs text-slate-500">mp3, m4a, wav … tot {MAX_GROOTTE / 1024 / 1024} MB per nummer. Enkel bewaard in deze browser, op deze laptop.</p>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={g.effecten} onChange={(e) => zet({ effecten: e.target.checked })} />
            Geluidseffecten (juist, fout, antwoord, schijf …)
          </label>
          <div>
            <label className={labelClass} htmlFor="volume">
              Volume
            </label>
            <input id="volume" type="range" min={0} max={1} step={0.05} value={g.volume} onChange={(e) => zet({ volume: Number(e.target.value) })} className="w-full" />
          </div>
          <button type="button" className="text-[var(--accent-tekst)] underline" onClick={() => speel('juist')}>
            ▶ Test een geluid
          </button>
        </div>
      )}
    </div>
  );
}
