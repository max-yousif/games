import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EindScherm } from '../components/EindScherm';
import { RichText } from '../components/RichText';
import { Button, Notice } from '../components/ui';
import { VraagWeergave } from '../components/VraagWeergave';
import { BomSpel, type BomFase } from '../games/BomSpel';
import { QuizBord } from '../games/QuizBord';
import { VierOpEenRij, wachtOpZet, zetSchijf } from '../games/VierOpEenRij';
import { bomWinnaar } from '../lib/bom';
import { bouwRooster, KOLOMMEN, vrijeRij, winnaar } from '../lib/connectFour';
import { speel } from '../lib/geluid';
import { bordIndeling } from '../lib/questions';
import { beeindig, gespeeldeVragen, teamAanDeBeurt, teamScores, voegBeurtToe, volgendeVraag } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { isKeuzeVraag } from '../lib/vraagtypes';
import { backend } from './config';
import { Wachtruimte } from './LiveHost';
import { automatischJuist, oplossingVan, publiekeVraag, schermNaam } from './logic';
import {
  beginTeambord,
  geenVraag,
  kiezer,
  meerderheid,
  uitslagTekst,
  verdeelSpelers,
  type TeambordFase,
  type TeambordSpel,
  type TeambordToestand,
  type TeambordUitslag,
  type TeambordVraag,
} from './teambord';
import { LiveFout, type LiveAntwoord, type LiveSessie, type LiveSpeler, type PubliekeVraag, type StandRij } from './types';

type Props = { sessie: Sessie; onUpdate: (s: Sessie) => void; onBewaar: () => void; onVerwijder: () => void };

/** Winnaar voor het eindscherm: vier op een rij en bom hebben eigen regels, het quizbord de punten. */
export function teambordWinnaar(s: Sessie): number | null | undefined {
  if (s.spelType === 'vieropeenrij') return winnaar(bouwRooster(s.zetten))?.team ?? null;
  if (s.spelType === 'bom') return bomWinnaar(s);
  return undefined;
}

/** Quizbord, vier op een rij of bom op het bord, met de antwoorden van de laptops. */
export function TeambordHost(props: Props) {
  const { sessie } = props;
  if (sessie.live!.afgesloten) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EindScherm sessie={sessie} winnaar={teambordWinnaar(sessie)} onBewaar={props.onBewaar} onVerwijder={props.onVerwijder} />
      </div>
    );
  }
  return <TeambordActief {...props} />;
}

