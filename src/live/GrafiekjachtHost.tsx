import { useEffect, useMemo, useRef, useState } from 'react';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { Button, Notice } from '../components/ui';
import { exporteerSessie, tijdTekst } from '../lib/exportResults';
import { speel, useMuziek } from '../lib/geluid';
import { beeindig } from '../lib/session';
import type { Sessie } from '../lib/types';
import { backend } from './config';
import { afgewerkt, grafiekBeoordelingen, grafiekStand, publiek, voorschrift, type Doel } from './grafiekjacht';
import { Oplossingen } from './GrafiekjachtSpeler';
import { Wachtruimte } from './LiveHost';
import { beurtenGelijk, synchroniseer } from './logic';
import { ReactiesOpBord } from './Reacties';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler, type StandRij } from './types';
import { bevestig } from '../lib/bevestig';

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };

/** Grafiekjacht op het bord: hoe ver elke leerling is, de ranglijst en de klok. */
export function GrafiekjachtHost(props: Props) {
  if (props.sessie.live!.afgesloten) return <GrafiekjachtEinde sessie={props.sessie} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />;
  return <GrafiekjachtActief {...props} />;
}

const doelenVan = (s: Sessie) => (s.live?.doelen ?? []) as Doel[];

/** Voor de resultaten: per leerling en ronde enkel het afgewerkte antwoord (juist of overgeslagen). */
function eindAntwoorden(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): LiveAntwoord[] {
  return spelers.flatMap((s) => [...afgewerkt(antwoorden, s.id).values()].map((a) => ({ ...a, juist: a.punten > 0 })));
}

function GrafiekjachtActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
  const live = sessie.live!;
  const be = backend(live.backend);
  const doelen = doelenVan(sessie);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  // Wat al beslist is, niet opnieuw nakijken (de database kan even achterlopen).
  const beslist = useRef(new Map<string, Beoordeling>());
  const bekend = useMemo(
    () =>
      antwoorden.map((a) => {
        const b = a.juist === null ? beslist.current.get(a.id) : undefined;
        return b ? { ...a, juist: b.juist, punten: b.punten, beloning: b.beloning ?? null } : a;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [antwoorden, beslist.current.size],
  );
  const stand = grafiekStand(spelers, bekend);

  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const verstreken = server?.vraagStart ? Math.max(0, nu - new Date(server.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  // Elk ingediend voorschrift meteen nakijken.
  const nakijken = useRef(false);
  const [ronde, setRonde] = useState(0);
  useEffect(() => {
    const items = grafiekBeoordelingen(doelen, bekend);
    if (items.length === 0 || nakijken.current) return;
    nakijken.current = true;
    void (async () => {
      try {
        await be.beoordeel(live.sessieId, items);
        for (const i of items) beslist.current.set(i.id, i);
        setFout(null);
      } catch (e) {
        setFout(e instanceof LiveFout ? e.message : 'Nakijken mislukt; nieuwe poging binnen enkele seconden.');
        await new Promise((r) => window.setTimeout(r, 3000));
      } finally {
        nakijken.current = false;
        setRonde((r) => r + 1);
      }
    })();
  }, [bekend, doelen, be, live.sessieId, ronde]);

  // De ranglijst doorsturen als ze veranderde.
  const standSleutel = JSON.stringify(stand.map((r) => [r.id, r.punten, r.klaar]));
  useEffect(() => {
    if (server?.status !== 'bezig') return;
    if (JSON.stringify(server.stand.map((r) => [r.id, r.punten, r.klaar])) === standSleutel) return;
    const id = window.setTimeout(() => void be.wijzigSessie(live.sessieId, { stand }).catch(() => {}), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standSleutel, server?.status]);

  // Resultaten in de lokale sessie.
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const huidig = sessieRef.current;
    const s = synchroniseer(huidig, spelers, eindAntwoorden(spelers, bekend), huidig.vraagVolgorde);
    if (!beurtenGelijk(s.beurten, huidig.beurten) || s.teams[0].leerlingen.length !== huidig.teams[0].leerlingen.length) onUpdate(s);
  }, [spelers, bekend, onUpdate]);

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
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand });
    const s = synchroniseer(sessie, spelers, eindAntwoorden(spelers, bekend), sessie.vraagVolgorde);
    onUpdate(beeindig({ ...s, live: { ...s.live!, eindstand: stand.map((r) => ({ naam: r.naam, punten: r.punten, juist: r.juist })) } }));
  }

  const afsluiten = async () => {
    onUpdate({ ...sessie, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  // Stoppen als de tijd om is of als iedereen alle grafieken heeft.
  const iedereenKlaar = stand.length > 0 && stand.every((r) => (r.klaar ?? 0) >= doelen.length);
  const gestopt = useRef(false);
  useEffect(() => {
    if (server?.status === 'bezig' && ((resterend !== null && resterend < -3000) || iedereenKlaar) && !gestopt.current) {
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
          startTekst="Start Grafiekjacht"
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
            <span className="text-3xl font-semibold">📈 Grafiekjacht</span>
            <span className="text-xl text-slate-600">
              {stand.filter((r) => (r.klaar ?? 0) >= doelen.length).length} / {stand.length} klaar
            </span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            <Button variant="primary" disabled={bezig} onClick={() => void bevestig('Grafiekjacht nu beëindigen?', { ja: 'Beëindigen' }).then((ok) => { if (ok) void actie(einde); })}>
              ⏹ Beëindigen
            </Button>
          </div>
          <Voortgang stand={stand} aantal={doelen.length} />
        </div>
      )}

      {server.status === 'einde' && <GrafiekjachtEinde sessie={sessie} onAfsluiten={afsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />}
    </div>
  );
}

/** Per leerling een balk: hoeveel grafieken af, en de punten. */
function Voortgang({ stand, aantal }: { stand: StandRij[]; aantal: number }) {
  return (
    <ol className="grid gap-2 lg:grid-cols-2">
      {stand.map((r, i) => (
        <li key={r.id ?? r.naam} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-2 text-xl shadow-sm" data-voortgang>
          <span className="w-8 font-bold text-slate-500">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
          <span className="w-40 truncate font-semibold">{r.naam}</span>
          <div className="flex flex-1 gap-1" aria-label={`${r.klaar ?? 0} van ${aantal} grafieken`}>
            {Array.from({ length: aantal }, (_, k) => (
              <span key={k} className={`h-5 flex-1 rounded ${k < (r.klaar ?? 0) ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <span className="w-16 text-right font-mono font-bold">{r.punten}</span>
        </li>
      ))}
      {stand.length === 0 && <li className="text-slate-500">Nog niemand aangemeld.</li>}
    </ol>
  );
}

function GrafiekjachtEinde({ sessie, onAfsluiten, onBewaar, onVerwijder }: { sessie: Sessie; onAfsluiten?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const ranking = sessie.live?.eindstand ?? [];
  const podium = ranking.slice(0, 3);
  // De oplossingen om samen te bespreken.
  const doelen = useMemo(() => publiek(doelenVan(sessie)).doelen, [sessie]);
  const voorschriften = useMemo(() => doelenVan(sessie).map(voorschrift), [sessie]);

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <div className="flex items-end justify-center gap-3">
        {[1, 0, 2].map(
          (i) =>
            podium[i] && (
              <div key={i} className="pop flex w-36 flex-col items-center" style={{ animationDelay: `${(2 - i) * 0.15}s` }}>
                <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                <div className="mt-1 text-center text-lg font-bold">{podium[i].naam}</div>
                <div className="font-mono">{podium[i].punten} punten</div>
                <div className={`mt-2 w-full rounded-t-xl bg-[var(--accent)] ${['h-32', 'h-20', 'h-12'][i]}`} />
              </div>
            ),
        )}
      </div>
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Zelf gevonden</th>
            <th className="px-4 py-2 text-right">Punten</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{r.naam}</td>
              <td className="px-4 py-2 text-right">
                {r.juist} / {doelen.length}
              </td>
              <td className="px-4 py-2 text-right font-mono">{r.punten}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-8 mb-3 text-xl font-semibold">De grafieken</h2>
      <Oplossingen doelen={doelen} voorschriften={voorschriften} />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => exporteerSessie(sessie)}>⬇ Resultaten exporteren (Excel)</Button>
        <AfsluitKnoppen serverWissen={onAfsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />
      </div>
    </div>
  );
}
