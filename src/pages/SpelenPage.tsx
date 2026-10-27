import { useMemo, useState } from 'react';
import { GeluidMenu } from '../components/GeluidMenu';
import { Button, inputClass, labelClass, Notice, PageHeader, Section } from '../components/ui';
import { backend, supabaseIngesteld } from '../live/config';
import { AANTAL_NUMMERS } from '../live/codekraker';
import { STANDAARD_THEMA, themaProblemen, trekOplossing } from '../live/cluedo';
import { CluedoThemaEditor } from '../components/CluedoThemaEditor';
import { maakEscapeCode } from '../live/escape';
import { nieuwRaadsel, publiekRaadsel, raadselProblemen } from '../live/whodunit';
import { publiekeVraag } from '../live/logic';
import { LiveFout } from '../live/types';
import { speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { shuffle } from '../lib/random';
import { maakGroepjes, maakTeams, nieuweSessie, TEAM_KLEUREN } from '../lib/session';
import { korteNamen, naamVolgordeVan } from '../lib/students';
import type { Store } from '../lib/store';
import type { CluedoThema, Leerling, SpelType, Team } from '../lib/types';
import { VraagKeuze } from '../components/VraagKeuze';
import { BOM_TIJDEN, nieuweBom, type BomTijd } from '../lib/bom';

const SPELLEN: { type: SpelType; icoon: string; naam: string; tekst: string }[] = [
  { type: 'quizbord', icoon: '🟦', naam: 'Quizbord', tekst: 'Categorieën × punten. Teams kiezen om beurt een vak. 2 tot 6 teams.' },
  { type: 'vieropeenrij', icoon: '🔴', naam: 'Vier op een rij', tekst: 'Juist antwoord = een schijf laten vallen. Precies 2 teams.' },
  { type: 'bom', icoon: '💣', naam: 'Bom doorgeven', tekst: 'Juist antwoord = bom naar het volgende team. Alle vragen komen aan bod; de minste ontploffingen wint.' },
  { type: 'live', icoon: '💻', naam: 'Live quiz', tekst: 'Elke leerling speelt op de eigen laptop; jij volgt live mee op het bord.' },
  { type: 'escape', icoon: '🗝️', naam: 'Escape room', tekst: 'Elke leerling opent sloten door vragen op te lossen; de cijfers vormen de code om te ontsnappen.' },
  { type: 'codekraker', icoon: '🔐', naam: 'Crypto Hack', tekst: 'Elke leerling verdient munten met juiste antwoorden, opent kistjes en hackt elkaars wachtwoord.' },
  { type: 'cluedo', icoon: '🔎', naam: 'Cluedo', tekst: 'Wie, waar en waarmee? Elk juist antwoord streept een verdachte, plaats of wapen weg. Wie lost de moord als eerste op?' },
  { type: 'whodunit', icoon: '🕵️', naam: 'Whodunit', tekst: 'Een logisch raadsel: elke juiste oefening geeft een hint. Wie vult als eerste de tabel juist in?' },
];

const ESCAPE_MINUTEN = [null, 10, 15, 20, 30, 45, 60];
const WACHTTIJDEN = [0, 10, 15, 30, 60];

const TIMERS = [null, 30, 60, 90, 120, 180];

export function SpelenPage({ setId, store }: { setId?: string; store: Store }) {
  const [gekozenSet, setGekozenSet] = useState(setId ?? store.sets[0]?.id ?? '');
  const [spel, setSpel] = useState<SpelType>('quizbord');
  const [klasId, setKlasId] = useState(store.klassen[0]?.id ?? '');
  const [aantal, setAantal] = useState(2);
  const [timer, setTimer] = useState<number | null>(null);
  const [snelheidsbonus, setSnelheidsbonus] = useState(true);
  const [willekeurig, setWillekeurig] = useState(false);
  const [vrijeNaam, setVrijeNaam] = useState(false);
  const [dubbel, setDubbel] = useState(true);
  // Escape room en whodunit: alleen (1) of per 2 of 3 op één laptop.
  const [groepGrootte, setGroepGrootte] = useState<1 | 2 | 3>(1);
  const [demo, setDemo] = useState(!supabaseIngesteld);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const klas = store.klassen.find((k) => k.id === klasId) ?? null;
  const set = store.sets.find((s) => s.id === gekozenSet) ?? null;
  const alleVragen = set ? speelbareVragen(set) : [];
  // Vragen die niet meedoen in dit spel (de vragenset zelf blijft ongewijzigd).
  const [uit, setUit] = useState<Set<string>>(new Set());
  const vragen = alleVragen.filter((v) => !uit.has(v.id));
  const [bomTijdKeuze, setBomTijdKeuze] = useState<BomTijd>('normaal');
  const isLive = spel === 'live' || spel === 'escape' || spel === 'whodunit' || spel === 'codekraker' || spel === 'cluedo';
  // Escape room en whodunit: elke leerling werkt in eigen tempo.
  const eigenTempo = spel === 'escape' || spel === 'whodunit' || spel === 'codekraker' || spel === 'cluedo';
  // Cluedo: het thema voor dit spel (start van het thema van de vragenset, of het standaardthema).
  const [cluedoThema, setCluedoThema] = useState<CluedoThema>(() => store.sets.find((s) => s.id === (setId ?? store.sets[0]?.id))?.cluedo ?? STANDAARD_THEMA);
  const [cluedoSleutel, setCluedoSleutel] = useState(0);
  const laadCluedo = (t: CluedoThema) => {
    setCluedoThema(t);
    setCluedoSleutel((k) => k + 1);
  };
  const cluedoFouten = spel === 'cluedo' ? themaProblemen(cluedoThema) : [];
  const [hacken, setHacken] = useState(true);
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

  const [teams, setTeams] = useState<Team[]>(() => maakTeams(klas?.leerlingen ?? [], aantalTeams));
  const [afwezig, setAfwezig] = useState<Leerling[]>([]);
  const verdeel = (leerlingen = klas?.leerlingen ?? [], n = aantalTeams, zonder = afwezig, grootte: 1 | 2 | 3 = eigenTempo ? groepGrootte : 1) => {
    const aanwezig = leerlingen.filter((l) => !zonder.some((a) => a.id === l.id));
    setTeams(grootte > 1 ? maakGroepjes(aanwezig, grootte as 2 | 3) : maakTeams(aanwezig, n));
  };
  const metGroepjes = eigenTempo && groepGrootte > 1 && klas !== null;

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
    if (!set) return;
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
    if (!set) return;
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
      // Escape room: een (willekeurige) selectie van de vragen als sloten, in vaste volgorde.
      const gekozen = spel === 'escape' && aantalSloten > 0 && aantalSloten < vragen.length ? shuffle(vragen).slice(0, aantalSloten) : vragen;
      const escapeCode = spel === 'escape' ? maakEscapeCode(gekozen.length) : undefined;
      const spelTimer = escape ? (escapeMinuten ? escapeMinuten * 60 : null) : timer;
      // Op de server enkel voornamen, of groepjes zoals "Anna & Bert"; de koppeling blijft hier.
      const namen: Record<string, string[]> = metNamen
        ? Object.fromEntries(
            metGroepjes
              ? teams.filter((t) => t.leerlingen.length).map((t) => [
                  t.leerlingen
                    .map(kortNaam)
                    .sort((x, y) => x.localeCompare(y, 'nl'))
                    .join(' & '),
                  t.leerlingen.map((l) => l.id),
                ])
              : leerlingen.map((l) => [kortNaam(l), [l.id]]),
          )
        : {};
      const server = await backend(soort).maakSessie({
        titel: set.titel,
        namen: Object.keys(namen),
        vrijeNaam: !metNamen || vrijeNaam,
        // Codekraker: de vragen komen steeds opnieuw; nummers vanaf ACTIE_BASIS zijn acties.
        aantalVragen: codekraker || cluedo ? AANTAL_NUMMERS : gekozen.length,
        timer: spelTimer,
        modus: escape ? 'escape' : 'quiz',
        vragen: escape ? gekozen.map(publiekeVraag) : undefined,
        wachttijd: escape ? wachttijd : 0,
        raadsel: whodunit && set.raadsel ? publiekRaadsel(set.raadsel) : undefined,
        codekraker: codekraker ? { hacken } : undefined,
        cluedo: cluedo ? cluedoThema : undefined,
      });
      const basis = nieuweSessie({
        spelType: whodunit ? 'whodunit' : codekraker ? 'codekraker' : cluedo ? 'cluedo' : escape ? 'escape' : 'live',
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

  return (
    <div className="space-y-6">
      <PageHeader title="Spelen">
        <GeluidMenu />
      </PageHeader>

      <Section step={1} title="Vragenset" aside={set?.cover && <img src={set.cover} alt="" className="aspect-video w-32 rounded-lg object-cover shadow-sm" />}>
        <select
          className={`${inputClass} max-w-xl`}
          value={gekozenSet}
          onChange={(e) => {
            setGekozenSet(e.target.value);
            setUit(new Set());
            laadCluedo(store.sets.find((s) => s.id === e.target.value)?.cluedo ?? STANDAARD_THEMA);
          }}
        >
          {store.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.titel}
              {s.leerjaar ? ` (${s.leerjaar})` : ''}
            </option>
          ))}
        </select>
        {set && (
          <p className="mt-2 text-sm text-slate-500">
            {alleVragen.length} speelbare vragen
            {alleVragen.length < set.vragen.length && ` (${set.vragen.length - alleVragen.length} onvolledige vragen worden overgeslagen)`}
            {set.statistiek?.gespeeld ? ` · al ${set.statistiek.gespeeld}× gespeeld met ${set.statistiek.spelers} spelers` : ''}.{' '}
            <a className="text-[var(--accent-tekst)] underline" href={href({ pagina: 'set', id: set.id })}>
              Bewerken
            </a>
          </p>
        )}
        {alleVragen.length > 1 && <VraagKeuze key={gekozenSet} vragen={alleVragen} uit={uit} onChange={setUit} />}
      </Section>

      <Section step={2} title="Spel">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SPELLEN.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => {
                setSpel(s.type);
                verdeel(
                  klas?.leerlingen,
                  s.type === 'vieropeenrij' ? 2 : s.type === 'live' || s.type === 'escape' || s.type === 'whodunit' || s.type === 'codekraker' || s.type === 'cluedo' ? 1 : aantal,
                  afwezig,
                  s.type === 'escape' || s.type === 'whodunit' || s.type === 'codekraker' || s.type === 'cluedo' ? groepGrootte : 1,
                );
                if (s.type === 'live' && timer === null) setTimer(30);
              }}
              className={`rounded-xl border-2 p-4 text-left transition ${spel === s.type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="text-2xl">{s.icoon}</div>
              <div className="mt-1 font-semibold">{s.naam}</div>
              <div className="text-sm text-slate-600">{s.tekst}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section step={3} title={isLive ? 'Klas en instellingen' : 'Klas en teams'}>
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="w-60">
            <label className={labelClass}>Klas</label>
            <select
              className={inputClass}
              value={klasId}
              onChange={(e) => {
                setKlasId(e.target.value);
                setAfwezig([]);
                verdeel(store.klassen.find((k) => k.id === e.target.value)?.leerlingen ?? [], aantalTeams, []);
              }}
            >
              <option value="">Zonder namen (enkel teams)</option>
              {store.klassen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.naam} ({k.leerlingen.length})
                </option>
              ))}
            </select>
          </div>
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
                    <option value={0}>alle vragen ({vragen.length})</option>
                    {[3, 4, 5, 6, 8, 10, 12].filter((n) => n < vragen.length).map((n) => (
                      <option key={n} value={n}>
                        {n} (willekeurig gekozen)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {klas && (
                <div className="w-44">
                  <label className={labelClass}>Werken</label>
                  <select
                    className={inputClass}
                    value={groepGrootte}
                    onChange={(e) => {
                      const g = Number(e.target.value) as 1 | 2 | 3;
                      setGroepGrootte(g);
                      verdeel(klas.leerlingen, 1, afwezig, g);
                    }}
                  >
                    <option value={1}>alleen</option>
                    <option value={2}>per 2 (één laptop)</option>
                    <option value={3}>per 3 (één laptop)</option>
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
            {spel === 'cluedo' ? (
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
                Elk slot is een vraag. Een juist antwoord geeft één cijfer van de geheime code; met de volledige code ontsnapt de leerling. Leerlingen kiezen zelf de volgorde en
                mogen na een fout antwoord opnieuw proberen. Alle vragen worden automatisch nagekeken.
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
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={demo} disabled={!supabaseIngesteld} onChange={(e) => setDemo(e.target.checked)} />
              Demo in deze browser (leerlingen in andere tabbladen van deze browser, zonder internet-server)
            </label>
            {supabaseIngesteld && !demo && !store.account.leerkracht && (
              <Notice tone="warn">
                Live spelen met echte laptops kan enkel als leerkracht.{' '}
                <a className="font-semibold underline" href={href({ pagina: 'aanmelden' })}>
                  Meld je aan
                </a>{' '}
                of kies de demo.
              </Notice>
            )}
            {!supabaseIngesteld && (
              <Notice tone="warn">
                De live server (Supabase) is nog niet ingesteld, dus enkel de demo werkt: open het leerlingenscherm in een tweede tabblad. Zie{' '}
                <strong>supabase/README.md</strong> om live spelen met echte laptops aan te zetten.
              </Notice>
            )}
            {!klas && <p className="text-slate-500">Zonder klas typen leerlingen zelf hun naam.</p>}
          </div>
        )}

        {store.klassen.length === 0 && (
          <div className="mb-4">
            <Notice>
              Tip: maak een <a className="underline" href={href({ pagina: 'klassen' })}>klas</a> aan om namen van leerlingen te zien en resultaten per leerling bij te houden.
            </Notice>
          </div>
        )}

        {spel === 'quizbord' && klas && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dubbel} onChange={(e) => setDubbel(e.target.checked)} />
            Dubbele punten als één leerling alleen antwoordt (zonder overleggen)
          </label>
        )}
        {metGroepjes && <p className="mb-3 text-sm text-slate-600">Elk groepje speelt samen op één laptop. Klik op een naam om die naar het volgende groepje te verplaatsen.</p>}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 3)}, minmax(0, 1fr))` }} hidden={isLive && !klas}>
          {teams.map((t, ti) => (
            <div key={ti} className="rounded-xl border-2 p-3" style={{ borderColor: t.kleur }}>
              <input
                className="mb-2 w-full rounded border-0 bg-transparent px-1 font-semibold outline-none focus:ring-2"
                style={{ color: t.kleur }}
                value={t.naam}
                onChange={(e) => setTeams((ts) => ts.map((x, i) => (i === ti ? { ...x, naam: e.target.value } : x)))}
                aria-label="Teamnaam"
              />
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

      {fout && <Notice tone="warn">{fout}</Notice>}
      <div className="flex justify-end">
        <Button variant="primary" className="px-8 py-3 text-base" disabled={!set || vragen.length === 0 || bezig || (isLive && !demo && !store.account.leerkracht) || raadselFouten.length > 0 || cluedoFouten.length > 0} onClick={start}>
          {bezig ? 'Bezig…' : '▶ Start het spel'}
        </Button>
      </div>
    </div>
  );
}
