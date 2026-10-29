import { useMemo, useState } from 'react';
import { isKeuzeVraag } from '../lib/vraagtypes';
import { GeluidMenu } from '../components/GeluidMenu';
import { Button, inputClass, labelClass, Notice, PageHeader, Section } from '../components/ui';
import { backend, supabaseIngesteld } from '../live/config';
import { AANTAL_NUMMERS } from '../live/codekraker';
import { STANDAARD_THEMA, themaProblemen, trekOplossing } from '../live/cluedo';
import { KLEURPLATEN, STANDAARD_SECONDEN, TEKENTIJDEN, type TerritoriumModus } from '../live/territorium';
import { CluedoThemaEditor } from '../components/CluedoThemaEditor';
import { maakEscapeCode } from '../live/escape';
import { nieuwRaadsel, publiekRaadsel, raadselProblemen } from '../live/whodunit';
import { publiekeVraag } from '../live/logic';
import { LiveFout } from '../live/types';
import { speelbareVragen, vakkenVan } from '../lib/questions';
import { ga, href } from '../lib/route';
import { shuffle } from '../lib/random';
import { maakTeams, nieuweSessie, TEAM_KLEUREN } from '../lib/session';
import { korteNamen, naamVolgordeVan } from '../lib/students';
import type { Store } from '../lib/store';
import type { CluedoThema, Leerling, SpelType, Team } from '../lib/types';
import { VraagKeuze } from '../components/VraagKeuze';
import { jarenVanSet, VAK_LABELS } from './SetsPage';
import { klasJaar } from './KlassenPage';
import { BOM_TIJDEN, nieuweBom, type BomTijd } from '../lib/bom';

const SPELLEN: { type: SpelType; icoon: string; naam: string; tekst: string }[] = [
  { type: 'quizbord', icoon: '🟦', naam: 'Quizbord', tekst: 'Categorieën × punten. Teams kiezen om beurt een vak. 2 tot 6 teams.' },
  { type: 'vieropeenrij', icoon: '🔴', naam: 'Vier op een rij', tekst: 'Juist antwoord = een schijf laten vallen. Precies 2 teams.' },
  { type: 'bom', icoon: '💣', naam: 'Bom doorgeven', tekst: 'Juist antwoord = bom naar het volgende team. Alle vragen komen aan bod; de minste ontploffingen wint.' },
  { type: 'live', icoon: '💻', naam: 'Live quiz', tekst: 'Elke leerling speelt op de eigen laptop; jij volgt live mee op het bord.' },
  { type: 'escape', icoon: '🗝️', naam: 'Escape room', tekst: 'Elke leerling opent sloten door vragen op te lossen; de cijfers vormen de code om te ontsnappen.' },
  { type: 'codekraker', icoon: '🔐', naam: 'Crypto Hack', tekst: 'Elke leerling verdient munten met juiste antwoorden, opent kistjes en hackt elkaars wachtwoord.' },
  { type: 'territorium', icoon: '🖌️', naam: 'Territorium', tekst: 'Juist antwoord = even tekenen in je eigen kleur. Tegen elkaar het meeste gebied, of samen een tekening inkleuren.' },
  { type: 'cluedo', icoon: '🔎', naam: 'Cluedo', tekst: 'Wie, waar en waarmee? Elk juist antwoord streept een verdachte, plaats of wapen weg. Wie lost de moord als eerste op?' },
  { type: 'whodunit', icoon: '🕵️', naam: 'Whodunit', tekst: 'Een logisch raadsel: elke juiste oefening geeft een hint. Wie vult als eerste de tabel juist in?' },
];

const BORD_SPELLEN: SpelType[] = ['quizbord', 'vieropeenrij', 'bom'];
const LIVE_SPELLEN: SpelType[] = ['live', 'escape', 'codekraker', 'territorium', 'cluedo', 'whodunit'];
const VAK_ICONEN: Partial<Record<string, string>> = { wiskunde: '📐', python: '🐍', ict: '💻', andere: '📚' };

const ESCAPE_MINUTEN = [null, 10, 15, 20, 30, 45, 60];
const WACHTTIJDEN = [0, 10, 15, 30, 60];
/** Escape room: straftijd na een foute code (seconden). */
const STRAFTIJDEN = [30, 60, 120, 180];

const TIMERS = [null, 30, 60, 90, 120, 180];

type Stap = 1 | 2 | 3 | 4;

