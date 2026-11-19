import { useEffect, useMemo, useRef, useState } from 'react';
import { bevestig } from '../lib/bevestig';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { RichText } from '../components/RichText';
import { Button, Notice } from '../components/ui';
import { VraagWeergave } from '../components/VraagWeergave';
import { exporteerSessie } from '../lib/exportResults';
import { speel, useMuziek } from '../lib/geluid';
import { shuffle } from '../lib/random';
import { beeindig } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { isKeuzeVraag, keuzeOpties, LETTERS } from '../lib/vraagtypes';
import {
  beginToestand,
  gebruikHulp,
  HULPLIJNEN,
  inDeKlas,
  kanHulp,
  nieuweBeurt,
  nummer,
  peiling,
  uitNummer,
  verwerkVraag,
  type ChallengerVraag,
  type Hulplijn,
  type Toestand,
  type Uitslag,
} from './challenger';
import { backend } from './config';
import { Wachtruimte } from './LiveHost';
import { antwoordWeergave, automatischJuist, beurtenGelijk, oplossingVan, publiekeVraag, schermNaam, synchroniseer } from './logic';
import { ReactiesOpBord } from './Reacties';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler, type StandRij } from './types';

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };
type Log = NonNullable<NonNullable<Sessie['live']>['challenger']>['log'];

/** Spanning: zo lang staat "Laatste antwoord" in beeld voor de onthulling. */
const SPANNING_MS = 2500;

/** Challenger op het bord: challenger kiezen, vraag per vraag, onthulling, tussenstand en podium. */
export function ChallengerHost(props: Props) {
  if (props.sessie.live!.afgesloten) return <ChallengerEinde sessie={props.sessie} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />;
  return <ChallengerActief {...props} />;
}

/** Ranglijst voor de server: punten, rol en de harten van de challenger. */
function maakStand(spelers: readonly LiveSpeler[], t: Toestand): StandRij[] {
  return spelers
    .filter((s) => s.verbonden || (t.score[s.id] ?? 0) > 0)
    .map((s) => ({
      id: s.id,
      naam: schermNaam(s),
      punten: t.score[s.id] ?? 0,
      juist: 0,
      rol: s.id === t.challengerId ? ('challenger' as const) : s.id in t.zone ? ('zone' as const) : ('klas' as const),
      ...(s.id === t.challengerId ? { harten: t.harten } : {}),
      ...(s.id in t.zone ? { reeks: t.zone[s.id] } : {}),
    }))
    .sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam, 'nl'));
}

/** Antwoorden als beurten voor de resultaten: per gespeelde vraag het klasantwoord, of het laatste van de challenger. */
function alsBeurten(antwoorden: readonly LiveAntwoord[], log: Log): LiveAntwoord[] {
  const uit: LiveAntwoord[] = [];
  log.forEach((l, i) => {
    if (!l.uitslag) return;
    const challenger = antwoorden.filter((a) => a.spelerId === l.uitslag!.challengerId && a.juist !== null && (a.vraagNr === nummer(l.q, 'challenger') || a.vraagNr === nummer(l.q, 'tweede')));
    for (const a of antwoorden) if (a.vraagNr === nummer(l.q, 'klas') && a.juist !== null && a.spelerId !== l.uitslag.challengerId) uit.push({ ...a, vraagNr: i });
    const laatste = challenger.sort((a, b) => b.vraagNr - a.vraagNr)[0];
    if (laatste) uit.push({ ...laatste, vraagNr: i });
  });
  return uit;
}

function ChallengerActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
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

  const inst = server?.challenger ?? { versie: 1, harten: 3, perBeurt: 0, klasTijd: 30 };
  const toestand = live.challenger?.toestand ?? beginToestand();
  const log: Log = live.challenger?.log ?? [];
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  const bewaar = (t: Toestand, l: Log = sessieRef.current.live?.challenger?.log ?? []) => {
    const s = sessieRef.current;
    onUpdate({ ...s, live: { ...s.live!, challenger: { toestand: t, log: l } } });
  };

  const namen = useMemo(() => Object.fromEntries(spelers.map((s) => [s.id, schermNaam(s)])), [spelers]);
  const deelnemers = spelers.filter((s) => s.verbonden).map((s) => s.id);
  const vraagVan = (q: number): Vraag | null => {
    const id = sessie.vraagVolgorde[q % Math.max(1, sessie.vraagVolgorde.length)];
    return sessie.vragen.find((v) => v.id === id) ?? null;
  };
  const cv: ChallengerVraag | undefined = server?.vraag?.challenger;
  const huidig = server && server.vraagNr >= 0 ? uitNummer(server.vraagNr) : null;
  const q = huidig?.q ?? log.length;
  const vraag = vraagVan(q);
  const laatste = log.at(-1);
  const [scherm, setScherm] = useState<'wacht' | 'kiezen' | 'spel' | 'tussenstand'>(() => (!toestand.challengerId ? 'wacht' : laatste?.uitslag?.einde ? 'tussenstand' : 'spel'));

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

  // Resultaten in de lokale sessie.
  useEffect(() => {
    const huidigeSessie = sessieRef.current;
    const l = huidigeSessie.live?.challenger?.log ?? [];
    const s = synchroniseer(huidigeSessie, spelers, alsBeurten(antwoorden, l), l.map((x) => x.vraagId));
    if (!beurtenGelijk(s.beurten, huidigeSessie.beurten) || s.teams[0].leerlingen.length !== huidigeSessie.teams[0].leerlingen.length) onUpdate({ ...s, live: { ...s.live!, challenger: huidigeSessie.live?.challenger } });
  }, [spelers, antwoorden, onUpdate]);

  const startVraag = (nr: number, v: Vraag, extra: ChallengerVraag) => be.startVraag(live.sessieId, nr, { ...publiekeVraag(v), challenger: extra });
  const basis = (t: Toestand): Omit<ChallengerVraag, 'fase'> => ({ challengerId: t.challengerId!, challengerNaam: namen[t.challengerId!] ?? '?', nr: t.vragen + 1 });

  async function startKlas(t: Toestand, nieuweQ: number) {
    const v = vraagVan(nieuweQ);
    if (!v) throw new LiveFout('geen_vraag');
    await startVraag(nummer(nieuweQ, 'klas'), v, { ...basis(t), fase: 'klas', tijd: inst.klasTijd });
    setScherm('spel');
  }

  const naarChallenger = () =>
    actie(async () => {
      if (!vraag || !cv || cv.fase !== 'klas') return;
      await startVraag(nummer(q, 'challenger'), vraag, { ...cv, fase: 'challenger', tijd: undefined });
    });

  // Klas klaar: de tijd is om of iedereen (klas en Comeback Zone) heeft geantwoord.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const klasAntwoorden = antwoorden.filter((a) => a.vraagNr === nummer(q, 'klas') && a.spelerId !== toestand.challengerId);
  const moetenAntwoorden = deelnemers.filter((id) => id !== toestand.challengerId);
  const resterend = cv?.fase === 'klas' && server?.vraagStart && cv.tijd ? Math.ceil((new Date(server.vraagStart).getTime() + cv.tijd * 1000 - nu) / 1000) : null;
  const naarChallengerGestart = useRef(-1);
  useEffect(() => {
    if (server?.status !== 'vraag' || cv?.fase !== 'klas' || naarChallengerGestart.current === q) return;
    const iedereen = moetenAntwoorden.length > 0 && moetenAntwoorden.every((id) => klasAntwoorden.some((a) => a.spelerId === id));
    if ((resterend !== null && resterend <= -1) || iedereen) {
      naarChallengerGestart.current = q;
      void naarChallenger();
    }
  });

  // De challenger antwoordt: "laatste antwoord", spanning, dan de tweede kans of de onthulling.
  const challengerAntwoorden = antwoorden.filter((a) => a.spelerId === toestand.challengerId && (a.vraagNr === nummer(q, 'challenger') || a.vraagNr === nummer(q, 'tweede')));
  const huidigAntwoord = server && cv && cv.fase !== 'klas' ? challengerAntwoorden.find((a) => a.vraagNr === server.vraagNr) : undefined;
  const verwerkt = useRef(new Set<string>());
  useEffect(() => {
    if (!huidigAntwoord || !vraag || !cv || server?.status !== 'vraag' || verwerkt.current.has(huidigAntwoord.id)) return;
    verwerkt.current.add(huidigAntwoord.id);
    speel('lont');
    const t = window.setTimeout(() => {
      const juist = automatischJuist(vraag, huidigAntwoord.antwoord);
      if (!juist && cv.tweedeKans && cv.fase === 'challenger') void actie(() => startVraag(nummer(q, 'tweede'), vraag, { ...cv, fase: 'tweede' }));
      else void onthul();
    }, SPANNING_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huidigAntwoord?.id]);

  const onthuld = useRef(-1);
  const onthul = () =>
    actie(async () => {
      if (!vraag || !cv || onthuld.current === q) return;
      onthuld.current = q;
      const juist: Record<string, boolean> = {};
      for (const a of klasAntwoorden) juist[a.spelerId] = automatischJuist(vraag, a.antwoord);
      const challenger = challengerAntwoorden.sort((a, b) => a.vraagNr - b.vraagNr).map((a) => automatischJuist(vraag, a.antwoord));
      const { toestand: nieuw, uitslag } = verwerkVraag(toestand, { spelers: deelnemers, juist, challenger, inzet: !!cv.inzet, tweedeKans: !!cv.tweedeKans, namen }, inst);
      const laatsteChallenger = challengerAntwoorden.at(-1);
      const items: Beoordeling[] = [
        ...klasAntwoorden.map((a) => ({ id: a.id, juist: juist[a.spelerId], punten: uitslag.punten[a.spelerId] ?? 0 })),
        ...challengerAntwoorden.map((a, i) => ({ id: a.id, juist: challenger[i], punten: a === laatsteChallenger ? (uitslag.punten[a.spelerId] ?? 0) : 0 })),
      ];
      try {
        await be.beoordeel(live.sessieId, items);
        await be.wijzigSessie(live.sessieId, { status: 'antwoord', oplossing: { ...oplossingVan(vraag), challenger: uitslag }, stand: maakStand(spelers, nieuw) });
      } catch (e) {
        onthuld.current = -1;
        throw e;
      }
      bewaar(nieuw, [...log, { q, vraagId: vraag.id, uitslag }]);
    });

  // Geluid bij de onthulling.
  const uitslag: Uitslag | undefined = server?.status === 'antwoord' ? server.oplossing?.challenger : undefined;
  const vorigeUitslag = useRef<string | null>(null);
  useEffect(() => {
    const sleutel = uitslag ? `${server?.vraagNr}` : null;
    if (!uitslag || vorigeUitslag.current === sleutel) return;
    vorigeUitslag.current = sleutel;
    if (uitslag.einde === 'gewonnen' || uitslag.einde === 'harten') speel('fanfare');
    else if (uitslag.getOut.length) speel('boem');
    else speel(uitslag.challengerJuist ? 'juist' : 'fout');
  }, [uitslag, server?.vraagNr]);

  function hulplijn(h: Hulplijn) {
    void actie(async () => {
      if (!vraag || !cv || cv.fase !== 'challenger' || huidigAntwoord) return;
      const cid = toestand.challengerId!;
      if (!kanHulp(toestand, cid, h)) return;
      const extra: Partial<ChallengerVraag> = {};
      const klas = inDeKlas(toestand, deelnemers);
      const klasVanNu = klasAntwoorden.filter((a) => klas.includes(a.spelerId));
      const pv = publiekeVraag(vraag);
      if (h === 'peiling') extra.peiling = peiling(klasVanNu, (a) => antwoordWeergave(pv, a));
      if (h === 'copycat') {
        const a = klasVanNu[Math.floor(Math.random() * klasVanNu.length)];
        extra.copycat = a ? { naam: namen[a.spelerId] ?? '?', antwoord: antwoordWeergave(pv, a.antwoord) } : null;
      }
      if (h === 'tweede') extra.tweedeKans = true;
      await startVraag(nummer(q, 'challenger'), vraag, { ...cv, ...extra });
      bewaar(gebruikHulp(toestand, cid, h));
    });
  }

  const inzet = () =>
    actie(async () => {
      if (!vraag || !cv || cv.fase !== 'challenger' || huidigAntwoord || toestand.inzetGebruikt) return;
      await startVraag(nummer(q, 'challenger'), vraag, { ...cv, inzet: true });
      bewaar({ ...toestand, inzetGebruikt: true });
    });

  const volgende = () =>
    actie(async () => {
      if (uitslag?.einde) setScherm('tussenstand');
      else await startKlas(toestand, log.length);
    });

  const overslaan = () =>
    actie(async () => {
      if (!vraag || server?.status !== 'vraag') return;
      const l = [...log, { q, vraagId: vraag.id, uitslag: null }];
      bewaar(toestand, l);
      await startKlas(toestand, l.length);
    });

  /** De beurt nu stoppen; een vraag die nog loopt, telt niet. */
  function beurtStoppen() {
    if (vraag && server?.status === 'vraag' && !log.some((l) => l.q === q)) bewaar(toestand, [...log, { q, vraagId: vraag.id, uitslag: null }]);
    setScherm('tussenstand');
  }

  function kies(id: string) {
    void actie(async () => {
      const t = nieuweBeurt(toestand, id, inst);
      bewaar(t);
      await be.wijzigSessie(live.sessieId, { stand: maakStand(spelers, t) });
      await startKlas(t, log.length);
    });
  }

  async function einde() {
    const stand = maakStand(spelers, toestand);
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand });
    const s = synchroniseer(sessie, spelers, alsBeurten(antwoorden, log), log.map((x) => x.vraagId));
    onUpdate(beeindig({ ...s, live: { ...s.live!, challenger: live.challenger, eindstand: stand.map((r) => ({ naam: r.naam, punten: r.punten, juist: r.juist })) } }));
  }

  const afsluiten = async () => {
    onUpdate({ ...sessie, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  useMuziek(server?.status === 'lobby' ? 'wacht' : server && server.status !== 'einde' ? 'spel' : null);

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

  const verbonden = spelers.filter((s) => s.verbonden);
  const vroegereChallengers = new Set(log.map((l) => l.uitslag?.challengerId).filter(Boolean));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8">
      {server.status !== 'einde' && <ReactiesOpBord be={be} sessieId={live.sessieId} />}
      {fout && (
        <div className="mb-3">
          <Notice tone="warn">{fout}</Notice>
        </div>
      )}

      {server.status === 'lobby' && scherm === 'wacht' && (
        <Wachtruimte sessie={sessie} spelers={spelers} bezig={bezig} startTekst="Start Challenger" onStart={() => setScherm('kiezen')} onOntkoppel={(id) => actie(() => be.ontkoppel(id))} onWisBijnaam={(id) => actie(() => be.wisBijnaam(id))} />
      )}
      {server.status === 'lobby' && scherm === 'kiezen' && <Kiezen spelers={verbonden} geweest={vroegereChallengers} bezig={bezig} onKies={kies} />}

      {server.status !== 'lobby' && server.status !== 'einde' && (scherm === 'kiezen' || scherm === 'wacht') && <Kiezen spelers={verbonden} geweest={vroegereChallengers} bezig={bezig} onKies={kies} />}

      {server.status !== 'lobby' && server.status !== 'einde' && scherm === 'tussenstand' && (
        <Tussenstand stand={maakStand(spelers, toestand)} uitslag={laatste?.uitslag ?? null} onVolgende={() => setScherm('kiezen')} onEinde={() => void bevestig('Het spel beëindigen?', { ja: 'Beëindigen' }).then((ok) => { if (ok) void actie(einde); })} />
      )}

      {(server.status === 'vraag' || server.status === 'antwoord') && scherm === 'spel' && vraag && cv && toestand.challengerId && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold">
              Beurt {toestand.beurt} · Vraag {cv.nr}
              {inst.perBeurt ? ` van ${inst.perBeurt}` : ''}
            </span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            <Button disabled={bezig} onClick={() => void overslaan()}>
              ⏭ Overslaan
            </Button>
            <Button disabled={bezig} onClick={() => void bevestig('De beurt van de challenger stoppen?', { ja: 'Stoppen' }).then((ok) => ok && beurtStoppen())}>
              ⏹ Beurt stoppen
            </Button>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[18rem_1fr_16rem]">
            <ChallengerKaart
              naam={namen[toestand.challengerId] ?? '?'}
              harten={server.status === 'antwoord' && uitslag ? uitslag.harten : toestand.harten}
              max={inst.harten}
              score={toestand.score[toestand.challengerId] ?? 0}
              hulpOver={HULPLIJNEN.filter((h) => kanHulp(toestand, toestand.challengerId!, h.id)).map((h) => h.id)}
              kanKiezen={server.status === 'vraag' && cv.fase === 'challenger' && !huidigAntwoord && !bezig}
              inzetOver={!toestand.inzetGebruikt && !cv.inzet}
              inzet={!!cv.inzet}
              tweedeKans={!!cv.tweedeKans}
              onHulp={hulplijn}
              onInzet={() => void inzet()}
            />

            <div className="space-y-3">
              <div className="rounded-2xl bg-surface p-6 shadow-sm">
                {server.status === 'antwoord' ? <Onthulling vraag={vraag} antwoorden={klasAntwoorden} challenger={challengerAntwoorden} /> : <VraagWeergave vraag={vraag} groot />}
                {server.status === 'antwoord' && vraag.uitleg && <RichText text={vraag.uitleg} className="mt-4 text-lg text-slate-600" />}
              </div>
              {cv.peiling && (
                <div className="rounded-2xl bg-sky-50 p-4" data-peiling>
                  <div className="mb-2 font-semibold">📊 Wat denkt de klas?</div>
                  {cv.peiling.map((p) => (
                    <div key={p.tekst} className="flex items-center gap-3 text-lg">
                      <span className="w-48 truncate">
                        <RichText text={p.tekst} />
                      </span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-sky-100">
                        <div className="h-full bg-sky-500" style={{ width: `${p.procent}%` }} />
                      </div>
                      <span className="w-14 text-right font-mono">{p.procent} %</span>
                    </div>
                  ))}
                  {cv.peiling.length === 0 && <span className="text-slate-500">Niemand van de klas heeft geantwoord.</span>}
                </div>
              )}
              {cv.copycat !== undefined && (
                <div className="rounded-2xl bg-amber-50 p-4 text-lg" data-copycat>
                  🐱 Copycat:{' '}
                  {cv.copycat ? (
                    <>
                      <strong>{cv.copycat.naam}</strong> koos <RichText text={cv.copycat.antwoord} className="inline" />
                    </>
                  ) : (
                    'niemand van de klas heeft geantwoord.'
                  )}
                </div>
              )}
              <StatusLijn
                server={server}
                cv={cv}
                naam={namen[toestand.challengerId] ?? '?'}
                beantwoord={klasAntwoorden.length}
                totaal={moetenAntwoorden.length}
                resterend={resterend}
                vergrendeld={!!huidigAntwoord}
                uitslag={uitslag}
                bezig={bezig}
                onChallenger={() => void naarChallenger()}
                onVolgende={() => void volgende()}
              />
            </div>

            <Groepen toestand={toestand} spelers={verbonden} />
          </div>
          {uitslag && <Uitroepen key={server.vraagNr} uitslag={uitslag} namen={namen} />}
        </div>
      )}

      {server.status === 'einde' && <ChallengerEinde sessie={sessie} onAfsluiten={afsluiten} onBewaar={onBewaar} onVerwijder={onVerwijder} />}
    </div>
  );
}

