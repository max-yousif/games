import { useEffect, useMemo, useRef, useState } from 'react';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { Button, Notice } from '../components/ui';
import { exporteerSessie, tijdTekst } from '../lib/exportResults';
import { speel, useMuziek } from '../lib/geluid';
import { beeindig, korteNaamVan, resultatenPerLeerling } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { isActie, vraagIndex } from './codekraker';
import { backend } from './config';
import { Wachtruimte } from './LiveHost';
import { leerlingenVan, synchroniseer } from './logic';
import { ReactiesOpBord } from './Reacties';
import {
  alsOplossing,
  BREEDTE,
  codeerVeld,
  HOOGTE,
  kenKleurenToe,
  KLEUREN,
  leesVeld,
  territoriumBeoordelingen,
  territoriumStand,
  territoriumToestand,
  veldVan,
  type TerritoriumToestand,
} from './territorium';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler, type StandRij } from './types';
import { VeldBeeld } from './Veld';

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };

const TOTAAL = BREEDTE * HOOGTE;
const procent = (vakjes: number) => `${Math.round((vakjes / TOTAAL) * 1000) / 10} %`;

/** Territorium op het bord: het veld, de ranglijst en de klok. */
export function TerritoriumHost(props: Props) {
  if (props.sessie.live!.afgesloten) return <TerritoriumEinde sessie={props.sessie} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />;
  return <TerritoriumActief {...props} />;
}

/** Antwoorden op vragen als beurten van de lokale sessie (tekeningen tellen niet als beurt). */
function alsBeurten(antwoorden: readonly LiveAntwoord[], aantal: number): LiveAntwoord[] {
  return antwoorden.filter((a) => !isActie(a.vraagNr)).map((a) => ({ ...a, vraagNr: vraagIndex(a.spelerId, a.vraagNr, aantal) }));
}

/** Gebied (vakjes) per leerlingnaam (bij een groepje voor elke leerling). */
function gebiedPerNaam(sessie: Sessie, t: TerritoriumToestand): Record<string, number> {
  return Object.fromEntries([...t.spelers.values()].flatMap((p) => leerlingenVan(sessie, p.speler.naam).map((n) => [n, p.vakjes])));
}

function TerritoriumActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
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

  // Een vaste kleur per speler (bewaard in de sessie, zodat ze na herladen dezelfde blijft).
  const kleuren = useMemo(() => kenKleurenToe(spelers, live.kleuren ?? {}), [spelers, live.kleuren]);
  const beslist = useRef(new Map<string, Beoordeling>());
  const vragen = useMemo(() => sessie.vraagVolgorde.map((id) => sessie.vragen.find((v) => v.id === id)).filter((v): v is Vraag => !!v), [sessie]);
  const toestand = useMemo(() => territoriumToestand(spelers, antwoorden, kleuren), [spelers, antwoorden, kleuren]);
  const stand = territoriumStand(toestand);

  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const verstreken = server?.vraagStart ? Math.max(0, nu - new Date(server.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  // Alles meteen nakijken: vragen (tekenbeurt en penseel) en tekeningen.
  const nakijken = useRef(false);
  const [ronde, setRonde] = useState(0);
  useEffect(() => {
    const bekend = antwoorden.map((a) => {
      const b = a.juist === null ? beslist.current.get(a.id) : undefined;
      return b ? { ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null } : a;
    });
    const items = territoriumBeoordelingen(vragen, spelers, bekend, kleuren);
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
        const t = territoriumToestand(spelers, bijgewerkt, kleuren);
        await be.wijzigSessie(live.sessieId, { stand: territoriumStand(t), oplossing: alsOplossing(codeerVeld(t.veld)) });
        setFout(null);
      } catch (e) {
        setFout(e instanceof LiveFout ? e.message : 'Nakijken mislukt; nieuwe poging binnen enkele seconden.');
        await new Promise((r) => window.setTimeout(r, 3000));
      } finally {
        nakijken.current = false;
        setRonde((r) => r + 1);
      }
    })();
  }, [antwoorden, vragen, be, live.sessieId, spelers, kleuren, ronde]);

  // Veld en stand doorsturen als er iets veranderde (bv. een nieuwe speler met een kleur).
  const veldTekst = codeerVeld(toestand.veld);
  const standSleutel = JSON.stringify(stand.map((r) => [r.id, r.punten, r.juist, r.kleur, r.reeks]));
  useEffect(() => {
    if (server?.status !== 'bezig') return;
    if (server.stand && JSON.stringify(server.stand.map((r) => [r.id, r.punten, r.juist, r.kleur, r.reeks])) === standSleutel && veldVan(server) === veldTekst) return;
    const id = window.setTimeout(() => void be.wijzigSessie(live.sessieId, { stand, oplossing: alsOplossing(veldTekst) }).catch(() => {}), 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standSleutel, veldTekst, server?.status]);

  // Resultaten in de lokale sessie: juiste antwoorden, kleuren en gebied per leerling.
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const huidig = sessieRef.current;
    const s = synchroniseer(huidig, spelers, alsBeurten(antwoorden, vragen.length), huidig.vraagVolgorde);
    const gebied = gebiedPerNaam(huidig, toestand);
    if (
      JSON.stringify(s.beurten) !== JSON.stringify(huidig.beurten) ||
      s.teams[0].leerlingen.length !== huidig.teams[0].leerlingen.length ||
      JSON.stringify(gebied) !== JSON.stringify(huidig.live?.gebied ?? {}) ||
      JSON.stringify(kleuren) !== JSON.stringify(huidig.live?.kleuren ?? {})
    ) {
      onUpdate({ ...s, live: { ...s.live!, gebied, kleuren } });
    }
  }, [spelers, antwoorden, toestand, kleuren, vragen.length, onUpdate]);

  useMuziek(server?.status === 'lobby' ? 'wacht' : server?.status === 'bezig' ? 'spel' : null);
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
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand, oplossing: alsOplossing(veldTekst) });
    const s = synchroniseer(sessie, spelers, alsBeurten(antwoorden, vragen.length), sessie.vraagVolgorde);
    onUpdate(beeindig({ ...s, live: { ...s.live!, gebied: gebiedPerNaam(sessie, toestand), kleuren, eindveld: veldTekst, eindstand: stand } }));
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
          startTekst="Start Territorium"
          onStart={() => actie(() => be.startEscape(live.sessieId))}
          onOntkoppel={(id) => actie(() => be.ontkoppel(id))}
          onWisBijnaam={(id) => actie(() => be.wisBijnaam(id))}
        />
      )}

      {server.status === 'bezig' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className={`rounded-2xl px-5 py-2 font-mono text-5xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
              ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
            </span>
            <span className="text-3xl font-semibold">🖌️ Territorium</span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            <Button variant="primary" disabled={bezig} onClick={() => confirm('Territorium nu beëindigen?') && void actie(einde)}>
              ⏹ Beëindigen
            </Button>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[3fr_1fr]">
            <VeldBeeld veld={toestand.veld} />
            <Ranglijst stand={stand} />
          </div>
        </div>
      )}

      {server.status === 'einde' && <TerritoriumEinde sessie={sessie} onAfsluiten={afsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />}
    </div>
  );
}

function Kleur({ kleur }: { kleur?: number }) {
  return <span className="inline-block h-6 w-6 shrink-0 rounded-md border border-black/10" style={{ background: KLEUREN[(kleur ?? 0) % KLEUREN.length] }} aria-hidden />;
}

function Ranglijst({ stand }: { stand: StandRij[] }) {
  return (
    <ol className="space-y-2">
      {stand.map((r, i) => (
        <li key={r.id ?? r.naam} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-2 text-xl shadow-sm">
          <span className="w-8 font-bold text-slate-500">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
          <Kleur kleur={r.kleur} />
          <span className="min-w-0 flex-1 truncate font-semibold">{r.naam}</span>
          {(r.reeks ?? 0) >= 2 && (
            <span className="text-base" title={`${r.reeks} juist na elkaar`}>
              🔥{r.reeks}
            </span>
          )}
          <span className="w-20 text-right font-mono font-bold">{procent(r.punten)}</span>
        </li>
      ))}
      {stand.length === 0 && <li className="text-slate-500">Nog niemand aangemeld.</li>}
    </ol>
  );
}

function TerritoriumEinde({ sessie, onAfsluiten, onBewaar, onVerwijder }: { sessie: Sessie; onAfsluiten?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const kort = korteNaamVan(sessie);
  const gebied = sessie.live?.gebied ?? {};
  const veld = useMemo(() => leesVeld(sessie.live?.eindveld), [sessie.live?.eindveld]);
  const rijen = resultatenPerLeerling(sessie).filter((r) => r.naam !== '(hele team)');
  const ranking: { naam: string; vakjes: number; juist: number; kleur?: number }[] =
    sessie.live?.eindstand?.map((r) => ({ naam: r.naam, vakjes: r.punten, juist: r.juist, kleur: r.kleur })) ??
    rijen.map((r) => ({ naam: sessie.live?.bijnamen?.[r.naam] ?? kort(r.naam), vakjes: gebied[r.naam] ?? 0, juist: r.juist })).sort((a, b) => b.vakjes - a.vakjes);
  const podium = ranking.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl py-6">
      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <VeldBeeld veld={veld} />
        <div className="flex items-end justify-center gap-3">
          {[1, 0, 2].map(
            (i) =>
              podium[i] && (
                <div key={i} className="pop flex w-32 flex-col items-center" style={{ animationDelay: `${(2 - i) * 0.15}s` }}>
                  <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                  <div className="mt-1 text-center text-lg font-bold">{podium[i].naam}</div>
                  <div className="font-mono">{procent(podium[i].vakjes)}</div>
                  <div className={`mt-2 w-full rounded-t-xl ${['h-32', 'h-20', 'h-12'][i]}`} style={{ background: KLEUREN[(podium[i].kleur ?? 0) % KLEUREN.length] }} />
                </div>
              ),
          )}
        </div>
      </div>
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Juist</th>
            <th className="px-4 py-2 text-right">Gebied</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-2">
                  {r.kleur !== undefined && <Kleur kleur={r.kleur} />}
                  {r.naam}
                </span>
              </td>
              <td className="px-4 py-2 text-right">{r.juist}</td>
              <td className="px-4 py-2 text-right font-mono">
                {procent(r.vakjes)} <span className="text-slate-400">({r.vakjes})</span>
              </td>
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
