import { useEffect, useMemo, useRef, useState } from 'react';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { Button, Notice } from '../components/ui';
import { exporteerSessie, tijdTekst } from '../lib/exportResults';
import { speel, useMuziek } from '../lib/geluid';
import { beeindig, korteNaamVan, resultatenPerLeerling } from '../lib/session';
import type { CluedoOplossing, Sessie, Vraag } from '../lib/types';
import { aantalWeg, cluedoBeoordelingen, cluedoStand, cluedoToestand, SOORT_NAMEN, type CluedoToestand } from './cluedo';
import { isActie, vraagIndex } from './codekraker';
import { ReactiesOpBord } from './Reacties';
import { backend } from './config';
import { Wachtruimte } from './LiveHost';
import { leerlingenVan, synchroniseer } from './logic';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler, type StandRij } from './types';

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };

/** Cluedo op het bord: ranglijst, wie wat deed en de klok. De oplossing staat enkel hier. */
export function CluedoHost(props: Props) {
  if (props.sessie.live!.afgesloten) return <CluedoEinde sessie={props.sessie} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />;
  return <CluedoActief {...props} />;
}

/** Antwoorden op vragen als beurten van de lokale sessie (beschuldigingen tellen niet als beurt). */
function alsBeurten(antwoorden: readonly LiveAntwoord[], aantal: number): LiveAntwoord[] {
  return antwoorden.filter((a) => !isActie(a.vraagNr)).map((a) => ({ ...a, vraagNr: vraagIndex(a.spelerId, a.vraagNr, aantal) }));
}

/** Tijd tot de oplossing per leerlingnaam (bij een groepje voor elke leerling). */
function opgelostPerNaam(sessie: Sessie, t: CluedoToestand): Record<string, number> {
  return Object.fromEntries(
    [...t.spelers.values()].filter((p) => p.opgelostMs !== null).flatMap((p) => leerlingenVan(sessie, p.speler.naam).map((n) => [n, p.opgelostMs!])),
  );
}

function CluedoActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
  const live = sessie.live!;
  const { thema, oplossing } = sessie.cluedo!;
  const be = backend(live.backend);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  // Al beslist maar nog niet terug van de server: niet opnieuw beslissen (anders een andere kaart).
  const beslist = useRef(new Map<string, Beoordeling>());
  const vragen = useMemo(() => sessie.vraagVolgorde.map((id) => sessie.vragen.find((v) => v.id === id)).filter((v): v is Vraag => !!v), [sessie]);
  const toestand = useMemo(() => cluedoToestand(spelers, antwoorden), [spelers, antwoorden]);
  const stand = cluedoStand(toestand);

  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const verstreken = server?.vraagStart ? Math.max(0, nu - new Date(server.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  // Alles meteen nakijken: vragen (welke kaart verdwijnt) en beschuldigingen.
  const nakijken = useRef(false);
  const [ronde, setRonde] = useState(0);
  useEffect(() => {
    const bekend = antwoorden.map((a) => {
      const b = a.juist === null ? beslist.current.get(a.id) : undefined;
      return b ? { ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null } : a;
    });
    const items = cluedoBeoordelingen(vragen, thema, oplossing, spelers, bekend);
    if (items.length === 0 || nakijken.current) return;
    nakijken.current = true;
    void (async () => {
      try {
        await be.beoordeel(live.sessieId, items);
        for (const i of items) beslist.current.set(i.id, i);
        const bijgewerkt = bekend.map((a) => {
          const i = items.find((x) => x.id === a.id);
          return i ? { ...a, juist: i.juist, punten: i.punten, beloning: i.beloning ?? null } : a;
        });
        await be.wijzigSessie(live.sessieId, { stand: cluedoStand(cluedoToestand(spelers, bijgewerkt)) });
        setFout(null);
      } catch (e) {
        setFout(e instanceof LiveFout ? e.message : 'Nakijken mislukt; nieuwe poging binnen enkele seconden.');
        await new Promise((r) => window.setTimeout(r, 3000));
      } finally {
        nakijken.current = false;
        setRonde((r) => r + 1);
      }
    })();
  }, [antwoorden, vragen, thema, oplossing, be, live.sessieId, spelers, ronde]);

  // Stand opnieuw doorsturen als iemand aansluit.
  const standSleutel = JSON.stringify(stand.map((r) => [r.id, r.punten, r.tijdMs, r.juist]));
  useEffect(() => {
    if (server?.status !== 'bezig') return;
    void be.wijzigSessie(live.sessieId, { stand }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standSleutel, server?.status]);

  // Resultaten bewaren in de lokale sessie: juiste antwoorden per leerling en de tijd tot de oplossing.
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const huidig = sessieRef.current;
    const s = synchroniseer(huidig, spelers, alsBeurten(antwoorden, vragen.length), huidig.vraagVolgorde);
    const ontsnapt = opgelostPerNaam(huidig, toestand);
    if (
      JSON.stringify(s.beurten) !== JSON.stringify(huidig.beurten) ||
      s.teams[0].leerlingen.length !== huidig.teams[0].leerlingen.length ||
      JSON.stringify(ontsnapt) !== JSON.stringify(huidig.live?.ontsnapt ?? {})
    ) {
      onUpdate({ ...s, live: { ...s.live!, ontsnapt } });
    }
  }, [spelers, antwoorden, toestand, vragen.length, onUpdate]);

  useMuziek(server?.status === 'lobby' ? 'wacht' : server?.status === 'bezig' ? 'spel' : null);
  const aantalOpgelost = stand.filter((r) => r.tijdMs != null).length;
  const vorigOpgelost = useRef(aantalOpgelost);
  useEffect(() => {
    if (aantalOpgelost > vorigOpgelost.current) speel('fanfare');
    vorigOpgelost.current = aantalOpgelost;
  }, [aantalOpgelost]);
  const vorigeStatus = useRef(server?.status);
  useEffect(() => {
    if (vorigeStatus.current && server?.status !== vorigeStatus.current && server?.status === 'bezig') speel('start');
    vorigeStatus.current = server?.status;
  }, [server?.status]);

  async function actie(f: () => Promise<void>) {
    setBezig(true);
    setFout(null);
    try {
      await f();
    } catch (e) {
      setFout(e instanceof LiveFout ? e.message : 'Er ging iets mis met de verbinding. Probeer opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  async function einde() {
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand });
    const s = synchroniseer(sessie, spelers, alsBeurten(antwoorden, vragen.length), sessie.vraagVolgorde);
    onUpdate(beeindig({ ...s, live: { ...s.live!, ontsnapt: opgelostPerNaam(sessie, toestand) } }));
  }

  const afsluiten = async () => {
    onUpdate({ ...sessie, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  const gestopt = useRef(false);
  useEffect(() => {
    if (server?.status === 'bezig' && resterend !== null && resterend < -3000 && !gestopt.current) {
      gestopt.current = true;
      void actie(einde);
    }
  });

  if (server === undefined) return <div className="p-10 text-center text-xl text-slate-500">Verbinden met de server…</div>;
  if (server === null) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <Notice tone="warn">Dit spel bestaat niet meer op de server (gewist na 2 dagen of afgesloten). De bewaarde resultaten vind je onder Resultaten.</Notice>
        <Button className="mt-4" onClick={() => onUpdate({ ...beeindig(sessie), live: { ...live, afgesloten: true } })}>
          Toon de bewaarde resultaten
        </Button>
      </div>
    );
  }

  const totaalWeg = aantalWeg(thema);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8">
      {server.status !== 'einde' && <ReactiesOpBord be={be} sessieId={live.sessieId} />}
      {fout && (
        <div className="mb-3">
          <Notice tone="warn">{fout}</Notice>
        </div>
      )}

      {server.status === 'lobby' && (
        <Wachtruimte
          sessie={sessie}
          spelers={spelers}
          bezig={bezig}
          startTekst="Start Cluedo"
          onStart={() => actie(() => be.startEscape(live.sessieId))}
          onOntkoppel={(id) => actie(() => be.ontkoppel(id))}
          onWisBijnaam={(id) => actie(() => be.wisBijnaam(id))}
        />
      )}

      {server.status === 'bezig' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className={`rounded-2xl px-5 py-2 font-mono text-5xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
              ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
            </span>
            <span className="text-3xl font-semibold">🔎 {thema.titel}</span>
            <span className="text-xl text-slate-600">
              🎉 {aantalOpgelost} / {stand.length} opgelost
            </span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            <Button variant="primary" disabled={bezig} onClick={() => confirm('Cluedo nu beëindigen? De oplossing wordt dan getoond.') && void actie(einde)}>
              ⏹ Beëindigen
            </Button>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
            <Ranglijst stand={stand} totaal={totaalWeg} />
            <div className="rounded-2xl bg-gray-900 p-5 text-white shadow-sm">
              <div className="mb-3 text-sm tracking-wide uppercase opacity-60">Nieuws</div>
              <ul className="space-y-2">
                {[...toestand.gebeurtenissen]
                  .reverse()
                  .slice(0, 10)
                  .map((g, i) => (
                    <li key={`${g.tijdMs}-${i}`} className={`pop text-lg ${g.soort === 'opgelost' ? 'font-semibold text-emerald-300' : 'opacity-90'}`}>
                      {g.tekst}
                    </li>
                  ))}
                {toestand.gebeurtenissen.length === 0 && <li className="opacity-60">Nog geen beschuldigingen… Wie lost de moord als eerste op?</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {server.status === 'einde' && <CluedoEinde sessie={sessie} stand={stand} onAfsluiten={afsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />}
    </div>
  );
}

function Ranglijst({ stand, totaal }: { stand: StandRij[]; totaal: number }) {
  return (
    <ol className="space-y-2">
      {stand.map((r, i) => {
        const opgelost = r.tijdMs != null;
        return (
          <li key={r.id ?? r.naam} className={`relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-3 text-2xl shadow-sm ${opgelost ? 'bg-emerald-50' : 'bg-surface'}`}>
            <span
              className={`absolute inset-y-0 left-0 transition-all duration-700 ${opgelost ? 'bg-emerald-200' : 'bg-indigo-100'}`}
              style={{ width: `${opgelost ? 100 : (r.punten / Math.max(1, totaal)) * 100}%` }}
              aria-hidden
            />
            <span className="relative w-10 font-bold text-slate-500">{opgelost ? (['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`) : `${i + 1}.`}</span>
            <span className="relative flex-1 truncate font-semibold">{r.naam}</span>
            <span className="relative text-base text-slate-500">{r.juist} ✓</span>
            <span className="relative w-40 text-right font-mono font-bold">{opgelost ? `🎉 ${tijdTekst(r.tijdMs!)}` : `${r.punten} / ${totaal} weg`}</span>
          </li>
        );
      })}
      {stand.length === 0 && <li className="text-slate-500">Nog niemand aangemeld.</li>}
    </ol>
  );
}