/** Wie wordt de challenger? Een spotlicht dat over de namen loopt, of zelf klikken. */
function Kiezen({ spelers, geweest, bezig, onKies }: { spelers: LiveSpeler[]; geweest: Set<string | undefined>; bezig: boolean; onKies: (id: string) => void }) {
  const [licht, setLicht] = useState<string | null>(null);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const zoeken = useRef(false);

  function spotlicht() {
    if (zoeken.current || spelers.length === 0) return;
    zoeken.current = true;
    setGekozen(null);
    // Liefst iemand die nog geen challenger was.
    const kandidaten = spelers.filter((s) => !geweest.has(s.id));
    const doel = shuffle(kandidaten.length ? kandidaten : spelers)[0].id;
    const reeks = shuffle(spelers.map((s) => s.id));
    let i = 0;
    const stap = () => {
      i++;
      if (i < 18) {
        setLicht(reeks[i % reeks.length]);
        speel('tik');
        window.setTimeout(stap, 60 + i * 12);
      } else {
        setLicht(doel);
        setGekozen(doel);
        speel('onthul');
        zoeken.current = false;
      }
    };
    stap();
  }

  const naam = spelers.find((s) => s.id === gekozen);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-4 text-center">
      <h2 className="text-4xl font-black">Wie wordt de challenger?</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {spelers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setLicht(s.id);
              setGekozen(s.id);
            }}
            className={`rounded-2xl px-5 py-3 text-xl font-semibold shadow-sm transition ${licht === s.id ? 'scale-110 bg-amber-300 ring-4 ring-amber-500' : 'bg-surface hover:bg-slate-50'}`}
            data-kandidaat
          >
            {schermNaam(s)}
          </button>
        ))}
        {spelers.length === 0 && <p className="text-slate-500">Nog niemand verbonden.</p>}
      </div>
      {naam ? (
        <div className="pop mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-indigo-700 to-purple-800 p-8 text-white shadow-lg">
          <div className="text-5xl font-black">{schermNaam(naam)} neemt het op tegen de klas!</div>
          <p className="mt-3 text-lg opacity-90">
            De klas antwoordt eerst, dan {schermNaam(naam)} alleen. Juist? Wie in de klas fout was, vliegt eruit. Fout? Een hart minder. Wie eruit ligt, komt
            terug met twee juiste antwoorden na elkaar.
          </p>
          <Button variant="primary" className="mt-5 px-8 py-3 text-lg" disabled={bezig} onClick={() => onKies(naam.id)}>
            ▶ Eerste vraag
          </Button>
        </div>
      ) : (
        <Button variant="primary" className="px-8 py-3 text-lg" disabled={spelers.length === 0} onClick={spotlicht}>
          🔦 Spotlicht
        </Button>
      )}
    </div>
  );
}

