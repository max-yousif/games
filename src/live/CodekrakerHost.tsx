import { useEffect, useMemo, useRef, useState } from 'react';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { Button, Notice } from '../components/ui';
import { exporteerSessie, tijdTekst } from '../lib/exportResults';
import { speel, useMuziek } from '../lib/geluid';
import { beeindig, korteNaamVan, resultatenPerLeerling } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { codekrakerBeoordelingen, codekrakerStand, codekrakerToestand, isActie, vraagIndex, type Toestand } from './codekraker';
import { ReactiesOpBord } from './Reacties';
import { backend } from './config';
import { Wachtruimte } from './LiveHost';
import { leerlingenVan, synchroniseer } from './logic';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler, type StandRij } from './types';

const fmt = (n: number) => n.toLocaleString('nl-BE');

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };

/** Codekraker op het bord: ranglijst met munten, nieuws over hacks en de klok. */
export function CodekrakerHost(props: Props) {
  if (props.sessie.live!.afgesloten) return <CodekrakerEinde sessie={props.sessie} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />;
  return <CodekrakerActief {...props} />;
}

/** Antwoorden op vragen als beurten van de lokale sessie (acties tellen niet als beurt). */
function alsBeurten(antwoorden: readonly LiveAntwoord[], aantal: number): LiveAntwoord[] {
  return antwoorden.filter((a) => !isActie(a.vraagNr)).map((a) => ({ ...a, vraagNr: vraagIndex(a.spelerId, a.vraagNr, aantal) }));
}

/** Munten per leerlingnaam (bij een groepje voor elke leerling). */
function muntenPerNaam(sessie: Sessie, t: Toestand): Record<string, number> {
  return Object.fromEntries([...t.spelers.values()].flatMap((p) => leerlingenVan(sessie, p.speler.naam).map((n) => [n, p.munten])));
}

function CodekrakerActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
  const live = sessie.live!;
  const be = backend(live.backend);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  // Al beslist maar nog niet terug van de server: niet opnieuw beslissen (anders een ander kistje).
  const beslist = useRef(new Map<string, Beoordeling>());
  const vragen = useMemo(() => sessie.vraagVolgorde.map((id) => sessie.vragen.find((v) => v.id === id)).filter((v): v is Vraag => !!v), [sessie]);
  const toestand = useMemo(() => codekrakerToestand(spelers, antwoorden), [spelers, antwoorden]);

  // Klok: verstreken (of resterende) tijd sinds de start.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const verstreken = server?.vraagStart ? Math.max(0, nu - new Date(server.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  // Alles meteen nakijken: vragen, kistjes, doelwitten en wachtwoorden.
  const nakijken = useRef(false);
  const [ronde, setRonde] = useState(0);
  useEffect(() => {
    const bekend = antwoorden.map((a) => {
      const b = a.juist === null ? beslist.current.get(a.id) : undefined;
      return b ? { ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null } : a;
    });
    const items = codekrakerBeoordelingen(vragen, { hacken: live.hacken ?? true }, spelers, bekend);
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
        await be.wijzigSessie(live.sessieId, { stand: codekrakerStand(codekrakerToestand(spelers, bijgewerkt), verstrekenRef.current) });
        setFout(null);
      } catch (e) {
        setFout(e instanceof LiveFout ? e.message : 'Nakijken mislukt; nieuwe poging binnen enkele seconden.');
        await new Promise((r) => window.setTimeout(r, 3000));
      } finally {
        nakijken.current = false;
        setRonde((r) => r + 1);
      }
    })();
  }, [antwoorden, vragen, be, live.sessieId, live.hacken, spelers, ronde]);

  // Stand opnieuw doorsturen als een firewall afloopt of iemand aansluit.
  const verstrekenRef = useRef(verstreken);
  verstrekenRef.current = verstreken;
  const stand = codekrakerStand(toestand, verstreken);
  const standSleutel = JSON.stringify(stand.map((r) => [r.id, r.punten, r.firewall, r.mult, r.juist]));
  useEffect(() => {
    if (server?.status !== 'bezig') return;
    void be.wijzigSessie(live.sessieId, { stand: codekrakerStand(toestand, verstrekenRef.current) }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standSleutel, server?.status]);

  // Resultaten bewaren in de lokale sessie: juiste antwoorden per leerling en de munten.
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const huidig = sessieRef.current;
    const s = synchroniseer(huidig, spelers, alsBeurten(antwoorden, vragen.length), huidig.vraagVolgorde);
    const munten = muntenPerNaam(huidig, toestand);
    if (
      JSON.stringify(s.beurten) !== JSON.stringify(huidig.beurten) ||
      s.teams[0].leerlingen.length !== huidig.teams[0].leerlingen.length ||
      JSON.stringify(munten) !== JSON.stringify(huidig.live?.munten ?? {})
    ) {
      onUpdate({ ...s, live: { ...s.live!, munten } });
    }
  }, [spelers, antwoorden, toestand, vragen.length, onUpdate]);

  // Muziek en geluid: een klank bij elke geslaagde hack, fanfare op het einde.
  useMuziek(server?.status === 'lobby' ? 'wacht' : server?.status === 'bezig' ? 'spel' : null);
  const aantalHacks = toestand.gebeurtenissen.filter((g) => g.soort === 'hack').length;
  const vorigeHacks = useRef(aantalHacks);
  useEffect(() => {
    if (aantalHacks > vorigeHacks.current) speel('onthul');
    vorigeHacks.current = aantalHacks;
  }, [aantalHacks]);
  const vorigeStatus = useRef(server?.status);
  useEffect(() => {
    if (vorigeStatus.current && server?.status !== vorigeStatus.current) {
      if (server?.status === 'bezig') speel('start');
      if (server?.status === 'einde') speel('fanfare');
    }
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
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand: codekrakerStand(toestand, verstreken) });
    const s = synchroniseer(sessie, spelers, alsBeurten(antwoorden, vragen.length), sessie.vraagVolgorde);
    onUpdate(beeindig({ ...s, live: { ...s.live!, munten: muntenPerNaam(sessie, toestand) } }));
  }

  // Gegevens op de server wissen; de resultaten blijven in de lokale sessie.
  const afsluiten = async () => {
    onUpdate({ ...sessie, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  // Automatisch stoppen als de tijd om is.
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
          startTekst="Start Crypto Hack"
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
            <span className="text-3xl font-semibold">🔐 Crypto Hack</span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            <Button variant="primary" disabled={bezig} onClick={() => confirm('Crypto Hack nu beëindigen?') && void actie(einde)}>
              ⏹ Beëindigen
            </Button>
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-[3fr_2fr]">
            <Ranglijst stand={stand} />
            <div className="rounded-2xl bg-gray-900 p-5 text-white shadow-sm">
              <div className="mb-3 text-sm tracking-wide uppercase opacity-60">Nieuws</div>
              <ul className="space-y-2">
                {[...toestand.gebeurtenissen]
                  .reverse()
                  .slice(0, 10)
                  .map((g, i) => (
                    <li key={`${g.tijdMs}-${i}`} className={`pop text-lg ${g.soort === 'hack' ? 'font-semibold text-amber-300' : 'opacity-90'}`}>
                      {g.tekst}
                    </li>
                  ))}
                {toestand.gebeurtenissen.length === 0 && <li className="opacity-60">Nog niets gebeurd… Wie kraakt de eerste code?</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {server.status === 'einde' && <CodekrakerEinde sessie={sessie} stand={stand} onAfsluiten={afsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />}
    </div>
  );
}

function Ranglijst({ stand }: { stand: StandRij[] }) {
  const max = Math.max(1, ...stand.map((r) => r.punten));
  return (
    <ol className="space-y-2">
      {stand.map((r, i) => (
        <li key={r.id ?? r.naam} className="relative flex items-center gap-4 overflow-hidden rounded-2xl bg-surface px-5 py-3 text-2xl shadow-sm">
          <span className="absolute inset-y-0 left-0 bg-amber-100 transition-all duration-700" style={{ width: `${(r.punten / max) * 100}%` }} aria-hidden />
          <span className="relative w-10 font-bold text-slate-500">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
          <span className="relative flex-1 truncate font-semibold">{r.naam}</span>
          {r.firewall && (
            <span className="relative text-xl" title="Firewall">
              🛡️
            </span>
          )}
          {r.mult && <span className="relative rounded-full bg-emerald-100 px-2 text-base font-bold text-emerald-800">×{r.mult}</span>}
          <span className="relative text-base text-slate-500">{r.juist} ✓</span>
          <span className="relative w-36 text-right font-mono font-bold">🪙 {fmt(r.punten)}</span>
        </li>
      ))}
      {stand.length === 0 && <li className="text-slate-500">Nog niemand aangemeld.</li>}
    </ol>
  );
}

function CodekrakerEinde({ sessie, stand, onAfsluiten, onBewaar, onVerwijder }: { sessie: Sessie; stand?: StandRij[]; onAfsluiten?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const kort = korteNaamVan(sessie);
  const munten = sessie.live?.munten ?? {};
  const rijen = resultatenPerLeerling(sessie).filter((r) => r.naam !== '(hele team)');
  const ranking: { naam: string; punten: number; juist: number }[] =
    stand ?? rijen.map((r) => ({ naam: sessie.live?.bijnamen?.[r.naam] ?? kort(r.naam), punten: munten[r.naam] ?? 0, juist: r.juist })).sort((a, b) => b.punten - a.punten);
  const podium = ranking.slice(0, 3);
  const besteJuist = Math.max(0, ...ranking.map((r) => r.juist));
  const sterren = ranking.filter((r) => r.juist === besteJuist && besteJuist > 0).map((r) => r.naam);

  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <div className="text-center text-6xl">🔐</div>
      <div className="mt-6 flex items-end justify-center gap-4">
        {[1, 0, 2].map(
          (i) =>
            podium[i] && (
              <div key={i} className="pop flex w-56 flex-col items-center" style={{ animationDelay: `${(2 - i) * 0.15}s` }}>
                <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                <div className="mt-1 text-center text-xl font-bold">{podium[i].naam}</div>
                <div className="font-mono text-2xl">🪙 {fmt(podium[i].punten)}</div>
                <div className={`mt-2 w-full rounded-t-xl bg-amber-400 ${['h-32', 'h-20', 'h-12'][i]}`} />
              </div>
            ),
        )}
      </div>
      {sterren.length > 0 && (
        <p className="mt-4 text-center text-xl text-slate-600">
          ⭐ Meeste juiste antwoorden: {sterren.join(', ')} ({besteJuist})
        </p>
      )}
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Juist</th>
            <th className="px-4 py-2 text-right">Munten</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{r.naam}</td>
              <td className="px-4 py-2 text-right">{r.juist}</td>
              <td className="px-4 py-2 text-right font-mono">{fmt(r.punten)}</td>
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