/** De oplossing als drie kaarten. */
export function OplossingKaarten({ oplossing }: { oplossing: CluedoOplossing }) {
  const kaarten = [
    { s: SOORT_NAMEN.verdachten, naam: oplossing.verdachte },
    { s: SOORT_NAMEN.locaties, naam: oplossing.locatie },
    { s: SOORT_NAMEN.wapens, naam: oplossing.wapen },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {kaarten.map(({ s, naam }, i) => (
        <div key={s.titel} className="pop w-52 rounded-2xl border-4 border-red-700 bg-red-50 p-5 text-center shadow-lg" style={{ animationDelay: `${i * 0.4}s` }}>
          <div className="text-5xl">{s.icoon}</div>
          <div className="mt-2 text-sm tracking-wide text-red-800 uppercase">{s.enkel}</div>
          <div className="mt-1 text-2xl font-bold text-red-900">{naam}</div>
        </div>
      ))}
    </div>
  );
}

function CluedoEinde({ sessie, stand, onAfsluiten, onBewaar, onVerwijder }: { sessie: Sessie; stand?: StandRij[]; onAfsluiten?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const kort = korteNaamVan(sessie);
  const opgelost = sessie.live?.ontsnapt ?? {};
  const rijen = resultatenPerLeerling(sessie).filter((r) => r.naam !== '(hele team)');
  const ranking: { naam: string; tijdMs: number | null; juist: number }[] = stand
    ? stand.map((r) => ({ naam: r.naam, tijdMs: r.tijdMs ?? null, juist: r.juist }))
    : rijen
        .map((r) => ({ naam: sessie.live?.bijnamen?.[r.naam] ?? kort(r.naam), tijdMs: opgelost[r.naam] ?? null, juist: r.juist }))
        .sort((a, b) => (a.tijdMs ?? Infinity) - (b.tijdMs ?? Infinity) || b.juist - a.juist);
  const podium = ranking.filter((r) => r.tijdMs !== null).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <h2 className="text-center text-3xl font-bold">🔎 De oplossing</h2>
      <div className="mt-4">{sessie.cluedo && <OplossingKaarten oplossing={sessie.cluedo.oplossing} />}</div>
      {podium.length > 0 && (
        <div className="mt-8 flex items-end justify-center gap-4">
          {[1, 0, 2].map(
            (i) =>
              podium[i] && (
                <div key={i} className="pop flex w-56 flex-col items-center" style={{ animationDelay: `${1.2 + (2 - i) * 0.15}s` }}>
                  <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                  <div className="mt-1 text-center text-xl font-bold">{podium[i].naam}</div>
                  <div className="font-mono text-xl">{tijdTekst(podium[i].tijdMs!)}</div>
                  <div className={`mt-2 w-full rounded-t-xl bg-emerald-400 ${['h-32', 'h-20', 'h-12'][i]}`} />
                </div>
              ),
          )}
        </div>
      )}
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Juist</th>
            <th className="px-4 py-2 text-right">Opgelost na</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{r.naam}</td>
              <td className="px-4 py-2 text-right">{r.juist}</td>
              <td className="px-4 py-2 text-right font-mono">{r.tijdMs !== null ? tijdTekst(r.tijdMs) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => exporteerSessie(sessie)}>⬇ Resultaten exporteren (Excel)</Button>
        <AfsluitKnoppen serverWissen={onAfsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />
      </div>
    </div>
  );
}