function ChallengerKaart(p: {
  naam: string;
  harten: number;
  max: number;
  score: number;
  hulpOver: Hulplijn[];
  kanKiezen: boolean;
  inzetOver: boolean;
  inzet: boolean;
  tweedeKans: boolean;
  onHulp: (h: Hulplijn) => void;
  onInzet: () => void;
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-indigo-800 to-purple-900 p-5 text-white shadow-lg ring-2 ring-amber-300/60" data-challenger>
      <div className="text-xs font-bold tracking-[0.3em] text-amber-300 uppercase">Challenger</div>
      <div className="mt-1 text-4xl font-black break-words">{p.naam}</div>
      <div className="mt-2 text-2xl" aria-label={`${p.harten} harten`}>
        {'❤️'.repeat(p.harten)}
        {'🖤'.repeat(Math.max(0, p.max - p.harten))}
      </div>
      <div className="mt-1 text-xl font-semibold">⭐ {p.score}</div>
      <div className="mt-4 space-y-2">
        {HULPLIJNEN.map((h) => {
          const over = p.hulpOver.includes(h.id);
          const actief = h.id === 'tweede' && p.tweedeKans;
          return (
            <button
              key={h.id}
              type="button"
              disabled={!over || !p.kanKiezen}
              onClick={() => p.onHulp(h.id)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold transition ${actief ? 'bg-amber-400 text-slate-900' : over ? 'bg-white/15 hover:bg-white/25 disabled:opacity-60' : 'bg-white/5 text-white/30 line-through'}`}
            >
              <span className="text-xl">{h.icoon}</span>
              {h.naam}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!p.inzetOver || !p.kanKiezen}
          onClick={p.onInzet}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold transition ${p.inzet ? 'bg-amber-400 text-slate-900' : p.inzetOver ? 'bg-white/15 hover:bg-white/25 disabled:opacity-60' : 'bg-white/5 text-white/30 line-through'}`}
        >
          <span className="text-xl">💰</span>
          Inzet ×2
        </button>
      </div>
    </div>
  );
}

function StatusLijn(p: {
  server: LiveSessie;
  cv: ChallengerVraag;
  naam: string;
  beantwoord: number;
  totaal: number;
  resterend: number | null;
  vergrendeld: boolean;
  uitslag: Uitslag | undefined;
  bezig: boolean;
  onChallenger: () => void;
  onVolgende: () => void;
}) {
  const klasse = 'flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 text-2xl font-semibold';
  if (p.server.status === 'antwoord' && p.uitslag) {
    return (
      <div className={`${klasse} ${p.uitslag.challengerJuist ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`} data-uitslag>
        <span className="flex-1">{p.uitslag.tekst}</span>
        <Button variant="primary" className="px-6 py-3 text-lg" disabled={p.bezig} onClick={p.onVolgende}>
          {p.uitslag.einde ? 'Tussenstand ▶' : 'Volgende vraag ▶'}
        </Button>
      </div>
    );
  }
  if (p.cv.fase === 'klas') {
    return (
      <div className={`${klasse} bg-sky-100`}>
        <span className="flex-1">
          Klas, antwoord op je laptop · {p.beantwoord}/{p.totaal}
        </span>
        {p.resterend !== null && <span className="font-mono">⏱ {Math.max(0, p.resterend)} s</span>}
        <Button disabled={p.bezig} onClick={p.onChallenger}>
          Nu de challenger ▶
        </Button>
      </div>
    );
  }
  return (
    <div className={`${klasse} bg-amber-100`}>
      {p.vergrendeld ? (
        <span className="animate-pulse">🔒 Laatste antwoord van {p.naam}…</span>
      ) : (
        <span>
          {p.naam}, {p.cv.fase === 'tweede' ? 'je tweede kans: ' : ''}antwoord op je laptop{p.cv.inzet ? ' (inzet ×2)' : ''}
        </span>
      )}
    </div>
  );
}

/** Onthulling: het juiste antwoord, per optie hoeveel uit de klas het kozen, en wat de challenger koos. */
function Onthulling({ vraag, antwoorden, challenger }: { vraag: Vraag; antwoorden: LiveAntwoord[]; challenger: LiveAntwoord[] }) {
  if (!isKeuzeVraag(vraag)) {
    const juist = antwoorden.filter((a) => a.juist).length;
    return (
      <div>
        <VraagWeergave vraag={vraag} groot getoond />
        <div className="mt-4 text-2xl">
          Juiste antwoord: <RichText text={oplossingVan(vraag).antwoord} className="inline font-semibold" />
        </div>
        <div className="mt-2 text-xl text-slate-600">
          ✓ {juist} · ✗ {antwoorden.length - juist} in de klas
        </div>
      </div>
    );
  }
  const keuzeChallenger = new Set(challenger.map((a) => Number(a.antwoord)));
  return (
    <div>
      <RichText text={vraag.tekst} className="text-4xl leading-snug font-medium" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {keuzeOpties(vraag).map((o, i) => {
          if (!o.trim()) return null;
          const juist = i === vraag.juisteOptie;
          const aantal = antwoorden.filter((a) => Number(a.antwoord) === i).length;
          return (
            <div key={i} className={`flex items-center gap-4 rounded-2xl border-2 px-6 py-5 text-3xl ${juist ? 'border-emerald-500 bg-emerald-100' : 'border-slate-200 bg-surface opacity-60'}`} data-optie={i}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-800 text-2xl font-bold text-white">{LETTERS[i]}</span>
              <RichText text={o} className="flex-1" />
              {keuzeChallenger.has(i) && <span title="Keuze van de challenger">⚔️</span>}
              <span className="font-mono text-2xl font-bold">
                {juist ? '✓' : ''} {aantal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Rechts: wie nog in de klas zit en wie in de Comeback Zone. */
function Groepen({ toestand, spelers }: { toestand: Toestand; spelers: LiveSpeler[] }) {
  const klas = spelers.filter((s) => s.id !== toestand.challengerId && !(s.id in toestand.zone));
  const zone = spelers.filter((s) => s.id in toestand.zone);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface p-4 shadow-sm">
        <div className="text-lg font-bold">{klas.length} in de klas</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {klas.map((s) => (
            <span key={s.id} className="rounded-full bg-indigo-100 px-2.5 py-1 text-sm font-medium text-indigo-900">
              {schermNaam(s)}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-slate-200/70 p-4">
        <div className="text-lg font-bold">{zone.length} in de Comeback Zone</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {zone.map((s) => (
            <span key={s.id} className="rounded-full bg-slate-300 px-2.5 py-1 text-sm font-medium text-slate-700" title="juist na elkaar">
              {schermNaam(s)} {'●'.repeat(toestand.zone[s.id] ?? 0)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "GET OUT, NAAM!" en "COMEBACK, NAAM!" als meldingen die langs de zijkant binnenkomen (zonder het bord te storen). */
function Uitroepen({ uitslag, namen }: { uitslag: Uitslag; namen: Record<string, string> }) {
  const lijst = useMemo(
    () => [...uitslag.getOut.map((id) => ({ tekst: `GET OUT, ${namen[id] ?? '?'}!`, uit: true })), ...uitslag.comeback.map((id) => ({ tekst: `COMEBACK, ${namen[id] ?? '?'}!`, uit: false }))],
    [uitslag, namen],
  );
  // Na elkaar binnenkomen, en na een tijdje weer weg.
  const [aantal, setAantal] = useState(0);
  const [weg, setWeg] = useState(false);
  useEffect(() => {
    if (aantal < lijst.length) {
      const t = window.setTimeout(() => setAantal((x) => x + 1), 350);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setWeg(true), 6000);
    return () => window.clearTimeout(t);
  }, [aantal, lijst.length]);
  if (weg || lijst.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-20 z-40 flex max-h-[70vh] flex-col items-end gap-2 overflow-hidden" data-uitroep>
      {lijst.slice(0, aantal).map((m, i) => (
        <div key={i} className={`melding rounded-xl px-4 py-2 text-lg font-bold text-white shadow-lg ${m.uit ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {m.tekst}
        </div>
      ))}
    </div>
  );
}

function Tussenstand({ stand, uitslag, onVolgende, onEinde }: { stand: StandRij[]; uitslag: Uitslag | null; onVolgende: () => void; onEinde: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 py-4">
      {uitslag && <div className="rounded-2xl bg-indigo-100 px-5 py-4 text-center text-2xl font-semibold text-indigo-900">{uitslag.tekst}</div>}
      <h2 className="text-center text-3xl font-black">Tussenstand</h2>
      <ol className="space-y-2">
        {stand.slice(0, 10).map((r, i) => (
          <li key={r.id ?? r.naam} className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-2 text-xl shadow-sm">
            <span className="w-8 font-bold text-slate-500">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
            <span className="flex-1 font-semibold">{r.naam}</span>
            <span className="font-mono font-bold">{r.punten}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-center gap-3">
        <Button variant="primary" className="px-8 py-3 text-lg" onClick={onVolgende}>
          Volgende challenger ▶
        </Button>
        <Button onClick={onEinde}>🏁 Spel beëindigen</Button>
      </div>
    </div>
  );
}

function ChallengerEinde({ sessie, onAfsluiten, onBewaar, onVerwijder }: { sessie: Sessie; onAfsluiten?: () => Promise<void>; onBewaar: () => void; onVerwijder: () => void }) {
  const ranking = sessie.live?.eindstand ?? [];
  const t = sessie.live?.challenger?.toestand;
  const podium = ranking.slice(0, 3);
  return (
    <div className="mx-auto w-full max-w-4xl py-6">
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
      {t && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" data-weetjes>
          <Weetje titel="Meeste GET OUTs in één beurt" waarde={t.meesteKnockouts ? `${t.meesteKnockouts.aantal}` : '–'} />
          <Weetje titel="Langste beurt" waarde={t.langsteBeurt ? `${t.langsteBeurt.vragen} vragen` : '–'} />
          <Weetje titel="Keren dat de klas won" waarde={`${t.klasZeges}`} />
        </div>
      )}
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Punten</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{r.naam}</td>
              <td className="px-4 py-2 text-right font-mono">{r.punten}</td>
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

function Weetje({ titel, waarde }: { titel: string; waarde: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 text-center shadow-sm">
      <div className="text-sm text-slate-500">{titel}</div>
      <div className="mt-1 text-2xl font-bold">{waarde}</div>
    </div>
  );
}
