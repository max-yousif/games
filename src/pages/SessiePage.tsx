import { useEffect, useState, type ButtonHTMLAttributes } from 'react';
import { EindScherm } from '../components/EindScherm';
import { GeluidMenu } from '../components/GeluidMenu';
import { Notice } from '../components/ui';
import { VierOpEenRij, wachtOpZet } from '../games/VierOpEenRij';
import { QuizBord } from '../games/QuizBord';
import { EscapeHost } from '../live/EscapeHost';
import { LiveHost } from '../live/LiveHost';
import { VerbindingsBolletje } from '../live/VerbindingsBolletje';
import { bouwRooster, winnaar } from '../lib/connectFour';
import { SPEL_NAMEN } from '../lib/exportResults';
import { speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { beeindig, nieuweSessie } from '../lib/session';
import type { Store } from '../lib/store';
import type { Sessie } from '../lib/types';
import { BomSpel } from '../games/BomSpel';
import { bomWinnaar, nieuweBom } from '../lib/bom';
import { CodekrakerHost } from '../live/CodekrakerHost';
import { CluedoHost } from '../live/CluedoHost';
import { TerritoriumHost } from '../live/TerritoriumHost';

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
      naamVolgorde: s.naamVolgorde,
    });
    if (s.bom) nieuw.bom = nieuweBom(s.teams.length, s.bom.tijd);
    store.bewaarSessie(nieuw);
    ga({ pagina: 'sessie', id: nieuw.id });
  }

  // Afsluiten zonder opslaan: eerst weg van deze pagina, dan de sessie wissen.
  function verwijder() {
    const id = sessie!.id;
    ga({ pagina: 'start' });
    store.setSessies((all) => all.filter((x) => x.id !== id));
  }

  const vierWinnaar =
    sessie.spelType === 'vieropeenrij' ? (winnaar(bouwRooster(sessie.zetten))?.team ?? null) : sessie.spelType === 'bom' ? bomWinnaar(sessie) : undefined;
  const isLive = sessie.spelType === 'live' || sessie.spelType === 'escape' || sessie.spelType === 'whodunit' || sessie.spelType === 'codekraker' || sessie.spelType === 'cluedo' || sessie.spelType === 'territorium';
  // Bij de bom niet: de ontploffingen en de houder zouden niet mee teruggaan.
  const kanOngedaan = sessie.beurten.length > 0 && !isLive && sessie.spelType !== 'bom';

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center gap-3 px-6 py-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">{sessie.setTitel}</div>
          <div className="text-sm text-slate-500">
            {SPEL_NAMEN[sessie.spelType]} · {sessie.klasNaam}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isLive && !sessie.live?.afgesloten && <VerbindingsBolletje />}
          {!isLive && (
            <ToolKnop onClick={() => store.bewaarSessie(ongedaanMaken(sessie))} disabled={!kanOngedaan} title="Laatste beurt ongedaan maken">
              ↶ Ongedaan maken
            </ToolKnop>
          )}
          <GeluidMenu />
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

      {sessie.spelType === 'territorium' ? (
        <TerritoriumHost sessie={sessie} onUpdate={store.bewaarSessie} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
      ) : sessie.spelType === 'cluedo' ? (
        <CluedoHost sessie={sessie} onUpdate={store.bewaarSessie} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
      ) : sessie.spelType === 'codekraker' ? (
        <CodekrakerHost sessie={sessie} onUpdate={store.bewaarSessie} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
      ) : sessie.spelType === 'escape' || sessie.spelType === 'whodunit' ? (
        <EscapeHost sessie={sessie} onUpdate={store.bewaarSessie} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
      ) : isLive ? (
        <LiveHost sessie={sessie} onUpdate={store.bewaarSessie} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
      ) : sessie.beeindigd ? (
        <div className="flex-1 overflow-y-auto">
          <EindScherm sessie={sessie} winnaar={vierWinnaar} onOpnieuw={opnieuw} onBewaar={() => store.telGespeeld(sessie.id)} onVerwijder={verwijder} />
        </div>
      ) : sessie.spelType === 'quizbord' ? (
        <QuizBord sessie={sessie} onUpdate={store.bewaarSessie} />
      ) : sessie.spelType === 'bom' ? (
        <BomSpel sessie={sessie} onUpdate={store.bewaarSessie} />
      ) : (
        <VierOpEenRij sessie={sessie} onUpdate={store.bewaarSessie} />
      )}
    </div>
  );
}

function ToolKnop(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-slate-50 disabled:opacity-40" />;
}
