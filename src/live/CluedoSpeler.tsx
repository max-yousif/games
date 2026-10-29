import { useEffect, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { cluedoToestand, KAART_SOORTEN, leesBeschuldiging, leesOpgaveAntwoord, SOORT_NAMEN, strafMsVan, type BeschuldigBeloning, type Kaart, type VraagBeloning } from './cluedo';
import { vastGeschud } from '../lib/vraagtypes';
import { isActie, leesBeloning, vraagIndex, volgendeActieNr } from './codekraker';
import { Beantwoord, foutTekst } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie, LiveSpeler } from './types';

const zelfde = (a: Kaart, b: Kaart) => a.soort === b.soort && a.naam === b.naam;

/** Cluedo voor de leerling: detectiveblad, vragen en beschuldigen. */
export function CluedoSpeler({
  be,
  sessie,
  antwoorden,
  spelerId,
  nieuwSpel,
}: {
  be: LiveBackend;
  sessie: LiveSessie;
  antwoorden: LiveAntwoord[];
  spelerId: string | null;
  nieuwSpel: ReactNode;
}) {
  const thema = sessie.cluedo!;
  const vragen = sessie.vragen ?? [];
  const [nu, setNu] = useState(() => Date.now());
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [beschuldigen, setBeschuldigen] = useState(false);
  // Vragen waarvan de leerling de weggestreepte kaart al gezien heeft.
  const [gezien, setGezien] = useState<Set<number>>(new Set());

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const ik: LiveSpeler = { id: spelerId ?? '', naam: '', bijnaam: null, verbonden: true };
  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  const p = cluedoToestand([ik], eigen).spelers.get(ik.id)!;
  const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  async function stuur(nr: number, tekst: string) {
    setBezig(true);
    setFout(null);
    try {
      await be.antwoord(sessie.id, nr, tekst);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  // Bij elke leerling staan de kaarten in een andere volgorde: afkijken bij de buur helpt niet.
  const mijnThema = geschud(thema, spelerId ?? '');
  const blad = <Detectiveblad thema={mijnThema} weg={p.weg} />;
  // Cluedo met opgaven per kaart: de leerling kiest zelf welke opgave (geen vragen na elkaar).
  const metOpgaven = !!thema.metOpgaven || !!thema.uitkomsten;

  if (p.opgelostMs !== null) {
    return (
      <div className="breed space-y-4">
        <div className="pop rounded-2xl bg-emerald-600 p-8 text-center text-white shadow-sm">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-3 text-3xl font-bold">Opgelost!</h1>
          <p className="mt-2 text-xl">
            in {tijdTekst(p.opgelostMs)}
            {plaats > 0 && ` · plaats ${plaats}`}
          </p>
          {sessie.status === 'einde' && nieuwSpel}
        </div>
        {blad}
      </div>
    );
  }
  if (sessie.status === 'einde' || (resterend !== null && resterend <= 0)) {
    return (
      <div className="breed space-y-4">
        <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
          <div className="text-6xl">🔎</div>
          <h1 className="mt-3 text-3xl font-bold">{sessie.status === 'einde' ? 'Het spel is gedaan!' : 'De tijd is om!'}</h1>
          <p className="mt-2 text-xl text-slate-600">De oplossing staat op het bord.</p>
          {sessie.status === 'einde' && nieuwSpel}
        </div>
        {blad}
      </div>
    );
  }

  const wacht = eigen.some((a) => a.juist === null);
  const vraagAntwoorden = eigen.filter((a) => !isActie(a.vraagNr)).sort((a, b) => a.vraagNr - b.vraagNr);
  const laatsteVraag = vraagAntwoorden.at(-1);
  const volgendeNr = laatsteVraag ? laatsteVraag.vraagNr + 1 : 0;
  const straf = p.strafVanaf !== null ? Math.ceil((strafMsVan(sessie.wachttijd) - (verstreken - p.strafVanaf)) / 1000) : 0;
  const laatsteBeschuldiging = eigen
    .filter((a) => isActie(a.vraagNr) && a.juist !== null)
    .sort((a, b) => b.vraagNr - a.vraagNr)
    .map((a) => ({ x: leesBeschuldiging(a.antwoord), b: leesBeloning<BeschuldigBeloning>(a.beloning) }))[0];
  const nieuweKaart = laatsteVraag?.juist && !gezien.has(laatsteVraag.vraagNr) ? leesBeloning<VraagBeloning>(laatsteVraag.beloning)?.kaart : undefined;

  let inhoud: ReactNode;
  // Bij opgaven blijft de lijst staan tijdens het nakijken (zo blijft de opgave open).
  if (wacht && !metOpgaven) inhoud = <Kaart titel="⏳ Even geduld…">Wordt nagekeken.</Kaart>;
  else if (straf > 0) {
    inhoud = (
      <Kaart titel="">
        <div className="text-center">
          <div className="text-6xl">🚔</div>
          <div className="mt-2 text-2xl font-bold text-red-600">Verkeerde beschuldiging!</div>
          {laatsteBeschuldiging?.x && (
            <p className="mt-2 text-slate-600">
              Het was niet {laatsteBeschuldiging.x.verdachte} in {laatsteBeschuldiging.x.locatie} met {laatsteBeschuldiging.x.wapen.toLowerCase()}.
            </p>
          )}
          <p className="mt-3 text-xl">Je kan verder over {straf} s.</p>
        </div>
      </Kaart>
    );
  } else if (beschuldigen) {
    inhoud = <BeschuldigFormulier thema={mijnThema} weg={p.weg} bezig={bezig} strafSeconden={strafMsVan(sessie.wachttijd) / 1000} onAnnuleer={() => setBeschuldigen(false)} onBeschuldig={(x) => void stuur(volgendeActieNr(eigen), JSON.stringify({ soort: 'beschuldig', ...x })).then(() => setBeschuldigen(false))} />;
  } else if (metOpgaven) {
    inhoud = <Opgaven vragen={vragen} eigen={eigen} spelerId={spelerId ?? ''} onVerstuur={(nr, antwoord) => stuur(volgendeActieNr(eigen), JSON.stringify({ soort: 'opgave', nr, antwoord }))} />;
  } else if (nieuweKaart !== undefined && laatsteVraag) {
    inhoud = (
      <Kaart titel="">
        <div className="pop text-center">
          <div className="text-6xl">✅</div>
          {nieuweKaart ? (
            <div className="mt-3 text-2xl font-bold">
              {SOORT_NAMEN[nieuweKaart.soort].icoon} {nieuweKaart.naam} is niet {SOORT_NAMEN[nieuweKaart.soort].enkel}!
            </div>
          ) : (
            <div className="mt-3 text-2xl font-bold">Juist! Alle andere kaarten zijn al weg: tijd om te beschuldigen.</div>
          )}
          <button type="button" autoFocus onClick={() => setGezien((g) => new Set(g).add(laatsteVraag.vraagNr))} className="mt-6 rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white">
            Volgende vraag ▶
          </button>
        </div>
      </Kaart>
    );
  } else if (vragen.length === 0) {
    inhoud = <Kaart titel="⚠️ Geen vragen">Er zijn geen vragen gevonden voor dit spel.</Kaart>;
  } else {
    const v = vragen[vraagIndex(spelerId ?? '', volgendeNr, vragen.length)];
    inhoud = (
      <Kaart titel="">
        {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
        <RichText text={v.tekst} className="mb-4 text-2xl leading-snug font-medium" />
        <Beantwoord key={volgendeNr} vraag={v} zaad={`${spelerId}:${volgendeNr}`} onVerstuur={(a) => stuur(volgendeNr, a)} />
      </Kaart>
    );
  }

  return (
    <div className="breed space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-bold">🔎 {thema.titel}</span>
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{p.juist} {metOpgaven && !thema.uitkomsten ? 'beantwoord' : 'juist'}</span>
        {plaats > 0 && <span className="text-lg text-slate-600">plaats {plaats}</span>}
        <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
          ⏱ {tijdTekst(resterend !== null ? resterend : verstreken)}
        </span>
      </div>
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      {/* Met opgaven: het blad (met de uitkomsten) bovenaan over de hele breedte. */}
      {metOpgaven && blad}
      <div className={`grid items-start gap-4 ${metOpgaven ? '' : 'lg:grid-cols-2'}`}>
        <div className="space-y-3">
          {inhoud}
          {!beschuldigen && straf <= 0 && !wacht && (
            <button type="button" onClick={() => setBeschuldigen(true)} className="w-full rounded-2xl bg-red-700 px-6 py-4 text-2xl font-bold text-white hover:bg-red-600">
              🔎 Beschuldig!
            </button>
          )}
        </div>
        {!metOpgaven && blad}
      </div>
    </div>
  );
}

function Kaart({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      {titel && <h2 className="mb-3 text-2xl font-bold">{titel}</h2>}
      {children}
    </div>
  );
}

/** Het detectiveblad: alle kaarten, de weggestreepte doorstreept (de laatste even gemarkeerd). */
type Thema = NonNullable<LiveSessie['cluedo']>;

/** Het thema met de kaarten (en hun uitkomsten) in een vaste, eigen volgorde per leerling. */
function geschud(thema: Thema, spelerId: string): Thema {
  const uit: Thema = { ...thema };
  const uitkomsten = thema.uitkomsten ? { ...thema.uitkomsten } : undefined;
  for (const soort of KAART_SOORTEN) {
    const volgorde = vastGeschud(
      thema[soort].map((_, i) => i),
      `${spelerId}:${soort}`,
    );
    uit[soort] = volgorde.map((i) => thema[soort][i]);
    if (uitkomsten) uitkomsten[soort] = volgorde.map((i) => thema.uitkomsten![soort][i] ?? '');
  }
  return { ...uit, uitkomsten };
}

const BEDEKT = 'games.v1.cluedo-bedekt';

function Detectiveblad({ thema, weg }: { thema: Thema; weg: Kaart[] }) {
  const laatste = weg.at(-1);
  // Bedekken tegen spieken: dan zie je een kaart enkel als je erop wijst (onthouden op deze laptop).
  const [bedekt, setBedekt] = useState(() => {
    try {
      return localStorage.getItem(BEDEKT) === '1';
    } catch {
      return false;
    }
  });
  const wissel = () => {
    setBedekt(!bedekt);
    try {
      localStorage.setItem(BEDEKT, bedekt ? '0' : '1');
    } catch {
      // Niet kunnen onthouden is geen probleem.
    }
  };
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-slate-900 shadow-sm" aria-label="Detectiveblad" data-bedekt={bedekt || undefined}>
      <div className="mb-2 flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide text-amber-800 uppercase">Detectiveblad</span>
        <button type="button" onClick={wissel} className="ml-auto rounded-lg px-2 py-0.5 text-sm text-amber-900 hover:bg-amber-100">
          {bedekt ? '👁 Tonen' : '🙈 Bedekken'}
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {KAART_SOORTEN.map((soort) => {
          const over = thema[soort].filter((naam) => !weg.some((k) => zelfde(k, { soort, naam })));
          return (
            <div key={soort}>
              <div className="font-bold">
                {SOORT_NAMEN[soort].icoon} {SOORT_NAMEN[soort].titel}
                <span className="ml-1 text-sm font-normal text-slate-500">({over.length} over)</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {thema[soort].map((naam) => {
                  const isWeg = weg.some((k) => zelfde(k, { soort, naam }));
                  const nieuw = laatste && zelfde(laatste, { soort, naam });
                  return (
                    <li
                      key={naam}
                      className={`rounded px-1 transition ${isWeg ? 'text-slate-400 line-through' : 'font-medium'} ${nieuw ? 'pop bg-amber-200' : ''} ${bedekt ? 'blur-sm select-none hover:blur-none' : ''}`}
                      data-weg={isWeg || undefined}
                    >
                      {isWeg ? '✗ ' : '◻ '}
                      {naam}
                      {thema.uitkomsten && (
                        <RichText text={`$${thema.uitkomsten[soort][thema[soort].indexOf(naam)] ?? ''}$`} className="block overflow-x-auto py-1 pl-4 text-lg font-normal whitespace-nowrap" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeschuldigFormulier({
  thema,
  weg,
  bezig,
  strafSeconden,
  onAnnuleer,
  onBeschuldig,
}: {
  thema: Thema;
  weg: Kaart[];
  bezig: boolean;
  strafSeconden: number;
  onAnnuleer: () => void;
  onBeschuldig: (x: { verdachte: string; locatie: string; wapen: string }) => void;
}) {
  const eerste = (soort: Kaart['soort']) => thema[soort].find((naam) => !weg.some((k) => zelfde(k, { soort, naam }))) ?? thema[soort][0];
  const [verdachte, setVerdachte] = useState(eerste('verdachten'));
  const [locatie, setLocatie] = useState(eerste('locaties'));
  const [wapen, setWapen] = useState(eerste('wapens'));
  const kies = (soort: Kaart['soort'], waarde: string, zet: (w: string) => void, label: string) => (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <select className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-surface px-3 py-2 text-lg" value={waarde} onChange={(e) => zet(e.target.value)}>
        {thema[soort].map((naam) => (
          <option key={naam} value={naam}>
            {naam}
            {weg.some((k) => zelfde(k, { soort, naam })) ? ' (weggestreept)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <Kaart titel="🔎 Wie, waar en waarmee?">
      <p className="mb-3 text-slate-600">Ben je zeker? Een verkeerde beschuldiging geeft {strafSeconden >= 60 ? `${strafSeconden / 60} min.` : `${strafSeconden} s`} straftijd.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {kies('verdachten', verdachte, setVerdachte, 'Dader')}
        {kies('locaties', locatie, setLocatie, 'Plaats')}
        {kies('wapens', wapen, setWapen, 'Wapen')}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={bezig} onClick={() => onBeschuldig({ verdachte, locatie, wapen })} className="rounded-xl bg-red-700 px-6 py-3 text-xl font-bold text-white hover:bg-red-600 disabled:opacity-50">
          Beschuldig!
        </button>
        <button type="button" onClick={onAnnuleer} className="rounded-xl px-4 py-3 text-slate-600 underline">
          Toch niet
        </button>
      </div>
    </Kaart>
  );
}


/**
 * Cluedo met opgaven: alle opgaven in een lijst (bij elke leerling in een andere volgorde). Een
 * juiste uitkomst streept de kaart van die opgave weg; opnieuw proberen mag altijd.
 */
function Opgaven({
  vragen,
  eigen,
  spelerId,
  onVerstuur,
}: {
  vragen: NonNullable<LiveSessie['vragen']>;
  eigen: LiveAntwoord[];
  spelerId: string;
  onVerstuur: (nr: number, antwoord: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const volgorde = vastGeschud(
    vragen.map((_, i) => i),
    `${spelerId}:opgaven`,
  );
  const pogingen = (nr: number) =>
    eigen
      .filter((a) => a.juist !== null && leesOpgaveAntwoord(a.antwoord)?.nr === nr)
      .sort((a, b) => a.tijdMs - b.tijdMs);
  const opgelost = (nr: number) => pogingen(nr).find((a) => a.juist);
  const aantal = vragen.filter((_, nr) => opgelost(nr)).length;
  return (
    <Kaart titel={`✏️ Opgaven (${aantal} / ${vragen.length})`}>
      <ol className="grid items-start gap-2 md:grid-cols-2">
        {volgorde.map((nr, plaats) => {
          const v = vragen[nr];
          const laatste = pogingen(nr).at(-1);
          // Meerkeuze: elk antwoord streept stil een kaart weg (de laatste keuze telt); wijzigen mag.
          if (v.type === 'meerkeuze' || v.type === 'waaronwaar') {
            const gekozen = laatste?.juist ? laatste : undefined;
            const weg = gekozen ? leesBeloning<VraagBeloning>(gekozen.beloning)?.kaart : null;
            const optie = gekozen ? v.opties[Number(leesOpgaveAntwoord(gekozen.antwoord)?.antwoord)] : undefined;
            return (
              <li key={nr} data-opgave className={`rounded-xl border-2 ${open === nr ? 'border-[var(--accent)]' : gekozen ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}>
                <button type="button" onClick={() => setOpen(open === nr ? null : nr)} className="flex w-full items-start gap-3 p-3 text-left">
                  <span className="w-7 shrink-0 font-bold text-slate-400">{plaats + 1}.</span>
                  <RichText text={v.tekst} className="min-w-0 flex-1 text-lg" />
                  {weg && <span className="shrink-0 text-sm font-semibold text-sky-800">✗ {weg.naam}</span>}
                </button>
                {open === nr && (
                  <div className="border-t border-slate-100 p-3">
                    {optie !== undefined && (
                      <p className="mb-2 text-sm text-slate-600">
                        Jouw antwoord: <RichText text={optie} className="inline font-semibold" />
                        {weg && ` → ${weg.naam} is weggestreept.`} Kies opnieuw om te wijzigen.
                      </p>
                    )}
                    <Beantwoord
                      key={pogingen(nr).length}
                      vraag={v}
                      zaad={`${spelerId}:${nr}`}
                      onVerstuur={async (a) => {
                        await onVerstuur(nr, a);
                        setOpen(null);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          }
          const juist = opgelost(nr);
          const kaart = juist ? leesBeloning<VraagBeloning>(juist.beloning)?.kaart : null;
          return (
            <li key={nr} data-opgave className={`rounded-xl border-2 ${juist ? 'border-emerald-300 bg-emerald-50' : open === nr ? 'border-[var(--accent)]' : 'border-slate-200'}`}>
              <button type="button" onClick={() => setOpen(open === nr ? null : nr)} className="flex w-full items-start gap-3 p-3 text-left">
                <span className="w-7 shrink-0 font-bold text-slate-400">{plaats + 1}.</span>
                <RichText text={vragen[nr].tekst} className="min-w-0 flex-1 text-lg" />
                {juist ? (
                  <span className="shrink-0 text-sm font-semibold text-emerald-700">✓ {kaart ? `${SOORT_NAMEN[kaart.soort].icoon} ${kaart.naam}` : ''}</span>
                ) : (
                  laatste && <span className="shrink-0 text-sm text-red-600">✗ niet juist</span>
                )}
              </button>
              {open === nr && !juist && (
                <div className="border-t border-slate-100 p-3">
                  <Beantwoord key={pogingen(nr).length} vraag={vragen[nr]} onVerstuur={(a) => onVerstuur(nr, a)} />
                </div>
              )}
              {open === nr && juist && kaart && (
                <div className="pop border-t border-emerald-200 p-3 text-xl font-bold">
                  {SOORT_NAMEN[kaart.soort].icoon} {kaart.naam} is niet {SOORT_NAMEN[kaart.soort].enkel}!
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Kaart>
  );
}
