import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import {
  codekrakerToestand,
  isActie,
  leesActie,
  leesBeloning,
  vraagIndex,
  volgendeActieNr,
  wachtwoordOpties,
  type Actie,
  type DoelBeloning,
  type HackSoort,
  type KistBeloning,
  type RaadBeloning,
} from './codekraker';
import { Beantwoord, foutTekst } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie, LiveSpeler } from './types';

const fmt = (n: number) => n.toLocaleString('nl-BE');

const UITKOMST: Record<KistBeloning['uitkomst'], { icoon: string; tekst: (b: KistBeloning) => string }> = {
  munten: { icoon: '🪙', tekst: (b) => `+${fmt(b.bedrag)} munten!` },
  x2: { icoon: '✖️2', tekst: () => 'Je volgende munten tellen dubbel!' },
  x3: { icoon: '✖️3', tekst: () => 'Je volgende munten tellen driedubbel!' },
  firewall: { icoon: '🛡️', tekst: () => 'Firewall! 2 minuten lang kan niemand je hacken.' },
  hack: { icoon: '🔓', tekst: () => 'Hackkans!' },
  pech: { icoon: '💸', tekst: (b) => (b.bedrag < 0 ? `Pech: ${fmt(b.bedrag)} munten` : 'Pech… maar je had nog niets te verliezen.') },
};

