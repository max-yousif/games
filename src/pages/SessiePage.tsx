import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import { EindScherm } from '../components/EindScherm';
import { Notice } from '../components/ui';
import { VierOpEenRij, wachtOpZet } from '../games/VierOpEenRij';
import { QuizBord } from '../games/QuizBord';
import { LiveHost } from '../live/LiveHost';
import { bouwRooster, winnaar } from '../lib/connectFour';
import { SPEL_NAMEN } from '../lib/exportResults';
import { speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { beeindig, nieuweSessie } from '../lib/session';
import type { Store } from '../lib/store';
import type { Sessie } from '../lib/types';

/** Maakt de laatste handeling ongedaan (bij vier op een rij eerst de laatste schijf). */
export function ongedaanMaken(s: Sessie): Sessie {
  const basis = { ...s, beeindigd: null };
  if (s.spelType === 'vieropeenrij' && s.zetten.length > 0 && wachtOpZet(s) === null && s.beurten.at(-1)?.juist) {
    return { ...basis, zetten: s.zetten.slice(0, -1) };
  }
  return { ...basis, beurten: s.beurten.slice(0, -1) };
}

export function SessiePage({ id, store }: { id: string; store: Store }) {
  const sessie = store.sessies.find((s) => s.id === id);
  const [volScherm, setVolScherm] = useState(false);

  useEffect(() => {
    const onChange = () => setVolScherm(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!sessie) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <Notice tone="warn">
          Dit spel werd niet gevonden. <a className="underline" href={href({ pagina: 'start' })}>Naar de startpagina</a>
        </Notice>
      </div>
    );
  }

  function opnieuw() {
    const s = sessie!;
    const set = store.sets.find((x) => x.id === s.setId);
    const vragen = set ? speelbareVragen(set) : s.vragen;
    const nieuw = nieuweSessie({
      spelType: s.spelType,
      set: set ?? { id: s.setId, titel: s.setTitel, beschrijving: '', vak: 'andere', leerjaar: '', vragen, aangemaakt: s.gestart, gewijzigd: s.gestart },
      vragen,
      klasNaam: s.klasNaam,
      teams: s.teams,
      timer: s.timer,
    });
    store.bewaarSessie(nieuw);
    ga({ pagina: 'sessie', id: nieuw.id });
  }

  const vierWinnaar = sessie.spelType === 'vieropeenrij' ? (winnaar(bouwRooster(sessie.zetten))?.team ?? null) : undefined;
  const kanOngedaan = sessie.beurten.length > 0 && sessie.spelType !== 'live';
  const isLive = sessie.spelType === 'live';

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center gap-3 px-6 py-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">{sessie.setTitel}</div>
          <div className="text-sm text-slate-500">
            {SPEL_NAMEN[sessie.spelType]} · {sessie.klasNaam}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!isLive && (
            <ToolKnop onClick={() => store.bewaarSessie(ongedaanMaken(sessie))} disabled={!kanOngedaan} title="Laatste beurt ongedaan maken">
              ↶ Ongedaan maken
            </ToolKnop>
          )}
          <ToolKnop onClick={() => (volScherm ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
            {volScherm ? '⤡ Venster' : '⤢ Volledig scherm'}
          </ToolKnop>
          {!sessie.beeindigd && (
            <ToolKnop onClick={() => ga({ pagina: 'start' })} title="Het spel blijft bewaard; je kan het later hervatten">
              ⏸ Pauzeren
            </ToolKnop>
          )}
          {!sessie.beeindigd && !isLive && (
            <ToolKnop onClick={() => confirm('Het spel beëindigen en de eindstand tonen?') && store.bewaarSessie(beeindig(sessie))}>⏹ Stoppen</ToolKnop>
          )}
        </div>
      </header>

      {isLive ? (
        <LiveHost sessie={sessie} onUpdate={store.bewaarSessie} />
      ) : sessie.beeindigd ? (
        <div className="flex-1 overflow-y-auto">
          <EindScherm sessie={sessie} winnaar={vierWinnaar} onOpnieuw={opnieuw} />
        </div>
      ) : sessie.spelType === 'quizbord' ? (
        <QuizBord sessie={sessie} onUpdate={store.bewaarSessie} />
      ) : (
        <VierOpEenRij sessie={sessie} onUpdate={store.bewaarSessie} />
      )}
    </div>
  );
}

function ToolKnop(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-40" />;
}
