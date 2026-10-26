import { useState } from 'react';
import { MUZIEK_NAMEN, speel, useGeluid, type MuziekStijl } from '../lib/geluid';
import { inputClass, labelClass } from './ui';

const STIJLEN = Object.keys(MUZIEK_NAMEN) as MuziekStijl[];

/** Knop met de keuze van wacht- en spelmuziek, geluidseffecten en volume (onthouden per browser). */
export function GeluidMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [g, zet] = useGeluid();
  const stil = g.volume === 0 || (!g.effecten && g.wacht === 'uit' && g.spel === 'uit');

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
        <div className="absolute right-0 z-50 mt-2 w-72 space-y-3 rounded-xl border border-slate-200 bg-surface p-4 text-sm shadow-lg">
          <div>
            <label className={labelClass} htmlFor="muziek-wacht">
              Wachtmuziek (wachtruimte)
            </label>
            <select id="muziek-wacht" className={inputClass} value={g.wacht} onChange={(e) => zet({ wacht: e.target.value as MuziekStijl })}>
              {STIJLEN.map((s) => (
                <option key={s} value={s}>
                  {MUZIEK_NAMEN[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="muziek-spel">
              Achtergrondmuziek tijdens het spel
            </label>
            <select id="muziek-spel" className={inputClass} value={g.spel} onChange={(e) => zet({ spel: e.target.value as MuziekStijl })}>
              {STIJLEN.map((s) => (
                <option key={s} value={s}>
                  {MUZIEK_NAMEN[s]}
                </option>
              ))}
            </select>
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