export function SpelenPage({ setId, store }: { setId?: string; store: Store }) {
  // Niets vooraf gekozen: zo kan je niet per ongeluk met de verkeerde vragenset of klas starten.
  const [stap, setStap] = useState<Stap>(1);
  const [gekozenSet, setGekozenSet] = useState(setId ?? '');
  const [spel, setSpel] = useState<SpelType | null>(null);
  // null = nog niet gekozen, '' = zonder klas.
  const [klasId, setKlasId] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');
  const [jaar, setJaar] = useState(0);
  const [aantal, setAantal] = useState(2);
  const [timer, setTimer] = useState<number | null>(null);
  const [snelheidsbonus, setSnelheidsbonus] = useState(true);
  const [willekeurig, setWillekeurig] = useState(false);
  const [vrijeNaam, setVrijeNaam] = useState(false);
  const [dubbel, setDubbel] = useState(true);
  // Zonder live server (enkel bij het testen van de website) speelt alles in deze browser.
  const demo = !supabaseIngesteld;
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const klas = store.klassen.find((k) => k.id === klasId) ?? null;
  const set = store.sets.find((s) => s.id === gekozenSet) ?? null;
  const alleVragen = set ? speelbareVragen(set) : [];
  // Vragen die niet meedoen in dit spel (de vragenset zelf blijft ongewijzigd).
  const [uit, setUit] = useState<Set<string>>(new Set());
  const vragen = alleVragen.filter((v) => !uit.has(v.id));
  // Escape room: enkel vragen met keuzes (elk antwoord geeft een cijfer).
  const escapeVragen = vragen.filter(isKeuzeVraag);
  const [bomTijdKeuze, setBomTijdKeuze] = useState<BomTijd>('normaal');
  const isLive = spel === 'live' || spel === 'escape' || spel === 'whodunit' || spel === 'codekraker' || spel === 'cluedo' || spel === 'territorium';
  // Escape room en whodunit: elke leerling werkt in eigen tempo.
  const eigenTempo = spel === 'escape' || spel === 'whodunit' || spel === 'codekraker' || spel === 'cluedo' || spel === 'territorium';
  // Cluedo: het thema voor dit spel (start van het thema van de vragenset, of het standaardthema).
  const [cluedoThema, setCluedoThema] = useState<CluedoThema>(() => store.sets.find((s) => s.id === (setId ?? store.sets[0]?.id))?.cluedo ?? STANDAARD_THEMA);
  const [cluedoSleutel, setCluedoSleutel] = useState(0);
  const laadCluedo = (t: CluedoThema) => {
    setCluedoThema(t);
    setCluedoSleutel((k) => k + 1);
  };
  const cluedoFouten = spel === 'cluedo' ? themaProblemen(cluedoThema) : [];
  const [hacken, setHacken] = useState(true);
  const [tekenSeconden, setTekenSeconden] = useState(STANDAARD_SECONDEN);
  const [territoriumModus, setTerritoriumModus] = useState<TerritoriumModus>('strijd');
  /** Samen inkleuren: de gekozen tekening ('' = willekeurig). */
  const [kleurplaatKeuze, setKleurplaatKeuze] = useState('');
  const raadselFouten = spel === 'whodunit' ? raadselProblemen(set?.raadsel) : [];
  const aantalTeams = spel === 'vieropeenrij' ? 2 : isLive ? 1 : aantal;
  // Op het scherm enkel voornamen (met initiaal bij dezelfde voornaam).
  const naamVolgorde = klas ? naamVolgordeVan(klas.leerlingen.map((l) => l.naam), klas.naamVolgorde) : undefined;
  const kort = useMemo(() => {
    const l = klas?.leerlingen ?? [];
    const k = korteNamen(
      l.map((x) => x.naam),
      naamVolgorde,
    );
    return new Map(l.map((x, i) => [x.id, k[i]]));
  }, [klas, naamVolgorde]);
  const kortNaam = (l: Leerling) => kort.get(l.id) ?? l.naam;
  const [escapeMinuten, setEscapeMinuten] = useState<number | null>(20);
  const [wachttijd, setWachttijd] = useState(15);
  const [aantalSloten, setAantalSloten] = useState(0); // 0 = alle vragen
  const [strafTijd, setStrafTijd] = useState(60);

  const [teams, setTeams] = useState<Team[]>(() => maakTeams(klas?.leerlingen ?? [], aantalTeams));
  const [afwezig, setAfwezig] = useState<Leerling[]>([]);
  const verdeel = (leerlingen = klas?.leerlingen ?? [], n = aantalTeams, zonder = afwezig) => {
    const aanwezig = leerlingen.filter((l) => !zonder.some((a) => a.id === l.id));
    setTeams(maakTeams(aanwezig, n));
  };

  function markeerAfwezig(ti: number, l: Leerling) {
    setTeams((ts) => ts.map((t, i) => (i === ti ? { ...t, leerlingen: t.leerlingen.filter((x) => x.id !== l.id) } : t)));
    setAfwezig((a) => [...a, l]);
  }

  function terugAanwezig(l: Leerling) {
    setAfwezig((a) => a.filter((x) => x.id !== l.id));
    // Bij het kleinste team zetten.
    setTeams((ts) => {
      const kleinste = ts.reduce((best, t, i) => (t.leerlingen.length < ts[best].leerlingen.length ? i : best), 0);
      return ts.map((t, i) => (i === kleinste ? { ...t, leerlingen: [...t.leerlingen, l] } : t));
    });
  }

  /** Klik op een naam: de leerling schuift door naar het volgende team. */
  function verplaats(ti: number, leerlingId: string) {
    setTeams((ts) => {
      if (ts.length < 2) return ts;
      const l = ts[ti].leerlingen.find((x) => x.id === leerlingId)!;
      const doel = (ti + 1) % ts.length;
      return ts.map((t, i) =>
        i === ti ? { ...t, leerlingen: t.leerlingen.filter((x) => x.id !== leerlingId) } : i === doel ? { ...t, leerlingen: [...t.leerlingen, l] } : t,
      );
    });
  }

  function start() {
    if (!set || !spel) return;
    if (isLive) {
      void startLive();
      return;
    }
    const sessie = nieuweSessie({ spelType: spel, set, vragen, klasNaam: klas?.naam ?? 'zonder klas', teams, timer: spel === 'bom' ? null : timer, naamVolgorde, dubbelIndividueel: spel === 'quizbord' && dubbel });
    if (spel === 'bom') sessie.bom = nieuweBom(teams.length, bomTijdKeuze);
    store.bewaarSessie(sessie);
    ga({ pagina: 'sessie', id: sessie.id });
  }

  async function startLive() {
    if (!set || !spel) return;
    setBezig(true);
    setFout(null);
    try {
      const leerlingen = teams.flatMap((t) => t.leerlingen);
      const soort = demo ? 'lokaal' : 'supabase';
      const metNamen = klas !== null && leerlingen.length > 0;
      const escape = eigenTempo;
      const whodunit = spel === 'whodunit';
      const codekraker = spel === 'codekraker';
      const cluedo = spel === 'cluedo';
      const territorium = spel === 'territorium';
      const kleurplaat = territorium && territoriumModus === 'samen' ? kleurplaatKeuze || KLEURPLATEN[Math.floor(Math.random() * KLEURPLATEN.length)].id : undefined;
      // Escape room: een (willekeurige) selectie van de vragen als sloten, in vaste volgorde.
      const gekozen = spel === 'escape' ? (aantalSloten > 0 && aantalSloten < escapeVragen.length ? shuffle(escapeVragen).slice(0, aantalSloten) : escapeVragen) : vragen;
      const escapeCode = spel === 'escape' ? maakEscapeCode(gekozen.length) : undefined;
      const spelTimer = escape ? (escapeMinuten ? escapeMinuten * 60 : null) : timer;
      // Op de server enkel voornamen; de koppeling met de klaslijst blijft hier.
      const namen: Record<string, string[]> = metNamen ? Object.fromEntries(leerlingen.map((l) => [kortNaam(l), [l.id]])) : {};
      const server = await backend(soort).maakSessie({
        titel: set.titel,
        namen: Object.keys(namen),
        vrijeNaam: !metNamen || vrijeNaam,
        // Codekraker: de vragen komen steeds opnieuw; nummers vanaf ACTIE_BASIS zijn acties.
        aantalVragen: codekraker || cluedo || territorium || spel === 'escape' ? AANTAL_NUMMERS : gekozen.length,
        timer: spelTimer,
        modus: escape ? 'escape' : 'quiz',
        vragen: escape ? gekozen.map(publiekeVraag) : undefined,
        wachttijd: spel === 'escape' ? strafTijd : escape ? wachttijd : 0,
        raadsel: whodunit && set.raadsel ? publiekRaadsel(set.raadsel) : undefined,
        codekraker: codekraker ? { hacken } : undefined,
        cluedo: cluedo ? cluedoThema : undefined,
        territorium: territorium ? { versie: 1, seconden: tekenSeconden, ...(kleurplaat ? { modus: 'samen' as const, kleurplaat } : {}) } : undefined,
      });
      const basis = nieuweSessie({
        spelType: whodunit ? 'whodunit' : codekraker ? 'codekraker' : cluedo ? 'cluedo' : territorium ? 'territorium' : escape ? 'escape' : 'live',
        set,
        vragen: gekozen,
        klasNaam: klas?.naam ?? 'zonder klas',
        teams: [{ naam: klas?.naam ?? 'Spelers', kleur: TEAM_KLEUREN[0], leerlingen: metNamen ? leerlingen : [] }],
        timer: spelTimer,
        naamVolgorde,
      });
      const sessie = {
        ...basis,
        ...(whodunit && set.raadsel ? { raadsel: set.raadsel } : {}),
        // De oplossing blijft op deze laptop; de server krijgt enkel het thema.
        ...(cluedo ? { cluedo: { thema: cluedoThema, oplossing: trekOplossing(cluedoThema) } } : {}),
        vraagVolgorde: willekeurig && !escape ? basis.vraagVolgorde : gekozen.map((v) => v.id),
        live: {
          backend: soort,
          sessieId: server.id,
          code: server.code,
          snelheidsbonus: !escape && snelheidsbonus && timer !== null,
          afgesloten: false,
          escapeCode,
          ...(codekraker ? { hacken } : {}),
          ...(territorium ? { tekenSeconden, ...(kleurplaat ? { kleurplaat } : {}) } : {}),
          ...(metNamen ? { namen } : {}),
        },
      } as const;
      store.bewaarSessie(sessie);
      ga({ pagina: 'sessie', id: sessie.id });
    } catch (e) {
      setFout(e instanceof LiveFout ? e.message : 'Het live spel kon niet gestart worden. Controleer de internetverbinding.');
    } finally {
      setBezig(false);
    }
  }

  if (store.sets.length === 0) {
    return (
      <div>
        <PageHeader title="Spelen" />
        <Notice>
          Maak eerst een <a className="underline" href={href({ pagina: 'sets' })}>vragenset</a>.
        </Notice>
      </div>
    );
  }

  const spelInfo = SPELLEN.find((s) => s.type === spel) ?? null;
  const klasGekozen = klasId !== null;

  function kiesSpel(type: SpelType) {
    setSpel(type);
    verdeel(klas?.leerlingen, type === 'vieropeenrij' ? 2 : LIVE_SPELLEN.includes(type) ? 1 : aantal, afwezig);
    if (type === 'live' && timer === null) setTimer(30);
    setStap(klasGekozen ? (set ? 4 : 3) : 2);
  }

  function kiesSet(id: string) {
    setGekozenSet(id);
    setUit(new Set());
    laadCluedo(store.sets.find((s) => s.id === id)?.cluedo ?? STANDAARD_THEMA);
    setStap(4);
  }

  function kiesKlas(id: string) {
    setKlasId(id);
    setAfwezig([]);
    const k = store.klassen.find((x) => x.id === id);
    verdeel(k?.leerlingen ?? [], aantalTeams, []);
    // Vragensets meteen gefilterd op het jaar van de klas.
    setJaar(k ? (klasJaar(k) ?? 0) : 0);
    setStap(set ? 4 : 3);
  }

  // Vragensets: zoeken op titel, leerjaar of vak; recent gewijzigde eerst.
  const zoekterm = zoek.trim().toLowerCase();
  const sets = [...store.sets]
    // Sets zonder jaar passen bij elke klas.
    .filter((s) => !jaar || jarenVanSet(s).length === 0 || jarenVanSet(s).includes(jaar))
    .filter((s) => !zoekterm || `${s.titel} ${s.leerjaar} ${vakkenVan(s).map((v) => VAK_LABELS[v]).join(' ')} ${s.beschrijving}`.toLowerCase().includes(zoekterm))
    .sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));

  const stappen: { nr: Stap; titel: string; waarde: string | null; kan: boolean }[] = [
    { nr: 1, titel: 'Spel', waarde: spelInfo ? `${spelInfo.icoon} ${spelInfo.naam}` : null, kan: true },
    { nr: 2, titel: 'Klas', waarde: klasGekozen ? (klas ? `${klas.naam} (${klas.leerlingen.length})` : 'Zonder klas') : null, kan: spel !== null },
    { nr: 3, titel: 'Vragenset', waarde: set?.titel ?? null, kan: spel !== null && klasGekozen },
    { nr: 4, titel: 'Instellingen en start', waarde: null, kan: spel !== null && set !== null && klasGekozen },
  ];

  const kanStarten = spel !== null && set !== null && klasGekozen && vragen.length > 0 && (spel !== 'escape' || escapeVragen.length > 0) && !bezig && !(isLive && !demo && !store.account.leerkracht) && raadselFouten.length === 0 && cluedoFouten.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Spelen">
        <GeluidMenu />
      </PageHeader>

      {/* Stappen: wat al gekozen is, staat erbij; klik om het te wijzigen. */}
      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Stappen">
        {stappen.map((st) => (
          <li key={st.nr}>
            <button
              type="button"
              disabled={!st.kan}
              onClick={() => setStap(st.nr)}
              aria-current={stap === st.nr ? 'step' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition disabled:opacity-40 ${
                stap === st.nr ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 bg-surface hover:border-slate-300'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${st.waarde ? 'bg-emerald-500 text-white' : stap === st.nr ? 'bg-[var(--accent)] text-white' : 'bg-slate-200 text-slate-600'}`}
              >
                {st.waarde ? '✓' : st.nr}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">{st.titel}</span>
                <span className="block truncate font-semibold">{st.waarde ?? (st.nr === 4 ? '' : 'kies…')}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {stap === 1 && (
        <Section step={1} title="Welk spel?">
          {[
            { titel: 'Op het bord, in teams', types: BORD_SPELLEN },
            { titel: 'Elke leerling op de eigen laptop', types: LIVE_SPELLEN },
          ].map((groep) => (
            <div key={groep.titel} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{groep.titel}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SPELLEN.filter((s) => groep.types.includes(s.type)).map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    aria-label={s.naam}
                    onClick={() => kiesSpel(s.type)}
                    className={`rounded-xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${spel === s.type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 bg-surface hover:border-slate-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{s.icoon}</span>
                      <span className="text-lg font-semibold">{s.naam}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{s.tekst}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {stap === 3 && (
        <Section step={3} title="Welke vragenset?">
          <input
            type="search"
            className={`${inputClass} mb-4 max-w-md`}
            placeholder="🔍 Zoek op titel, leerjaar of vak…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            aria-label="Zoek een vragenset"
            autoFocus
          />
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Leerjaar">
            {[0, 3, 4, 5, 6].map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={jaar === j}
                onClick={() => setJaar(j)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${jaar === j ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`}
              >
                {j ? `${j}e jaar` : 'Alle jaren'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => {
              const n = speelbareVragen(s).length;
              const gekozen = s.id === gekozenSet;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`${s.titel}${s.leerjaar ? ` (${s.leerjaar})` : ''}`}
                  disabled={n === 0}
                  onClick={() => kiesSet(s.id)}
                  className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 ${gekozen ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 bg-surface hover:border-slate-300'}`}
                >
                  {s.cover ? (
                    <img src={s.cover} alt="" className="aspect-[16/6] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[16/6] w-full items-center justify-center bg-slate-100 text-4xl" aria-hidden>
                      {VAK_ICONEN[s.vak] ?? '📚'}
                    </div>
                  )}
                  <div className="p-3">
                    <div className="font-semibold">{s.titel}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {[s.leerjaar, vakkenVan(s).map((v) => VAK_LABELS[v]).join(', '), `${n} vragen`].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{s.statistiek?.gespeeld ? `al ${s.statistiek.gespeeld}× gespeeld` : 'nog niet gespeeld'}</div>
                  </div>
                </button>
              );
            })}
            {sets.length === 0 && <p className="text-slate-500">Geen vragenset gevonden voor “{zoek}”.</p>}
          </div>
        </Section>
      )}

      {stap === 2 && (
        <Section step={2} title="Welke klas?">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...store.klassen]
              .sort((a, b) => (klasJaar(a) ?? 99) - (klasJaar(b) ?? 99) || a.naam.localeCompare(b.naam, 'nl', { numeric: true }))
              .map((k) => (
                <button
                  key={k.id}
                  type="button"
                  data-klas
                  aria-label={`Klas ${k.naam}`}
                  onClick={() => kiesKlas(k.id)}
                  className={`rounded-xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${klasId === k.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 bg-surface hover:border-slate-300'}`}
                >
                  <div className="text-2xl font-bold">{k.naam}</div>
                  <div className="text-sm text-slate-500">
                    {k.leerlingen.length} leerlingen{klasJaar(k) ? ` · ${klasJaar(k)}e jaar` : ''}
                  </div>
                </button>
              ))}
          </div>
          <button
            type="button"
            aria-label="Zonder klas"
            onClick={() => kiesKlas('')}
            className={`mt-3 text-sm underline-offset-2 hover:underline ${klasId === '' ? 'font-semibold text-[var(--accent-tekst)]' : 'text-slate-500'}`}
          >
            of zonder klas spelen
          </button>
          {store.klassen.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              Tip: maak een <a className="underline" href={href({ pagina: 'klassen' })}>klas</a> aan om namen van leerlingen te zien en resultaten per leerling bij te houden.
            </p>
          )}
        </Section>
      )}

      {stap === 4 && spel && set && klasGekozen && (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-4">
            {set.cover ? <img src={set.cover} alt="" className="aspect-video w-28 rounded-lg object-cover" /> : <span className="text-5xl">{spelInfo?.icoon}</span>}
            <div className="min-w-0 flex-1 text-lg">
              <strong>
                {spelInfo?.icoon} {spelInfo?.naam}
              </strong>{' '}
              met <strong>“{set.titel}”</strong> ({vragen.length} vragen) voor <strong>{klas ? `${klas.naam} (${klas.leerlingen.length - afwezig.length} aanwezig)` : 'een groep zonder klas'}</strong>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button variant="primary" className="px-8 py-3 text-base" disabled={!kanStarten} onClick={start}>
                {bezig ? 'Bezig…' : '▶ Start het spel'}
              </Button>
              {fout && <span className="text-sm text-red-600">{fout}</span>}
            </div>
          </div>

          <Section step={4} title={isLive ? 'Instellingen' : 'Instellingen en teams'}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {(spel === 'quizbord' || spel === 'bom') && (
            <div className="w-36">
              <label className={labelClass}>Aantal teams</label>
              <select
                className={inputClass}
                value={aantal}
                onChange={(e) => {
                  setAantal(Number(e.target.value));
                  verdeel(klas?.leerlingen, Number(e.target.value));
                }}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          {eigenTempo ? (
            <>
              {spel === 'escape' && (
                <div className="w-40">
                  <label className={labelClass}>Aantal sloten</label>
                  <select className={inputClass} value={aantalSloten} onChange={(e) => setAantalSloten(Number(e.target.value))}>
                    <option value={0}>alle ({escapeVragen.length})</option>
                    {[3, 4, 5, 6, 8, 10, 12].filter((n) => n < escapeVragen.length).map((n) => (
                      <option key={n} value={n}>
                        {n} (willekeurig gekozen)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-40">
                <label className={labelClass}>Totale tijd</label>
                <select className={inputClass} value={escapeMinuten ?? ''} onChange={(e) => setEscapeMinuten(e.target.value ? Number(e.target.value) : null)}>
                  {ESCAPE_MINUTEN.map((m) => (
                    <option key={m ?? 0} value={m ?? ''}>
                      {m ? `${m} minuten` : 'geen limiet'}
                    </option>
                  ))}
                </select>
              </div>
              {spel === 'territorium' && (
                <div className="w-40">
                  <label className={labelClass} htmlFor="tekentijd">
                    Tekentijd per beurt
                  </label>
                  <select id="tekentijd" className={inputClass} value={tekenSeconden} onChange={(e) => setTekenSeconden(Number(e.target.value))}>
                    {TEKENTIJDEN.map((t) => (
                      <option key={t} value={t}>
                        {t} seconden
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {spel === 'escape' ? (
                <div className="w-48">
                  <label className={labelClass} htmlFor="straftijd">
                    Straftijd na foute code
                  </label>
                  <select id="straftijd" className={inputClass} value={strafTijd} onChange={(e) => setStrafTijd(Number(e.target.value))}>
                    {STRAFTIJDEN.map((w) => (
                      <option key={w} value={w}>
                        {w < 60 ? `${w} seconden` : `${w / 60} minu${w === 60 ? 'ut' : 'ten'}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="w-48">
                  <label className={labelClass}>Wachten na fout antwoord</label>
                  <select className={inputClass} value={wachttijd} onChange={(e) => setWachttijd(Number(e.target.value))}>
                    {WACHTTIJDEN.map((w) => (
                      <option key={w} value={w}>
                        {w ? `${w} seconden` : 'niet wachten'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : spel === 'bom' ? (
            <>
              <div className="w-48">
                <label className={labelClass}>Tijd tot de bom ontploft</label>
                <select className={inputClass} value={bomTijdKeuze} onChange={(e) => setBomTijdKeuze(e.target.value as BomTijd)}>
                  {(Object.keys(BOM_TIJDEN) as BomTijd[]).map((t) => (
                    <option key={t} value={t}>
                      {BOM_TIJDEN[t].naam}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="w-44">
              <label className={labelClass}>Timer per vraag</label>
              <select className={inputClass} value={timer ?? ''} onChange={(e) => setTimer(e.target.value ? Number(e.target.value) : null)}>
                {TIMERS.map((t) => (
                  <option key={t ?? 0} value={t ?? ''}>
                    {t ? `${t} seconden` : 'geen timer'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {klas && !isLive && <Button onClick={() => verdeel()}>🔀 Opnieuw verdelen</Button>}
        </div>

        {isLive && (
          <div className="mb-4 space-y-2 text-sm">
            {spel === 'territorium' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Modus">
                  {(
                    [
                      ['strijd', '⚔️ 1 tegen allen', 'Meeste gebied wint; je mag over anderen kleuren.'],
                      ['samen', '🤝 Samen inkleuren', 'Samen één tekening inkleuren, elk in de eigen kleur.'],
                    ] as const
                  ).map(([m, naam, uitleg]) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={territoriumModus === m}
                      onClick={() => setTerritoriumModus(m)}
                      className={`rounded-xl border-2 px-4 py-2 text-left transition ${territoriumModus === m ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 bg-surface hover:border-slate-300'}`}
                    >
                      <div className="font-semibold">{naam}</div>
                      <div className="text-sm text-slate-500">{uitleg}</div>
                    </button>
                  ))}
                </div>
                {territoriumModus === 'samen' && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Tekening">
                    {[{ id: '', naam: 'Willekeurig', icoon: '🎲' }, ...KLEURPLATEN].map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        aria-pressed={kleurplaatKeuze === k.id}
                        onClick={() => setKleurplaatKeuze(k.id)}
                        className={`rounded-full border px-3 py-1 text-sm font-medium transition ${kleurplaatKeuze === k.id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`}
                      >
                        {k.icoon} {k.naam}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : spel === 'cluedo' ? (
              <>
                <p className="text-slate-600">
                  De laptop van de leerkracht trekt in het geheim een dader, een plaats en een wapen. Leerlingen beantwoorden vragen in eigen tempo (de vragen komen steeds
                  opnieuw); elk juist antwoord streept op hun detectiveblad een kaart weg die niet de oplossing is. Wie denkt het te weten, beschuldigt: juist = opgelost,
                  fout = een minuut geblokkeerd. Wie het snelst oplost, wint; de anderen spelen verder.
                </p>
                <details className="rounded-xl border border-slate-200 p-3" open={Boolean(set?.cluedo) || cluedoFouten.length > 0}>
                  <summary className="cursor-pointer font-semibold">
                    🔎 Verdachten, locaties en wapens voor dit spel: “{cluedoThema.titel}” ({cluedoThema.verdachten.length} + {cluedoThema.locaties.length} + {cluedoThema.wapens.length})
                  </summary>
                  <div className="mt-3">
                    <CluedoThemaEditor key={cluedoSleutel} thema={cluedoThema} onChange={setCluedoThema} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        disabled={!set || cluedoFouten.length > 0}
                        onClick={() => set && store.setSets((all) => all.map((s) => (s.id === set.id ? { ...s, cluedo: cluedoThema } : s)))}
                      >
                        💾 Bewaar als thema van deze vragenset
                      </Button>
                      {set?.cluedo && <Button onClick={() => laadCluedo(set.cluedo!)}>↺ Thema van de vragenset</Button>}
                      <Button onClick={() => laadCluedo(STANDAARD_THEMA)}>↺ Standaardthema</Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Wijzigingen hier gelden enkel voor dit spel, tenzij je ze bewaart in de vragenset.</p>
                  </div>
                </details>
              </>
            ) : spel === 'codekraker' ? (
              <>
                <p className="text-slate-600">
                  Elke leerling kiest een geheim wachtwoord en beantwoordt vragen in eigen tempo (de vragen komen steeds opnieuw). Na een juist antwoord kiest de leerling een
                  kistje: munten (1.000 tot 25.000), een vermenigvuldiger, een firewall, pech of een kans om te hacken (iemand uit de top 3). Wie
                  het wachtwoord raadt, steelt een deel van diens munten. Wie op het einde de meeste munten heeft, wint.
                </p>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={hacken} onChange={(e) => setHacken(e.target.checked)} />
                  Hacken toestaan (anders enkel kistjes met munten, vermenigvuldigers en firewalls)
                </label>
              </>
            ) : spel === 'whodunit' ? (
              <>
                <p className="text-slate-600">
                  Leerlingen lezen het verhaal, lossen de oefeningen op en krijgen voor elk juist antwoord een hint. Met de hints vullen ze de tabel in; wie de tabel als
                  eerste volledig juist heeft, wint. Het raadsel stel je in onderaan de editor van de vragenset.
                </p>
                {raadselFouten.length > 0 && set && (
                  <Notice tone="warn">
                    {raadselFouten.join(' ')}{' '}
                    {set.raadsel ? (
                      <a className="font-semibold underline" href={href({ pagina: 'set', id: set.id })}>
                        Raadsel instellen
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => {
                          store.setSets((all) => all.map((s) => (s.id === set.id ? { ...s, raadsel: nieuwRaadsel() } : s)));
                          ga({ pagina: 'set', id: set.id });
                        }}
                      >
                        Raadsel toevoegen aan deze vragenset
                      </button>
                    )}
                  </Notice>
                )}
              </>
            ) : spel === 'escape' ? (
              <p className="text-slate-600">
                Elk antwoord geeft een cijfer, juist of niet. Wie denkt de code te hebben, test ze; een foute code geeft straftijd. Enkel meerkeuze- en waar/onwaar-vragen
                ({escapeVragen.length} van {vragen.length}).
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={snelheidsbonus && timer !== null} disabled={timer === null} onChange={(e) => setSnelheidsbonus(e.target.checked)} />
                  Snelheidsbonus: wie sneller juist antwoordt, krijgt meer punten (enkel met timer)
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={willekeurig} onChange={(e) => setWillekeurig(e.target.checked)} />
                  Vragen in willekeurige volgorde
                </label>
              </>
            )}
            {klas && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={vrijeNaam} onChange={(e) => setVrijeNaam(e.target.checked)} />
                Leerlingen mogen ook een naam typen die niet op de klaslijst staat
              </label>
            )}
            {supabaseIngesteld && !demo && !store.account.leerkracht && (
              <Notice tone="warn">
                Live spelen met echte laptops kan enkel als leerkracht.{' '}
                <a className="font-semibold underline" href={href({ pagina: 'aanmelden' })}>
                  Meld je aan
                </a>
                .
              </Notice>
            )}
          </div>
        )}


        {spel === 'quizbord' && klas && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dubbel} onChange={(e) => setDubbel(e.target.checked)} />
            Dubbele punten als één leerling alleen antwoordt (zonder overleggen)
          </label>
        )}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 3)}, minmax(0, 1fr))` }} hidden={isLive && !klas}>
          {teams.map((t, ti) => (
            <div key={ti} className="rounded-xl border-2 p-3" style={{ borderColor: isLive ? 'var(--color-slate-200)' : t.kleur }}>
              {isLive ? (
                <div className="mb-2 px-1 font-semibold text-slate-600">Aanwezig ({t.leerlingen.length})</div>
              ) : (
                <input
                  className="mb-2 w-full rounded border-0 bg-transparent px-1 font-semibold outline-none focus:ring-2"
                  style={{ color: t.kleur }}
                  value={t.naam}
                  onChange={(e) => setTeams((ts) => ts.map((x, i) => (i === ti ? { ...x, naam: e.target.value } : x)))}
                  aria-label="Teamnaam"
                />
              )}
              <div className="flex flex-wrap gap-1">
                {t.leerlingen.map((l) => (
                  <span key={l.id} className="inline-flex items-center rounded-full bg-slate-100 text-sm">
                    <button
                      type="button"
                      onClick={() => verplaats(ti, l.id)}
                      title="Klik om naar het volgende team te verplaatsen"
                      className="rounded-l-full py-1 pr-1 pl-2.5 hover:bg-slate-200"
                    >
                      {kortNaam(l)}
                    </button>
                    <button
                      type="button"
                      onClick={() => markeerAfwezig(ti, l)}
                      title="Afwezig"
                      aria-label={`${l.naam} afwezig`}
                      className="rounded-r-full py-1 pr-2 pl-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {t.leerlingen.length === 0 && <span className="text-sm text-slate-400">{klas ? 'leeg team' : 'geen namen'}</span>}
              </div>
            </div>
          ))}
        </div>
        {afwezig.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-slate-500">Afwezig:</span>
            {afwezig.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => terugAanwezig(l)}
                title="Toch aanwezig"
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-slate-500 line-through hover:bg-slate-50"
              >
                {kortNaam(l)}
              </button>
            ))}
          </div>
        )}
        {klas && (
          <p className="mt-2 text-xs text-slate-500">
            {isLive
              ? 'Klik op ✕ als een leerling afwezig is: die naam verschijnt dan niet in de lijst op de laptops.'
              : 'Klik op een naam om die leerling naar het volgende team te verplaatsen, of op ✕ als de leerling afwezig is.'}
          </p>
        )}
          </Section>

          {alleVragen.length > 1 && (
            <Section title="Vragen">
              <p className="mb-2 text-sm text-slate-500">
                {alleVragen.length} speelbare vragen
                {alleVragen.length < set.vragen.length && ` (${set.vragen.length - alleVragen.length} onvolledige vragen worden overgeslagen)`}.{' '}
                <a className="text-[var(--accent-tekst)] underline" href={href({ pagina: 'set', id: set.id })}>
                  Vragenset bewerken
                </a>
              </p>
              <VraagKeuze key={gekozenSet} vragen={alleVragen} uit={uit} onChange={setUit} />
            </Section>
          )}
        </>
      )}

    </div>
  );
}