function TeambordActief({ sessie, onUpdate, onBewaar, onVerwijder }: Props) {
  const live = sessie.live!;
  const spel = sessie.spelType as TeambordSpel;
  const be = backend(live.backend);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  const toestand = live.teambord ?? beginTeambord();
  const huidigeToestand = () => sessieRef.current.live?.teambord ?? beginTeambord();
  /** De sessie en/of de toestand bijwerken (altijd op de nieuwste versie). */
  const pas = useCallback(
    (f: (s: Sessie, t: TeambordToestand) => { s?: Sessie; t?: Partial<TeambordToestand> }) => {
      const s0 = sessieRef.current;
      const t0 = s0.live?.teambord ?? beginTeambord();
      const { s = s0, t = {} } = f(s0, t0);
      const nieuw = { ...s, live: { ...s.live!, teambord: { ...t0, ...t } } };
      sessieRef.current = nieuw;
      onUpdate(nieuw);
    },
    [onUpdate],
  );

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

  // Teams van de spelers (via de klaslijst); wie later binnenkomt, krijgt er ook een.
  useEffect(() => {
    const t0 = huidigeToestand();
    const teamVan = verdeelSpelers(spelers, sessieRef.current.teams, sessieRef.current.live?.namen, t0.teamVan);
    if (Object.keys(teamVan).length !== Object.keys(t0.teamVan).length) pas(() => ({ t: { teamVan } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spelers, pas]);

  const namen = useMemo(() => Object.fromEntries(spelers.map((s) => [s.id, schermNaam(s)])), [spelers]);
  const leden = (team: number) => spelers.filter((s) => s.verbonden && toestand.teamVan[s.id] === team).map((s) => s.id);
  const scores = teamScores(sessie);

  // Ranglijst voor de laptops: per speler het team en de score van het team.
  const stand: StandRij[] = useMemo(
    () =>
      spelers
        .filter((s) => s.id in toestand.teamVan)
        .map((s) => {
          const team = toestand.teamVan[s.id];
          return { id: s.id, naam: schermNaam(s), punten: scores[team] ?? 0, juist: 0, team, ...(sessie.bom ? { ontploffingen: sessie.bom.ontploffingen[team] } : {}) };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spelers, toestand.teamVan, scores.join(','), sessie.bom?.ontploffingen.join(',')],
  );
  const standJson = JSON.stringify(stand);
  const verstuurdeStand = useRef('');
  useEffect(() => {
    if (!server || server.status === 'einde' || standJson === verstuurdeStand.current) return;
    verstuurdeStand.current = standJson;
    void be.wijzigSessie(live.sessieId, { stand }).catch(() => (verstuurdeStand.current = ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standJson, server?.status]);

  const basis = (fase: TeambordFase, team: number): TeambordVraag => ({
    spel,
    fase,
    team,
    teams: sessieRef.current.teams.map((t) => ({ naam: t.naam, kleur: t.kleur })),
    scores: teamScores(sessieRef.current),
  });

  /** Een stap naar de laptops sturen, met het volgende nummer. */
  async function stuur(vraag: PubliekeVraag, tv: TeambordVraag, huidig?: Omit<NonNullable<TeambordToestand['huidig']>, 'nr'>) {
    const nr = huidigeToestand().nr;
    await be.startVraag(live.sessieId, nr, { ...vraag, teambord: tv });
    pas((_, t) => ({ t: { nr: nr + 1, gestart: true, huidig: huidig ? { ...huidig, nr } : t.huidig } }));
  }

  /** Quizbord: één teamlid kiest een vak. */
  async function startKiezen(team: number) {
    const s = sessieRef.current;
    const id = kiezer(leden(team), huidigeToestand().gekozen);
    const gespeeld = gespeeldeVragen(s);
    const vakken = bordIndeling(s.vragen).flatMap((k) => k.vragen.map((v) => ({ id: v.id, categorie: k.categorie, punten: v.punten, vrij: !gespeeld.has(v.id) })));
    await stuur(geenVraag(), { ...basis('kiezen', team), ...(id ? { kiezerId: id, kiezerNaam: namen[id] } : {}), vakken });
    if (id) pas((_, t) => ({ t: { gekozen: { ...t.gekozen, [id]: (t.gekozen[id] ?? 0) + 1 } } }));
  }

  /** Vier op een rij: één teamlid laat de schijf vallen. */
  async function startZet(team: number) {
    const id = kiezer(leden(team), huidigeToestand().gekozen);
    const rooster = bouwRooster(sessieRef.current.zetten);
    const kolommen = Array.from({ length: KOLOMMEN }, (_, k) => vrijeRij(rooster, k) !== null);
    await stuur(geenVraag(), { ...basis('zet', team), ...(id ? { kiezerId: id, kiezerNaam: namen[id] } : {}), kolommen });
    if (id) pas((_, t) => ({ t: { gekozen: { ...t.gekozen, [id]: (t.gekozen[id] ?? 0) + 1 } } }));
  }

  /** De vraag naar alle laptops; enkel het team aan de beurt telt. */
  const startVraag = (v: Vraag, team: number, sleutel = sessieRef.current.beurten.length) =>
    stuur(publiekeVraag(v), { ...basis('vraag', team), ...(sessieRef.current.timer && spel !== 'bom' ? { tijd: sessieRef.current.timer } : {}) }, { vraagId: v.id, team, sleutel });

  // Wat er nu op de laptops loopt.
  const tv = server?.status === 'vraag' || server?.status === 'antwoord' ? server.vraag?.teambord : undefined;
  const huidig = toestand.huidig;
  const vraag = huidig ? (sessie.vragen.find((v) => v.id === huidig.vraagId) ?? null) : null;
  const opDezeVraag = server ? antwoorden.filter((a) => a.vraagNr === server.vraagNr) : [];

  // Klok voor de tijd per vraag.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const resterend = tv?.fase === 'vraag' && tv.tijd && server?.vraagStart ? Math.ceil((new Date(server.vraagStart).getTime() + tv.tijd * 1000 - nu) / 1000) : null;
  const [afsluiten, setAfsluiten] = useState<number | null>(null);

  // Het team aan de beurt: hoeveel juist, fout en wie nog moet.
  const teamNu = tv?.fase === 'vraag' ? tv.team : -1;
  const teamleden = teamNu >= 0 ? leden(teamNu) : [];
  const teamAntwoorden = opDezeVraag.filter((a) => teamleden.includes(a.spelerId));
  const aantalJuist = vraag ? teamAntwoorden.filter((a) => automatischJuist(vraag, a.antwoord)).length : 0;

  const [bomUitslag, setBomUitslag] = useState<{ sleutel: number; juist: boolean } | null>(null);
  const afgehandeld = useRef(new Set<string>());

  async function beslis(juist: boolean) {
    const s = sessieRef.current;
    const h = huidigeToestand().huidig;
    const v = h && s.vragen.find((x) => x.id === h.vraagId);
    if (!server || !h || !v || h.nr !== server.vraagNr) return;
    const items = opDezeVraag.map((a) => ({ id: a.id, juist: automatischJuist(v, a.antwoord), punten: 0 }));
    const uitslag: TeambordUitslag = { team: h.team, juist, aantalJuist, aantal: teamleden.length, tekst: uitslagTekst(s.teams[h.team].naam, juist, aantalJuist, teamleden.length) };
    if (items.length) await be.beoordeel(live.sessieId, items);
    await be.wijzigSessie(live.sessieId, { status: 'antwoord', oplossing: { ...oplossingVan(v), teambord: uitslag } });
    speel(juist ? 'juist' : 'fout');
    if (spel === 'bom') {
      setBomUitslag({ sleutel: h.sleutel, juist });
      return;
    }
    let na = voegBeurtToe(s, { vraagId: v.id, team: h.team, leerlingId: null, juist, punten: juist ? (spel === 'quizbord' ? v.punten : 1) : 0 });
    if (spel === 'quizbord' && gespeeldeVragen(na).size >= na.vragen.length) na = beeindig(na);
    pas(() => ({ s: na }));
  }

  // Antwoorden van de laptops verwerken: een keuze, een schijf of de meerderheid van het team.
  useEffect(() => {
    if (!server || server.status !== 'vraag' || !tv) return;
    const sleutel = `${server.vraagNr}`;
    if (afgehandeld.current.has(sleutel)) return;
    if (tv.fase === 'kiezen' || tv.fase === 'zet') {
      const keuze = opDezeVraag.find((a) => a.spelerId === tv.kiezerId);
      if (!keuze) return;
      afgehandeld.current.add(sleutel);
      if (tv.fase === 'kiezen') {
        const v = sessieRef.current.vragen.find((x) => x.id === keuze.antwoord);
        if (v && !gespeeldeVragen(sessieRef.current).has(v.id)) void actie(() => startVraag(v, tv.team));
        else afgehandeld.current.delete(sleutel);
      } else {
        const na = zetSchijf(sessieRef.current, Number(keuze.antwoord));
        if (na) pas(() => ({ s: na }));
      }
      return;
    }
    if (!vraag || !huidig || huidig.nr !== server.vraagNr) return;
    const klaar = afsluiten === server.vraagNr || (resterend !== null && resterend <= -1);
    const uit = meerderheid(aantalJuist, teamAntwoorden.length - aantalJuist, teamleden.length, klaar);
    if (uit === null) return;
    afgehandeld.current.add(sleutel);
    void actie(async () => {
      try {
        await beslis(uit);
      } catch (e) {
        afgehandeld.current.delete(sleutel);
        throw e;
      }
    });
  });

  // Vier op een rij: na een schijf (van de laptop of op het bord) meteen de vraag voor het volgende team.
  const zetten = sessie.zetten.length;
  const vorigeZetten = useRef(zetten);
  useEffect(() => {
    if (zetten <= vorigeZetten.current) {
      vorigeZetten.current = zetten;
      return;
    }
    vorigeZetten.current = zetten;
    if (spel !== 'vieropeenrij' || sessieRef.current.beeindigd) return;
    const t = window.setTimeout(() => {
      const s = sessieRef.current;
      const v = volgendeVraag(s);
      if (v && !s.beeindigd) void actie(() => startVraag(v, teamAanDeBeurt(s)));
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zetten]);

  // Bom: elke nieuwe vraag naar de laptops; bij een ontploffing de laptops verwittigen.
  const gestarteBom = useRef<number | null>(null);
  const geknald = useRef(-1);
  const bomFase = useCallback(
    (fase: BomFase, v: Vraag | null, sleutel: number) => {
      const s = sessieRef.current;
      if (fase === 'tikt' && v && gestarteBom.current !== sleutel) {
        gestarteBom.current = sleutel;
        setBomUitslag(null);
        void actie(() => startVraag(v, s.bom!.houder, sleutel));
      }
      if (fase === 'boem' && s.bom && geknald.current !== s.bom.ronde) {
        geknald.current = s.bom.ronde;
        gestarteBom.current = null;
        const team = s.bom.houder;
        void actie(() =>
          be.wijzigSessie(live.sessieId, {
            status: 'antwoord',
            oplossing: { juisteOptie: null, antwoord: '', uitleg: '', teambord: { team, juist: false, aantalJuist: 0, aantal: 0, boem: true, tekst: `💥 BOEM bij ${s.teams[team].naam}!` } },
          }),
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [be, live.sessieId],
  );

  // Het einde naar de laptops, met de winnaar.
  const eindeGemeld = useRef(false);
  useEffect(() => {
    if (!sessie.beeindigd || !server || server.status === 'einde' || eindeGemeld.current) return;
    eindeGemeld.current = true;
    const w = teambordWinnaar(sessie);
    const sc = teamScores(sessie);
    const beste = w ?? (w === null ? 0 : sc.indexOf(Math.max(...sc)));
    const gelijk = w === null || (w === undefined && sc.filter((x) => x === sc[beste]).length > 1);
    const tekst = gelijk ? 'Gelijkspel!' : `🏆 ${sessie.teams[beste].naam} wint!`;
    void be
      .wijzigSessie(live.sessieId, { status: 'einde', stand, oplossing: { juisteOptie: null, antwoord: '', uitleg: '', teambord: { team: beste, juist: true, aantalJuist: 0, aantal: 0, tekst } } })
      .catch(() => (eindeGemeld.current = false));
  });

  const serverWissen = async () => {
    onUpdate({ ...sessieRef.current, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  function start() {
    void actie(async () => {
      const s = sessieRef.current;
      if (spel === 'quizbord') await startKiezen(0);
      else if (spel === 'vieropeenrij') {
        const v = volgendeVraag(s);
        if (v) await startVraag(v, 0);
      } else pas(() => ({ t: { gestart: true } }));
    });
  }

  function volgende() {
    void actie(async () => {
      const s = sessieRef.current;
      if (s.beeindigd) return;
      if (spel === 'quizbord') await startKiezen(teamAanDeBeurt(s));
      else if (spel === 'vieropeenrij') {
        const zet = wachtOpZet(s);
        if (zet !== null) await startZet(zet);
        else {
          const v = volgendeVraag(s);
          if (v) await startVraag(v, teamAanDeBeurt(s));
        }
      }
    });
  }

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

  if (sessie.beeindigd) {
    return (
      <div className="flex-1 overflow-y-auto">
        <EindScherm sessie={sessie} winnaar={teambordWinnaar(sessie)} serverWissen={serverWissen} onBewaar={onBewaar} onVerwijder={onVerwijder} />
      </div>
    );
  }

  if (!toestand.gestart) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8">
        {fout && <Notice tone="warn">{fout}</Notice>}
        <Wachtruimte sessie={sessie} spelers={spelers} bezig={bezig} startTekst="Start" onStart={start} onOntkoppel={(id) => void actie(() => be.ontkoppel(id))} onWisBijnaam={(id) => void actie(() => be.wisBijnaam(id))} />
        <Teams sessie={sessie} spelers={spelers} teamVan={toestand.teamVan} />
      </div>
    );
  }

  const vraagOpen = (tv?.fase === 'vraag' || (server.status === 'antwoord' && !!server.oplossing?.teambord && !server.oplossing.teambord.boem)) && !!vraag;
  const uitslag = server.status === 'antwoord' ? server.oplossing?.teambord : undefined;
  const teller = teamNu >= 0 && (
    <span className="text-xl font-semibold" style={{ color: sessie.teams[teamNu].kleur }} data-teller>
      💻 {sessie.teams[teamNu].naam}: {teamAntwoorden.length}/{teamleden.length} geantwoord
      {resterend !== null && <span className="ml-3 font-mono text-slate-600">⏱ {Math.max(0, resterend)} s</span>}
      <button type="button" className="ml-3 rounded-lg bg-slate-100 px-3 py-1 text-base text-slate-700 hover:bg-slate-200" onClick={() => setAfsluiten(server.vraagNr)}>
        Afsluiten
      </button>
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-4 px-6 pb-2">
        <span className="font-mono text-slate-500">code {live.code}</span>
        {fout && <span className="text-red-600">{fout}</span>}
        {server.status === 'vraag' && (tv?.fase === 'kiezen' || tv?.fase === 'zet') && (
          <span className="text-xl font-semibold" style={{ color: sessie.teams[tv.team].kleur }} data-kiezer>
            💻 {tv.kiezerNaam ?? sessie.teams[tv.team].naam} {tv.fase === 'kiezen' ? 'kiest een vak' : 'kiest een kolom'}…
          </span>
        )}
      </div>

      {spel === 'quizbord' && <QuizBord sessie={sessie} onUpdate={onUpdate} onKies={(v) => !bezig && !vraagOpen && void actie(() => startVraag(v, teamAanDeBeurt(sessieRef.current)))} />}
      {spel === 'vieropeenrij' && (
        <VierOpEenRij
          sessie={sessie}
          onUpdate={(s) => pas(() => ({ s }))}
          vraagBezig={vraagOpen || bezig}
          onVraag={() => {
            const v = volgendeVraag(sessieRef.current);
            if (v) void actie(() => startVraag(v, teamAanDeBeurt(sessieRef.current)));
          }}
        />
      )}
      {spel === 'bom' && <BomSpel sessie={sessie} onUpdate={(s) => pas(() => ({ s }))} laptop={{ uitslag: bomUitslag, status: teller, onFase: bomFase }} />}

      {spel !== 'bom' && vraagOpen && vraag && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-6">
          <div className="flex max-h-full w-full max-w-5xl flex-col overflow-y-auto rounded-3xl bg-surface p-8 shadow-2xl" data-vraagpaneel>
            <div className="mb-4 text-2xl font-bold" style={{ color: sessie.teams[huidig!.team].kleur }}>
              {sessie.teams[huidig!.team].naam} {spel === 'quizbord' && <span className="text-slate-500">· {vraag.punten} punten</span>}
            </div>
            <VraagWeergave vraag={vraag} groot getoond={!!uitslag} />
            {uitslag && !isKeuzeVraag(vraag) && (
              <div className="pop mt-6 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-6 py-4">
                <RichText text={oplossingVan(vraag).antwoord} className="text-3xl font-semibold" />
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {uitslag ? (
                <>
                  <span className={`pop text-3xl font-bold ${uitslag.juist ? 'text-emerald-600' : 'text-red-600'}`} data-uitslag>
                    {uitslag.tekst}
                  </span>
                  <Button variant="primary" className="ml-auto px-8 py-3 text-lg" disabled={bezig} onClick={volgende}>
                    Volgende ▶
                  </Button>
                </>
              ) : (
                teller
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** In de wachtruimte: wie in welk team zit (en wie al binnen is). */
function Teams({ sessie, spelers, teamVan }: { sessie: Sessie; spelers: LiveSpeler[]; teamVan: Record<string, number> }) {
  return (
    <div className="mx-auto mt-6 grid w-full max-w-5xl gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(sessie.teams.length, 3)}, minmax(0, 1fr))` }}>
      {sessie.teams.map((t, i) => (
        <div key={i} className="rounded-2xl border-4 bg-surface p-4" style={{ borderColor: t.kleur }}>
          <div className="text-xl font-bold" style={{ color: t.kleur }}>
            {t.naam}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {spelers
              .filter((s) => s.verbonden && teamVan[s.id] === i)
              .map((s) => (
                <span key={s.id} className="rounded-full px-3 py-1 font-medium text-white" style={{ background: t.kleur }}>
                  {schermNaam(s)}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
