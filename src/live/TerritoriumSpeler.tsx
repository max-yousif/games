import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { isActie, vraagIndex, volgendeActieNr } from './codekraker';
import { Beantwoord, foutTekst } from './Invoer';
import { aantalVakjes, codeerLijnen, gekleurd, KLEUREN, leesVeld, maskerVan, territoriumToestand, veldVan } from './territorium';
import type { LiveAntwoord, LiveBackend, LiveSessie, LiveSpeler } from './types';
import { VeldBeeld, VeldTekenen } from './Veld';

const procent = (vakjes: number, totaal: number) => `${Math.round((vakjes / totaal) * 1000) / 10} %`;

/** Territorium voor de leerling: vragen beantwoorden en na een juist antwoord even tekenen (tegen elkaar of samen). */
export function TerritoriumSpeler({
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
  const vragen = sessie.vragen ?? [];
  const [nu, setNu] = useState(() => Date.now());
  const [fout, setFout] = useState<string | null>(null);
  const foutGezien = useRef(new Map<string, number>());
  const [poging, setPoging] = useState(0);
  const seconden = sessie.territorium?.seconden ?? 3;
  const veldTekst = veldVan(sessie);
  const veld = useMemo(() => leesVeld(veldTekst), [veldTekst]);
  const masker = useMemo(() => maskerVan(sessie.territorium?.kleurplaat), [sessie.territorium?.kleurplaat]);
  const totaal = aantalVakjes(masker);
  const samen = procent(gekleurd(veld), totaal);

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

  const ik: LiveSpeler = { id: spelerId ?? '', naam: '', bijnaam: null, verbonden: true };
  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  // Enkel de eigen tekenbeurten en reeks; het veld zelf komt van het bord.
  const p = territoriumToestand([ik], eigen, {}).spelers.get(ik.id)!;
  const rij = sessie.stand.find((r) => r.id === spelerId);
  const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
  const kleur = rij?.kleur ?? 0;
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  async function stuur(nr: number, tekst: string): Promise<boolean> {
    setFout(null);
    try {
      await be.antwoord(sessie.id, nr, tekst);
      return true;
    } catch (e) {
      setFout(foutTekst(e));
      return false;
    }
  }

  const kop = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-2xl bg-surface px-4 py-2 text-2xl font-bold shadow-sm">
        <span className="inline-block h-7 w-7 rounded-md border border-black/10" style={{ background: KLEUREN[kleur % KLEUREN.length] }} aria-hidden />
        {procent(rij?.punten ?? 0, totaal)}
      </span>
      {masker ? <span className="text-lg text-slate-600">🤝 samen {samen}</span> : plaats > 0 && <span className="text-lg text-slate-600">plaats {plaats}</span>}
      {p.reeks >= 2 && <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-800">🔥 {p.reeks} na elkaar: groter penseel!</span>}
      <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
        ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
      </span>
    </div>
  );

  if (sessie.status === 'einde' || (resterend !== null && resterend <= 0)) {
    return (
      <div className="breed space-y-4">
        <div className="rounded-2xl bg-surface p-6 text-center shadow-sm">
          <div className="text-5xl">🖌️</div>
          <h1 className="mt-2 text-3xl font-bold">{sessie.status === 'einde' ? 'Het spel is gedaan!' : 'De tijd is om!'}</h1>
          <p className="mt-2 text-xl text-slate-600">
            {masker ? `Samen ingekleurd: ${samen} · jouw bijdrage: ${procent(rij?.punten ?? 0, totaal)}` : `Jouw gebied: ${procent(rij?.punten ?? 0, totaal)}`}
            {!masker && plaats > 0 && ` · plaats ${plaats}`}
          </p>
          {sessie.status === 'einde' && nieuwSpel}
        </div>
        <VeldBeeld veld={veld} masker={masker} />
      </div>
    );
  }

  const wacht = eigen.some((a) => a.juist === null);
  const vraagAntwoorden = eigen.filter((a) => !isActie(a.vraagNr)).sort((a, b) => a.vraagNr - b.vraagNr);
  const laatsteVraag = vraagAntwoorden.at(-1);
  const volgendeNr = laatsteVraag ? laatsteVraag.vraagNr + 1 : 0;
  const wachtNaFout = laatsteVraag?.juist === false ? Math.ceil((sessie.wachttijd * 1000 - (nu - (foutGezien.current.get(laatsteVraag.id) ?? nu))) / 1000) : 0;
  const beurt = p.beurten[0];

  let inhoud: ReactNode;
  if (!spelerId) inhoud = <Kaart>Verbinden…</Kaart>;
  else if (wacht) inhoud = <Kaart>⏳ Wordt nagekeken…</Kaart>;
  else if (beurt) {
    const tekening = (lijnen: string) =>
      void stuur(volgendeActieNr(eigen), JSON.stringify({ soort: 'teken', vraag: beurt.vraag, lijnen })).then((ok) => {
        // Niet aangekomen: opnieuw laten tekenen.
        if (!ok) setPoging((n) => n + 1);
      });
    return (
      <div className="breed space-y-3">
        {kop}
        {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
        <VeldBeeld veld={veld} masker={masker} />
        <VeldTekenen
          key={`${beurt.vraag}-${poging}`}
          veld={veld}
          kleur={kleur}
          straal={beurt.penseel}
          seconden={seconden}
          masker={masker}
          onKlaar={(lijnen) => tekening(codeerLijnen(lijnen))}
          onOverslaan={() => tekening('')}
        />
      </div>
    );
  } else if (wachtNaFout > 0) {
    inhoud = (
      <Kaart>
        <div className="text-center">
          <div className="text-6xl">✗</div>
          <div className="mt-2 text-2xl font-bold text-red-600">Fout! Volgende vraag over {wachtNaFout} s</div>
        </div>
      </Kaart>
    );
  } else if (vragen.length === 0) inhoud = <Kaart>⚠️ Er zijn geen vragen gevonden voor dit spel.</Kaart>;
  else {
    const v = vragen[vraagIndex(spelerId, volgendeNr, vragen.length)];
    inhoud = (
      <Kaart>
        {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
        <RichText text={v.tekst} className="mb-4 text-2xl leading-snug font-medium" />
        <Beantwoord key={volgendeNr} vraag={v} onVerstuur={(a) => stuur(volgendeNr, a).then(() => {})} />
      </Kaart>
    );
  }

  return (
    <div className="breed space-y-3">
      {kop}
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {inhoud}
        <div>
          <VeldBeeld veld={veld} masker={masker} />
          <p className="mt-1 text-sm text-slate-500">
            {masker ? 'Kleur samen de tekening in. ' : ''}Juist antwoord = {seconden} seconden tekenen. Meerdere juist na elkaar = een groter penseel.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 text-lg shadow-sm">{children}</div>;
}