/** Crypto Hack voor de leerling: wachtwoord kiezen, vragen beantwoorden, kistjes openen en hacken. */
export function CodekrakerSpeler({
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
  const [bezig, setBezig] = useState(false);
  // Uitkomsten die de leerling al gezien heeft (actienummers) en overgeslagen hackkansen.
  const [gezien, setGezien] = useState<Set<number>>(new Set());
  const foutGezien = useRef(new Map<string, number>());

  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

  const ik: LiveSpeler = { id: spelerId ?? '', naam: '', bijnaam: null, verbonden: true };
  // Enkel de eigen antwoorden (de leerkracht die zelf meespeelt, ziet in de database alle antwoorden).
  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  const t = codekrakerToestand([ik], eigen).spelers.get(ik.id)!;
  const rij = sessie.stand.find((r) => r.id === spelerId);
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
  const doe = (actie: Actie) => stuur(volgendeActieNr(eigen), JSON.stringify(actie));
  const zie = (nr: number) => setGezien((g) => new Set(g).add(nr));

  if (sessie.status === 'einde') {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">🔐</div>
        <h1 className="mt-3 text-3xl font-bold">Het spel is gedaan!</h1>
        <p className="mt-2 text-xl text-slate-600">
          🪙 {fmt(rij?.punten ?? 0)} munten · {t.juist} juiste antwoorden{plaats > 0 && ` · plaats ${plaats}`}
        </p>
        {nieuwSpel}
      </div>
    );
  }
  if (resterend !== null && resterend <= 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-sm">
        <div className="text-6xl">⏰</div>
        <h1 className="mt-3 text-3xl font-bold">De tijd is om!</h1>
        <p className="mt-2 text-xl text-slate-600">🪙 {fmt(rij?.punten ?? 0)} munten</p>
      </div>
    );
  }

  // Wat moet de leerling nu doen?
  const wacht = eigen.some((a) => a.juist === null);
  const acties = eigen.filter((a) => isActie(a.vraagNr) && a.juist).sort((a, b) => a.vraagNr - b.vraagNr);
  const laatsteActie = acties.at(-1);
  const laatsteSoort = laatsteActie ? leesActie(laatsteActie.antwoord) : null;
  const vraagAntwoorden = eigen.filter((a) => !isActie(a.vraagNr)).sort((a, b) => a.vraagNr - b.vraagNr);
  const laatsteVraag = vraagAntwoorden.at(-1);
  const volgendeNr = laatsteVraag ? laatsteVraag.vraagNr + 1 : 0;
  const wachtNaFout =
    laatsteVraag?.juist === false ? Math.ceil((sessie.wachttijd * 1000 - (nu - (foutGezien.current.get(laatsteVraag.id) ?? nu))) / 1000) : 0;
  const melding = rij?.melding && verstreken - rij.melding.tijdMs < 10_000 ? rij.melding.tekst : null;

  let inhoud: ReactNode;
  if (!spelerId) {
    // De eigen speler is nog niet geladen: de wachtwoorden hangen ervan af.
    inhoud = <Kaart titel="⏳ Even geduld…">Verbinden…</Kaart>;
  } else if (!t.wachtwoord) {
    inhoud = (
      <Kaart titel="🔑 Kies je geheime wachtwoord">
        <p className="text-slate-600">Medespelers kunnen proberen het te raden om jouw munten te stelen. Vertel het aan niemand!</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {wachtwoordOpties(spelerId ?? '').map((w) => (
            <button
              key={w}
              type="button"
              disabled={bezig || wacht}
              onClick={() => void doe({ soort: 'wachtwoord', woord: w })}
              data-wachtwoord
              className="rounded-xl border-2 border-slate-200 px-4 py-6 font-mono text-2xl font-bold hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {w}
            </button>
          ))}
        </div>
      </Kaart>
    );
  } else if (wacht) {
    const sinds = Math.max(0, verstreken - Math.min(...eigen.filter((a) => a.juist === null).map((a) => a.tijdMs)));
    inhoud = (
      <Kaart titel="⏳ Even geduld…">
        Wordt nagekeken.
        {sinds > 8000 && <p className="mt-2 text-slate-500">Dit duurt lang: het spel moet open blijven op de laptop van de leerkracht.</p>}
      </Kaart>
    );
  } else if (laatsteActie && laatsteSoort?.soort === 'kist' && !gezien.has(laatsteActie.vraagNr)) {
    // Uitkomst van het kistje tonen (bij een hackkans: meteen een doelwit kiezen).
    const b = leesBeloning<KistBeloning>(laatsteActie.beloning)!;
    const u = UITKOMST[b.uitkomst];
    const kans = t.hackKansen.find((k) => k.nr === laatsteActie.vraagNr);
    inhoud =
      b.uitkomst === 'hack' && kans ? (
        <DoelKiezen
          stand={sessie.stand}
          soort={b.hackSoort ?? 'willekeurig'}
          kandidaten={kans.kandidaten}
          bezig={bezig}
          onKies={(doel) => void doe({ soort: 'doel', kist: kans.nr, doel })}
          onOverslaan={() => zie(laatsteActie.vraagNr)}
        />
      ) : (
        <Kaart titel="">
          <div className="pop text-center">
            <div className="text-7xl">{u.icoon}</div>
            <div className="mt-3 text-3xl font-bold">{u.tekst(b)}</div>
            <VolgendeKnop onClick={() => zie(laatsteActie.vraagNr)} />
          </div>
        </Kaart>
      );
  } else if (laatsteActie && laatsteSoort?.soort === 'doel' && !gezien.has(laatsteActie.vraagNr)) {
    const b = leesBeloning<DoelBeloning>(laatsteActie.beloning)!;
    const kans = t.hackKansen.find((k) => k.nr === laatsteSoort.kist);
    const kistBeloning = kans && leesBeloning<KistBeloning>(eigen.find((a) => a.vraagNr === kans.nr)?.beloning ?? null);
    inhoud = b.opties ? (
      <Kaart titel={`🔓 Raad het wachtwoord van ${b.doelNaam}`}>
        <p className="text-slate-600">Eén van deze woorden is het. Juist geraden: je steelt munten. Fout geraden: dat kost je munten.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {b.opties.map((w) => (
            <button
              key={w}
              type="button"
              disabled={bezig}
              onClick={() => void doe({ soort: 'raad', doelActie: laatsteActie.vraagNr, woord: w })}
              className="rounded-xl border-2 border-slate-200 px-4 py-5 font-mono text-2xl font-bold hover:border-amber-500 hover:bg-amber-50"
            >
              {w}
            </button>
          ))}
        </div>
      </Kaart>
    ) : kans !== undefined ? (
      <DoelKiezen
        stand={sessie.stand}
        soort={kistBeloning?.hackSoort ?? 'willekeurig'}
        kandidaten={kans.kandidaten}
        bezig={bezig}
        boodschap={b.fout === 'firewall' ? `🛡️ ${b.doelNaam} heeft net een firewall opgezet.` : `${b.doelNaam} kan je nog niet hacken.`}
        onKies={(doel) => void doe({ soort: 'doel', kist: kans.nr, doel })}
        onOverslaan={() => zie(laatsteActie.vraagNr)}
      />
    ) : (
      <Kaart titel="">
        <VolgendeKnop onClick={() => zie(laatsteActie.vraagNr)} />
      </Kaart>
    );
  } else if (laatsteActie && laatsteSoort?.soort === 'raad' && !gezien.has(laatsteActie.vraagNr)) {
    const b = leesBeloning<RaadBeloning>(laatsteActie.beloning)!;
    inhoud = (
      <Kaart titel="">
        <div className="pop text-center">
          <div className="text-7xl">{b.gelukt ? '💰' : '❌'}</div>
          <div className="mt-3 text-3xl font-bold">
            {b.gelukt ? `Gehackt! Je stal ${fmt(b.bedrag)} munten van ${b.doelNaam}.` : `Fout geraden… ${b.bedrag < 0 ? `${fmt(b.bedrag)} munten.` : ''}`}
          </div>
          <VolgendeKnop onClick={() => zie(laatsteActie.vraagNr)} />
        </div>
      </Kaart>
    );
  } else if (t.openKisten.length > 0) {
    const vraagNr = t.openKisten[0];
    inhoud = (
      <Kaart titel="✅ Juist! Kies een kistje">
        <div className="mt-2 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              disabled={bezig}
              onClick={() => void doe({ soort: 'kist', vraag: vraagNr, keuze: i })}
              className="pop rounded-2xl border-4 border-amber-300 bg-amber-50 py-8 text-7xl transition hover:-translate-y-1 hover:shadow-lg"
              style={{ animationDelay: `${i * 0.08}s` }}
              aria-label={`Kistje ${i + 1}`}
            >
              🎁
            </button>
          ))}
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
    inhoud = <Kaart titel="⚠️ Geen vragen">Er zijn geen vragen gevonden voor dit spel. Vraag de leerkracht om het spel opnieuw te starten.</Kaart>;
  } else {
    const v = vragen[vraagIndex(spelerId ?? '', volgendeNr, vragen.length)];
    inhoud = (
      <Kaart titel="">
        {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
        <RichText text={v.tekst} className="mb-4 text-2xl leading-snug font-medium" />
        <Beantwoord key={volgendeNr} vraag={v} onVerstuur={(a) => stuur(volgendeNr, a)} />
      </Kaart>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-2xl bg-amber-100 px-4 py-2 font-mono text-3xl font-bold text-amber-900">🪙 {fmt(rij?.punten ?? 0)}</span>
        {plaats > 0 && <span className="text-lg text-slate-600">plaats {plaats}</span>}
        {rij?.firewall && <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-800">🛡️ firewall</span>}
        {t.wachtwoord && (
          // Verborgen tegen meekijkers: enkel zichtbaar met de muis erop.
          <span className="group cursor-default rounded-full bg-slate-100 px-3 py-1 font-mono text-slate-700" title="Je geheime wachtwoord (wijs erop om het te zien)">
            🔑{' '}
            <span className="group-hover:hidden">••••••</span>
            <span className="hidden group-hover:inline" data-wachtwoord-tekst>
              {t.wachtwoord}
            </span>
          </span>
        )}
        {t.mult > 1 && <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">×{t.mult}</span>}
        <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
          ⏱ {tijdTekst(resterend !== null ? resterend : verstreken)}
        </span>
      </div>
      {melding && <div className="pop rounded-2xl bg-red-600 px-5 py-3 text-xl font-semibold text-white">{melding}</div>}
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      {inhoud}
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

function VolgendeKnop({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" autoFocus onClick={onClick} className="mt-6 rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white">
      Volgende vraag ▶
    </button>
  );
}

const HACK_TITEL: Record<HackSoort, string> = {
  willekeurig: '🎲 Willekeurig doelwit!',
  top6: '🏆 Hack iemand uit de top 6!',
  twee: '🔓 Kies wie je hackt',
};

/** Doelwit kiezen, enkel uit de toegelaten kandidaten (bij "willekeurig" is er maar één). */
function DoelKiezen({
  stand,
  soort,
  kandidaten,
  bezig,
  boodschap,
  onKies,
  onOverslaan,
}: {
  stand: LiveSessie['stand'];
  soort: HackSoort;
  kandidaten: string[];
  bezig: boolean;
  boodschap?: string;
  onKies: (doel: string) => void;
  onOverslaan: () => void;
}) {
  const rijen = kandidaten.map((id) => ({ id, plaats: stand.findIndex((r) => r.id === id) + 1, rij: stand.find((r) => r.id === id) }));
  return (
    <Kaart titel={HACK_TITEL[soort]}>
      {boodschap && <p className="mb-3 rounded-lg bg-amber-50 px-4 py-2 text-amber-900">{boodschap}</p>}
      <div className={`grid gap-3 ${rijen.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {rijen.map(({ id, plaats, rij }) => (
          <button
            key={id}
            type="button"
            disabled={bezig || rij?.firewall}
            onClick={() => onKies(id)}
            className="pop flex items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-left text-2xl text-slate-900 hover:border-amber-500 hover:bg-amber-100 disabled:opacity-40"
          >
            <span className="font-bold">{soort === 'willekeurig' ? `Hack ${rij?.naam ?? '?'}!` : (rij?.naam ?? '?')}</span>
            <span className="text-lg">{rij?.firewall ? '🛡️' : plaats > 0 ? `plaats ${plaats}` : ''}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onOverslaan} className="mt-4 text-slate-500 underline">
        Niet hacken, volgende vraag
      </button>
    </Kaart>
  );
}
