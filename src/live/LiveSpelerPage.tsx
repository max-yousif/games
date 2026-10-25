import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { backend, supabaseIngesteld } from './config';
import { EscapeSpeler } from './EscapeSpeler';
import { WhodunitSpeler } from './Whodunit';
import { AntwoordTekst, Beantwoord, foutTekst } from './Invoer';
import { plaatsVan, schermNaam } from './logic';
import { LiveFout, type LiveAntwoord, type LiveBackend, type LiveSessie, type LiveSpeler, type SessieInfo } from './types';
import { ReactieKnoppen } from './Reacties';
import { VerbindingsBolletje } from './VerbindingsBolletje';

const BEWAARD = 'klasspelen.live-deelname';

interface Deelname {
  soort: LiveBackend['soort'];
  code: string;
  sessieId: string;
  naam: string;
}

/** In de demo is elk tabblad een andere leerling, dus dan per tabblad bewaren; anders per browser. */
const opslagVoor = (perTabblad: boolean) => (perTabblad ? sessionStorage : localStorage);

function leesDeelname(perTabblad: boolean): Deelname | null {
  try {
    return JSON.parse(opslagVoor(perTabblad).getItem(BEWAARD) ?? 'null') as Deelname | null;
  } catch {
    return null;
  }
}

function bewaarDeelname(perTabblad: boolean, d: Deelname | null) {
  try {
    if (d) opslagVoor(perTabblad).setItem(BEWAARD, JSON.stringify(d));
    else opslagVoor(perTabblad).removeItem(BEWAARD);
  } catch {
    // privévenster: herladen vraagt dan opnieuw de naam
  }
}


