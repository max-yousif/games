import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { cluedoToestand, KAART_SOORTEN, leesBeschuldiging, SOORT_NAMEN, STRAF_MS, type BeschuldigBeloning, type Kaart, type VraagBeloning } from './cluedo';
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
  const foutGezien = useRef(new Map<string, number>());

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

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

  const blad = <Detectiveblad thema={thema} weg={p.weg} />;

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
  const wachtNaFout = laatsteVraag?.juist === false ? Math.ceil((sessie.wachttijd * 1000 - (nu - (foutGezien.current.get(laatsteVraag.id) ?? nu))) / 1000) : 0;
  const straf = p.strafVanaf !== null ? Math.ceil((STRAF_MS - (verstreken - p.strafVanaf)) / 1000) : 0;
  const laatsteBeschuldiging = eigen
    .filter((a) => isActie(a.vraagNr) && a.juist !== null)
    .sort((a, b) => b.vraagNr - a.vraagNr)
    .map((a) => ({ x: leesBeschuldiging(a.antwoord), b: leesBeloning<BeschuldigBeloning>(a.beloning) }))[0];
  const nieuweKaart = laatsteVraag?.juist && !gezien.has(laatsteVraag.vraagNr) ? leesBeloning<VraagBeloning>(laatsteVraag.beloning)?.kaart : undefined;

  let inhoud: ReactNode;
  if (wacht) inhoud = <Kaart titel="⏳ Even geduld…">Wordt nagekeken.</Kaart>;
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
    inhoud = <BeschuldigFormulier thema={thema} weg={p.weg} bezig={bezig} onAnnuleer={() => setBeschuldigen(false)} onBeschuldig={(x) => void stuur(volgendeActieNr(eigen), JSON.stringify({ soort: 'beschuldig', ...x })).then(() => setBeschuldigen(false))} />;
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
  } else if (wachtNaFout > 0) {
    inhoud = (
      <Kaart titel="">
        <div className="text-center">
          <div className="text-6xl">✗</div>
          <div className="mt-2 text-2xl font-bold text-red-600">Fout! Volgende vraag over {wachtNaFout} s</div>
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
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">{p.juist} juist</span>
        {plaats > 0 && <span className="text-lg text-slate-600">plaats {plaats}</span>}
        <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
          ⏱ {tijdTekst(resterend !== null ? resterend : verstreken)}
        </span>
      </div>
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {inhoud}
          {!beschuldigen && straf <= 0 && !wacht && (
            <button type="button" onClick={() => setBeschuldigen(true)} className="w-full rounded-2xl bg-red-700 px-6 py-4 text-2xl font-bold text-white hover:bg-red-600">
              🔎 Beschuldig!
            </button>
          )}
        </div>
        {blad}
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
function Detectiveblad({ thema, weg }: { thema: NonNullable<LiveSessie['cluedo']>; weg: Kaart[] }) {
  const laatste = weg.at(-1);
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-slate-900 shadow-sm" aria-label="Detectiveblad">
      <div className="mb-2 text-sm font-semibold tracking-wide text-amber-800 uppercase">Detectiveblad</div>
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
                    <li key={naam} className={`rounded px-1 ${isWeg ? 'text-slate-400 line-through' : 'font-medium'} ${nieuw ? 'pop bg-amber-200' : ''}`} data-weg={isWeg || undefined}>
                      {isWeg ? '✗ ' : '◻ '}
                      {naam}
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
  onAnnuleer,
  onBeschuldig,
}: {
  thema: NonNullable<LiveSessie['cluedo']>;
  weg: Kaart[];
  bezig: boolean;
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
      <p className="mb-3 text-slate-600">Ben je zeker? Een verkeerde beschuldiging kost je een minuut.</p>
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

