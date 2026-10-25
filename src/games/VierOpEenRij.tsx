import { useState } from 'react';
import { BeurtScherm } from '../components/BeurtScherm';
import { Scorebord } from '../components/Scorebord';
import { bouwRooster, isVol, KOLOMMEN, vrijeRij, winnaar } from '../lib/connectFour';
import { beeindig, teamAanDeBeurt, teamScores, voegBeurtToe, volgendeVraag } from '../lib/session';
import type { Sessie } from '../lib/types';

/** Team dat na een juist antwoord nog een schijf moet laten vallen, of null. */
export function wachtOpZet(s: Sessie): number | null {
  const laatste = s.beurten.at(-1);
  const juist = s.beurten.filter((b) => b.juist).length;
  return laatste?.juist && s.zetten.length < juist ? laatste.team : null;
}

export function VierOpEenRij({ sessie, onUpdate }: { sessie: Sessie; onUpdate: (s: Sessie) => void }) {
  const [vraagOpen, setVraagOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const rooster = bouwRooster(sessie.zetten);
  const win = winnaar(rooster);
  const zetVan = wachtOpZet(sessie);
  const team = zetVan ?? teamAanDeBeurt(sessie);
  const vraag = volgendeVraag(sessie);
  const laatsteZet = sessie.zetten.at(-1);
  const winVakjes = new Set(win?.vakjes.map(([r, k]) => `${r},${k}`));

  function laatVallen(kolom: number) {
    if (zetVan === null || vrijeRij(rooster, kolom) === null) return;
    let s: Sessie = { ...sessie, zetten: [...sessie.zetten, { team: zetVan, kolom }] };
    const r = bouwRooster(s.zetten);
    if (winnaar(r) || isVol(r)) s = beeindig(s);
    onUpdate(s);
    setHover(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-6 pb-6">
      <div className="flex h-16 items-center text-2xl font-semibold" style={{ color: sessie.teams[team].kleur }}>
        {zetVan !== null ? (
          <span>✓ Juist! {sessie.teams[zetVan].naam}: kies een kolom voor je schijf.</span>
        ) : (
          <button type="button" onClick={() => setVraagOpen(true)} className="rounded-xl px-8 py-3 text-xl font-semibold text-white shadow-md hover:brightness-110" style={{ background: sessie.teams[team].kleur }}>
            Vraag voor {sessie.teams[team].naam} ▶
          </button>
        )}
      </div>

      <div className="min-h-0 w-full max-w-3xl flex-1">
        <div className="mx-auto grid aspect-[7/6] max-h-full gap-2 rounded-3xl bg-slate-800 p-3 shadow-xl" style={{ gridTemplateColumns: `repeat(${KOLOMMEN}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
          {rooster.map((rij, ri) =>
            rij.map((cel, ki) => {
              const nieuw = laatsteZet && laatsteZet.kolom === ki && cel !== null && ri === rooster.findIndex((r) => r[ki] !== null);
              const voorbeeld = zetVan !== null && hover === ki && cel === null && vrijeRij(rooster, ki) === ri;
              return (
                <button
                  key={`${ri},${ki}`}
                  type="button"
                  disabled={zetVan === null}
                  onMouseEnter={() => setHover(ki)}
                  onClick={() => laatVallen(ki)}
                  className={`aspect-square rounded-full ${zetVan !== null ? 'cursor-pointer' : 'cursor-default'} ${hover === ki && zetVan !== null ? 'bg-slate-300' : 'bg-white'}`}
                  aria-label={`Kolom ${ki + 1}`}
                >
                  {cel !== null && (
                    <span
                      className={`block h-full w-full rounded-full ${nieuw ? 'disc-drop' : ''} ${winVakjes.has(`${ri},${ki}`) ? 'ring-8 ring-amber-300' : ''}`}
                      style={{ background: sessie.teams[cel].kleur, ['--drop-from' as string]: `-${(ri + 1) * 110}%` }}
                    />
                  )}
                  {voorbeeld && <span className="block h-full w-full rounded-full opacity-40" style={{ background: sessie.teams[zetVan].kleur }} />}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="w-full">
        <Scorebord sessie={sessie} scores={teamScores(sessie)} actief={team} eenheid="juist" />
      </div>

      {vraagOpen && vraag && (
        <BeurtScherm
          key={sessie.beurten.length}
          sessie={sessie}
          team={team}
          vraag={vraag}
          punten={1}
          onAnnuleer={() => setVraagOpen(false)}
          onKlaar={({ leerlingId, juist }) => {
            onUpdate(voegBeurtToe(sessie, { vraagId: vraag.id, team, leerlingId, juist, punten: juist ? 1 : 0 }));
            setVraagOpen(false);
          }}
        />
      )}
    </div>
  );
}