/** Scherm voor leerlingen: code ingeven, naam kiezen en meespelen. */
export function LiveSpelerPage({ code: startCode, demo }: { code?: string; demo: boolean }) {
  const soort: LiveBackend['soort'] = demo || !supabaseIngesteld ? 'lokaal' : 'supabase';
  const perTabblad = soort === 'lokaal';
  const be = backend(soort);
  const [deelname, setDeelname] = useState<Deelname | null>(() => {
    const d = leesDeelname(perTabblad);
    return d && d.soort === soort && (!startCode || d.code === startCode.toUpperCase()) ? d : null;
  });
  const [melding, setMelding] = useState<string | null>(null);
  const [laatsteCode, setLaatsteCode] = useState(startCode ?? '');

  const weg = useCallback(
    (tekst: string) => {
      bewaarDeelname(perTabblad, null);
      setDeelname((d) => {
        if (d) setLaatsteCode(d.code);
        return null;
      });
      setMelding(tekst);
    },
    [perTabblad],
  );

  async function verlaat() {
    if (!deelname || !confirm('Het spel verlaten? Je kan later terugkeren met dezelfde naam; je punten blijven bewaard.')) return;
    // Eerst het spelscherm sluiten, dan pas de server verwittigen: zo meldt het spelscherm niet
    // nog "losgekoppeld" wanneer de server de naam vrijgeeft.
    weg('Je hebt het spel verlaten. Kies opnieuw je naam om terug te keren, of geef een andere code in.');
    try {
      await be.verlaten(deelname.sessieId);
    } catch {
      // Ook zonder verbinding verlaten; de leerkracht kan de naam zo nodig loskoppelen.
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center gap-3 bg-surface px-6 py-3 shadow-sm">
        <span className="text-lg font-bold">🎲 Klasspelen</span>
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-tekst)]">live</span>
        {deelname && (
          <>
            <span className="ml-auto font-medium">{deelname.naam}</span>
            <VerbindingsBolletje />
            <button type="button" onClick={() => void verlaat()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Verlaten
            </button>
          </>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8 has-[.breed]:max-w-7xl">
        {deelname ? (
          <Spel key={deelname.sessieId} be={be} deelname={deelname} onWeg={weg} />
        ) : (
          <Aanmelden
            key={laatsteCode}
            be={be}
            startCode={laatsteCode}
            melding={melding}
            onKlaar={(d) => {
              const nieuw = { ...d, soort };
              bewaarDeelname(perTabblad, nieuw);
              setMelding(null);
              setDeelname(nieuw);
            }}
          />
        )}
      </main>
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-8 shadow-sm">{children}</div>;
}

function Aanmelden({ be, startCode, melding, onKlaar }: { be: LiveBackend; startCode: string; melding: string | null; onKlaar: (d: Omit<Deelname, 'soort'>) => void }) {
  const [code, setCode] = useState(startCode.toUpperCase());
  const [info, setInfo] = useState<SessieInfo | null>(null);
  const [eigenNaam, setEigenNaam] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function zoek(c = code) {
    if (c.trim().length < 6) return;
    setBezig(true);
    setFout(null);
    try {
      const i = await be.sessieInfo(c);
      if (!i) setFout('Deze code bestaat niet (of het spel is al afgelopen). Controleer de code op het bord.');
      setInfo(i);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  // Code uit de link: meteen opzoeken.
  const gezocht = useRef(false);
  useEffect(() => {
    if (!gezocht.current && startCode.length >= 6) {
      gezocht.current = true;
      void zoek(startCode);
    }
  });

  async function kies(naam: string) {
    setBezig(true);
    setFout(null);
    try {
      const d = await be.deelnemen(code, naam);
      onKlaar({ code: code.toUpperCase(), sessieId: d.sessieId, naam: d.naam });
    } catch (e) {
      setFout(foutTekst(e));
      if (e instanceof LiveFout && e.code === 'naam_bezet') void zoek();
    } finally {
      setBezig(false);
    }
  }

  if (!info) {
    return (
      <Kaart>
        <h1 className="text-3xl font-bold">Meespelen</h1>
        {melding && <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{melding}</p>}
        <form
          className="mt-6 flex flex-wrap gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void zoek();
          }}
        >
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="CODE"
            aria-label="Code"
            className="w-64 rounded-xl border-2 border-slate-300 px-4 py-3 text-center font-mono text-4xl tracking-[0.3em] uppercase outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" disabled={code.length < 6 || bezig} className="rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white disabled:opacity-50">
            Verder
          </button>
        </form>
        <p className="mt-3 text-slate-500">De code staat op het bord.</p>
        {fout && <p className="mt-3 text-red-600">{fout}</p>}
      </Kaart>
    );
  }

  return (
    <Kaart>
      {melding && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-900">{melding}</p>}
      <h1 className="text-3xl font-bold">{info.titel}</h1>
      <p className="mt-2 text-lg text-slate-600">Wie ben jij?</p>
      {fout && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-red-700">{fout}</p>}
      {info.vrijeNamen.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {info.vrijeNamen.map((n) => (
            <button key={n} type="button" disabled={bezig} onClick={() => void kies(n)} className="rounded-xl border-2 border-slate-200 px-4 py-3 text-left text-lg font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
              {n}
            </button>
          ))}
        </div>
      )}
      {info.vrijeNaam && (
        <form
          className="mt-5 flex flex-wrap gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (eigenNaam.trim()) void kies(eigenNaam);
          }}
        >
          <input
            value={eigenNaam}
            onChange={(e) => setEigenNaam(e.target.value)}
            maxLength={60}
            placeholder="Je voornaam en naam"
            aria-label="Je naam"
            className="min-w-64 flex-1 rounded-xl border-2 border-slate-300 px-4 py-3 text-xl outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" disabled={!eigenNaam.trim() || bezig} className="rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white disabled:opacity-50">
            Meedoen
          </button>
        </form>
      )}
      {info.vrijeNamen.length === 0 && !info.vrijeNaam && <p className="mt-5 text-slate-600">Alle namen zijn al gekozen. Vraag de leerkracht om hulp.</p>}
      <button type="button" className="mt-6 text-sm text-slate-500 underline" onClick={() => setInfo(null)}>
        Andere code
      </button>
    </Kaart>
  );
}

function Spel({ be, deelname, onWeg }: { be: LiveBackend; deelname: Deelname; onWeg: (melding: string) => void }) {
  const [sessie, setSessie] = useState<LiveSessie | null | undefined>(undefined);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  // De leerling ziet enkel de eigen rij (beveiliging in de database).
  const [ik, setIk] = useState<LiveSpeler | null>(null);

  useEffect(() => be.volgSessie(deelname.sessieId, setSessie), [be, deelname.sessieId]);
  useEffect(() => be.volgAntwoorden(deelname.sessieId, setAntwoorden), [be, deelname.sessieId]);
  useEffect(() => be.volgSpelers(deelname.sessieId, (s) => setIk(s.find((x) => x.verbonden) ?? null)), [be, deelname.sessieId]);

  // Eén browser = één leerling: werd in een ander tabblad een andere naam gekozen, dan stopt dit tabblad.
  useEffect(() => {
    if (ik && ik.naam !== deelname.naam) onWeg(`Je speelt nu in een ander tabblad als ${ik.naam}. Op één laptop kan je maar met één naam meespelen.`);
  }, [ik, deelname.naam, onWeg]);

  // Geen toegang meer: losgekoppeld door de leerkracht of het spel is afgesloten.
  useEffect(() => {
    if (sessie !== null) return;
    // Niets meer melden als dit scherm intussen gesloten is (bv. na zelf "Verlaten").
    let actief = true;
    void be.sessieInfo(deelname.code).then(
      (info) => actief && onWeg(info ? 'Je bent losgekoppeld. Kies opnieuw je naam.' : 'Het spel is afgesloten. Bedankt om mee te spelen!'),
      () => actief && onWeg('De verbinding met het spel is verbroken. Geef de code opnieuw in.'),
    );
    return () => {
      actief = false;
    };
  }, [sessie, be, deelname.code, onWeg]);

  if (!sessie) return <p className="text-center text-xl text-slate-500">Verbinden…</p>;

  const mijn = antwoorden.find((a) => a.vraagNr === sessie.vraagNr);
  const totaal = antwoorden.reduce((t, a) => t + a.punten, 0);
  const plaats = ik ? plaatsVan(sessie.stand, ik.id) : null;
  const nieuwSpel = (
    <button type="button" onClick={() => onWeg('Geef de code van het nieuwe spel in.')} className="mt-6 rounded-xl bg-[var(--accent)] px-6 py-3 text-lg font-semibold text-white hover:brightness-110">
      Nieuw spel meespelen
    </button>
  );

  if (sessie.status === 'lobby') {
    return (
      <Kaart>
        <div className="text-center">
          <div className="text-5xl">👋</div>
          <h1 className="mt-3 text-3xl font-bold">Hallo {deelname.naam}!</h1>
          <p className="mt-2 text-xl text-slate-600">Je doet mee aan “{sessie.titel}”. Wacht tot de leerkracht start…</p>
          <div className="mt-6 animate-pulse text-slate-400">●●●</div>
        </div>
        <Bijnaam be={be} sessieId={deelname.sessieId} ik={ik} />
        <ReactieKnoppen be={be} sessieId={deelname.sessieId} naam={ik ? schermNaam(ik) : deelname.naam} />
      </Kaart>
    );
  }

  if (sessie.modus === 'escape' && sessie.raadsel) return <WhodunitSpeler be={be} sessie={sessie} antwoorden={antwoorden} spelerId={ik?.id ?? null} nieuwSpel={nieuwSpel} />;
  if (sessie.modus === 'escape') return <EscapeSpeler be={be} sessie={sessie} antwoorden={antwoorden} spelerId={ik?.id ?? null} nieuwSpel={nieuwSpel} />;

  if (sessie.status === 'einde') {
    return (
      <Kaart>
        <div className="text-center">
          <div className="text-6xl">{plaats === 1 ? '🏆' : plaats !== null && plaats <= 3 ? '🎉' : '👏'}</div>
          <h1 className="mt-3 text-3xl font-bold">{plaats ? `Je eindigde op plaats ${plaats}!` : 'Einde!'}</h1>
          <p className="mt-2 text-2xl">
            <span className="font-mono font-bold">{totaal}</span> punten · {antwoorden.filter((a) => a.juist).length} juist
          </p>
          <ol className="mx-auto mt-6 max-w-sm space-y-1 text-left">
            {sessie.stand.slice(0, 3).map((r, i) => (
              <li key={r.id ?? r.naam} className="flex gap-3 rounded-lg bg-slate-50 px-4 py-2 text-lg">
                <span>{['🥇', '🥈', '🥉'][i]}</span>
                <span className="flex-1 font-medium">{r.naam}</span>
                <span className="font-mono">{r.punten}</span>
              </li>
            ))}
          </ol>
          {nieuwSpel}
        </div>
      </Kaart>
    );
  }

  const v = sessie.vraag;
  if (!v) return <p className="text-center text-xl text-slate-500">Even wachten…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-slate-600">
        <span className="font-semibold">
          Vraag {sessie.vraagNr + 1} / {sessie.aantalVragen}
        </span>
        {v.categorie && <span>{v.categorie}</span>}
        <span className="ml-auto font-mono">{totaal} punten</span>
        {sessie.status === 'vraag' && sessie.timer && !mijn && <Aftellen key={sessie.vraagNr} seconden={sessie.timer} />}
      </div>
      <div className="rounded-2xl bg-surface p-6 shadow-sm">
        <RichText text={v.tekst} className="text-2xl leading-snug font-medium" />
      </div>

      {sessie.status === 'vraag' && !mijn && <Beantwoord key={sessie.vraagNr} vraag={v} onVerstuur={(a) => be.antwoord(sessie.id, sessie.vraagNr, a)} />}

      {sessie.status === 'vraag' && mijn && (
        <Kaart>
          <div className="text-center text-xl">
            <div className="text-4xl">✉️</div>
            <p className="mt-2 font-semibold">Antwoord verstuurd!</p>
            <p className="mt-1 text-slate-500">
              Je antwoord: <AntwoordTekst vraag={v} antwoord={mijn.antwoord} />
            </p>
            <p className="mt-1 text-slate-500">Wacht op de anderen…</p>
          </div>
          <ReactieKnoppen be={be} sessieId={deelname.sessieId} naam={ik ? schermNaam(ik) : deelname.naam} />
        </Kaart>
      )}

      {sessie.status === 'antwoord' && (
        <div className={`rounded-2xl p-6 text-center text-white shadow-sm ${mijn?.juist ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <div className="text-5xl">{mijn ? (mijn.juist ? '✓' : '✗') : '⏰'}</div>
          <div className="mt-2 text-3xl font-bold">{mijn ? (mijn.juist ? `Juist! +${mijn.punten}` : 'Helaas, fout') : 'Geen antwoord gegeven'}</div>
          {mijn && (
            <div className="mt-1 text-lg opacity-90">
              Jouw antwoord: <AntwoordTekst vraag={v} antwoord={mijn.antwoord} />
            </div>
          )}
          {plaats && <div className="mt-2 text-lg">Je staat op plaats {plaats}.</div>}
        </div>
      )}

      {sessie.status === 'antwoord' && sessie.oplossing && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-surface p-5">
          <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Juiste antwoord</div>
          <RichText text={sessie.oplossing.antwoord} className="mt-1 text-2xl font-semibold" />
          {sessie.oplossing.uitleg && <RichText text={sessie.oplossing.uitleg} className="mt-2 text-slate-700" />}
        </div>
      )}

      {sessie.status === 'antwoord' && <ReactieKnoppen be={be} sessieId={deelname.sessieId} naam={ik ? schermNaam(ik) : deelname.naam} />}
    </div>
  );
}

/** Bijnaam instellen in de wachtzaal: die verschijnt op het bord in plaats van de echte naam. */
function Bijnaam({ be, sessieId, ik }: { be: LiveBackend; sessieId: string; ik: LiveSpeler | null }) {
  const [tekst, setTekst] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const huidig = ik?.bijnaam ?? null;

  async function bewaar(waarde: string) {
    setBezig(true);
    setFout(null);
    try {
      await be.bijnaam(sessieId, waarde);
      setTekst('');
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md rounded-xl bg-slate-50 p-4 text-left">
      <div className="font-semibold">Bijnaam (optioneel)</div>
      <p className="text-sm text-slate-500">Op het bord verschijnt je bijnaam in plaats van je echte naam. De leerkracht ziet wie je bent.</p>
      {huidig && (
        <p className="mt-2">
          Op het bord: <strong>{schermNaam({ naam: ik!.naam, bijnaam: huidig })}</strong>{' '}
          <button type="button" className="text-sm text-slate-500 underline" disabled={bezig} onClick={() => void bewaar('')}>
            wissen
          </button>
        </p>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (tekst.trim()) void bewaar(tekst);
        }}
      >
        <input
          value={tekst}
          maxLength={30}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={huidig ? 'Andere bijnaam' : 'bv. De Rekenkoning'}
          aria-label="Bijnaam"
          className="min-w-0 flex-1 rounded-lg border-2 border-slate-300 px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={!tekst.trim() || bezig} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white disabled:opacity-50">
          Opslaan
        </button>
      </form>
      {fout && <p className="mt-2 text-sm text-red-600">{fout}</p>}
    </div>
  );
}

function Aftellen({ seconden }: { seconden: number }) {
  const [start] = useState(() => Date.now());
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const rest = Math.max(0, seconden - Math.floor((nu - start) / 1000));
  return <span className={`rounded-full px-3 py-1 font-mono text-xl font-bold ${rest <= 5 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>{rest}s</span>;
}

