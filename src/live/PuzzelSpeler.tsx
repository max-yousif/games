import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { isActie, vraagIndex, volgendeActieNr } from './codekraker';
import { Beantwoord, foutTekst, FoutAntwoord } from './Invoer';
import { puzzelToestand, type PuzzelPubliek } from './puzzel';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';

/** Het stukje `stuk` van de foto als achtergrond. */
export function stukStijl(stuk: number, p: PuzzelPubliek, foto: string): CSSProperties {
  const kol = stuk % p.kolommen;
  const rij = Math.floor(stuk / p.kolommen);
  return {
    backgroundImage: `url(${foto})`,
    backgroundSize: `${p.kolommen * 100}% ${p.rijen * 100}%`,
    backgroundPosition: `${p.kolommen > 1 ? (kol / (p.kolommen - 1)) * 100 : 0}% ${p.rijen > 1 ? (rij / (p.rijen - 1)) * 100 : 0}%`,
  };
}

/** De foto van de puzzel (één keer opgehaald; opnieuw proberen tot ze er is). */
export function useFoto(be: LiveBackend, sessieId: string): string | null {
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let weg = false;
    let t = 0;
    const haal = () =>
      be.bijlage(sessieId).then(
        (f) => {
          if (weg) return;
          if (f) setFoto(f);
          else t = window.setTimeout(haal, 3000);
        },
        () => {
          if (!weg) t = window.setTimeout(haal, 3000);
        },
      );
    void haal();
    return () => {
      weg = true;
      window.clearTimeout(t);
    };
  }, [be, sessieId]);
  return foto;
}

/** Waar elk stukje ligt (plaats → stukje, -1 = leeg), bewaard op deze laptop. */
function useLigging(sleutel: string, aantal: number): [number[], (l: number[]) => void] {
  const [ligging, setLigging] = useState<number[]>(() => {
    try {
      const l = JSON.parse(localStorage.getItem(sleutel) ?? 'null') as number[] | null;
      if (Array.isArray(l) && l.length === aantal) return l;
    } catch {
      // opnieuw beginnen
    }
    return Array(aantal).fill(-1);
  });
  const zet = (l: number[]) => {
    setLigging(l);
    try {
      localStorage.setItem(sleutel, JSON.stringify(l));
    } catch {
      // geen opslag: enkel zolang dit scherm open is
    }
  };
  return [ligging, zet];
}

/** Puzzel voor de leerling: vragen beantwoorden, stukjes verdienen en op de juiste plaats leggen. */
export function PuzzelSpeler({
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
  const p = sessie.puzzel!;
  const aantal = p.kolommen * p.rijen;
  const vragen = sessie.vragen ?? [];
  const foto = useFoto(be, sessie.id);
  const [ligging, zetLigging] = useLigging(`games.v1.puzzel.${sessie.id}.${spelerId}`, aantal);
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [nu, setNu] = useState(() => Date.now());
  const [fout, setFout] = useState<string | null>(null);
  const [verder, setVerder] = useState<Set<string>>(new Set());
  const foutGezien = useRef(new Map<string, number>());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  for (const a of antwoorden) if (a.juist === false && !foutGezien.current.has(a.id)) foutGezien.current.set(a.id, Date.now());

  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  const t = puzzelToestand(eigen, spelerId ?? '');
  const alles = t.stukjes.length >= aantal;
  const klaar = t.klaarMs !== null;
  const rij = sessie.stand.find((r) => r.id === spelerId);
  const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;
  const wacht = eigen.some((a) => a.juist === null);

  async function stuur(nr: number, tekst: string) {
    setFout(null);
    try {
      await be.antwoord(sessie.id, nr, tekst);
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  // Alles verdiend en alles op zijn plaats: klaar melden (één keer per ligging).
  const juistGelegd = ligging.every((s, i) => s === i);
  const gemeld = useRef('');
  useEffect(() => {
    if (!spelerId || klaar || !alles || !juistGelegd || wacht) return;
    // Enkel opnieuw melden als er iets veranderde (anders na een weigering niet blijven proberen).
    const sleutel = `${t.stukjes.length}:${ligging.join(',')}`;
    if (gemeld.current === sleutel) return;
    gemeld.current = sleutel;
    void stuur(volgendeActieNr(eigen), JSON.stringify({ soort: 'klaar', ligging }));
  });

  // Leggen: een stukje (uit de bak of van een andere plaats) op een plaats; wat daar lag, wisselt.
  function leg(stuk: number, doel: number) {
    const l = [...ligging];
    const van = l.indexOf(stuk);
    const daar = l[doel];
    l[doel] = stuk;
    if (van >= 0 && van !== doel) l[van] = daar;
    zetLigging(l);
    setGekozen(null);
  }
  function terugInBak(stuk: number) {
    zetLigging(ligging.map((s) => (s === stuk ? -1 : s)));
    setGekozen(null);
  }
  const sleep = (stuk: number) => (e: DragEvent) => e.dataTransfer.setData('text/plain', String(stuk));
  const neem = (e: DragEvent) => Number(e.dataTransfer.getData('text/plain'));
  const bak = t.stukjes.filter((s) => !ligging.includes(s));
  const vakVerhouding = (p.verhouding * p.rijen) / p.kolommen;

  const kop = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-2xl bg-surface px-4 py-2 text-2xl font-bold shadow-sm">
        🧩 {t.stukjes.length} / {aantal}
      </span>
      {plaats > 0 && <span className="text-lg text-slate-600">plaats {plaats}</span>}
      <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
        ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
      </span>
    </div>
  );

  if (klaar || sessie.status === 'einde' || (resterend !== null && resterend <= 0)) {
    return (
      <div className="breed space-y-4">
        <div className="rounded-2xl bg-surface p-6 text-center shadow-sm">
          <div className="text-5xl">{klaar ? '🎉' : '🧩'}</div>
          <h1 className="mt-2 text-3xl font-bold">{klaar ? 'De puzzel is af!' : sessie.status === 'einde' ? 'Het spel is gedaan!' : 'De tijd is om!'}</h1>
          <p className="mt-2 text-xl text-slate-600">
            {klaar ? `in ${tijdTekst(t.klaarMs!)}` : `${rij?.punten ?? t.stukjes.length} van ${aantal} stukjes`}
            {plaats > 0 && ` · plaats ${plaats}`}
          </p>
          {sessie.status === 'einde' && nieuwSpel}
        </div>
        {foto && klaar && <img src={foto} alt="De puzzel" className="mx-auto max-h-[60vh] rounded-xl shadow-sm" />}
      </div>
    );
  }

  const vraagAntwoorden = eigen.filter((a) => !isActie(a.vraagNr)).sort((a, b) => a.vraagNr - b.vraagNr);
  const laatsteVraag = vraagAntwoorden.at(-1);
  const volgendeNr = laatsteVraag ? laatsteVraag.vraagNr + 1 : 0;
  const wachtNaFout = laatsteVraag?.juist === false ? Math.ceil((sessie.wachttijd * 1000 - (nu - (foutGezien.current.get(laatsteVraag.id) ?? nu))) / 1000) : 0;

  let inhoud: ReactNode;
  if (!spelerId) inhoud = <Kaart>Verbinden…</Kaart>;
  else if (alles) inhoud = <Kaart>{juistGelegd ? '⏳ Even nakijken…' : '🧩 Je hebt alle stukjes! Leg de puzzel af.'}</Kaart>;
  else if (wacht) inhoud = <Kaart>⏳ Wordt nagekeken…</Kaart>;
  else if (laatsteVraag?.juist === false && !verder.has(laatsteVraag.id)) {
    const foutAntwoord = laatsteVraag;
    inhoud = (
      <FoutAntwoord
        vraag={vragen[vraagIndex(spelerId, foutAntwoord.vraagNr, vragen.length)]}
        antwoord={foutAntwoord.antwoord}
        beloning={foutAntwoord.beloning}
        seconden={Math.max(0, wachtNaFout)}
        onVerder={() => setVerder((v) => new Set(v).add(foutAntwoord.id))}
      />
    );
  } else if (vragen.length === 0) inhoud = <Kaart>⚠️ Er zijn geen vragen gevonden voor dit spel.</Kaart>;
  else {
    const v = vragen[vraagIndex(spelerId, volgendeNr, vragen.length)];
    inhoud = (
      <Kaart>
        {laatsteVraag?.juist && <div className="mb-2 font-semibold text-emerald-700">✓ Juist! Een nieuw stukje.</div>}
        {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
        <RichText text={v.tekst} className="mb-4 text-2xl leading-snug font-medium" />
        <Beantwoord key={volgendeNr} vraag={v} zaad={`${spelerId}:${volgendeNr}`} onVerstuur={(a) => stuur(volgendeNr, a)} />
      </Kaart>
    );
  }

  return (
    <div className="breed space-y-3">
      {kop}
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {inhoud}
        <div className="space-y-3">
          {!foto ? (
            <Kaart>Foto laden…</Kaart>
          ) : (
            <>
              <div
                className="mx-auto grid overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-100"
                // Past samen met de stukjes op een laptopscherm, zonder scrollen.
                style={{ gridTemplateColumns: `repeat(${p.kolommen}, 1fr)`, gridTemplateRows: `repeat(${p.rijen}, 1fr)`, aspectRatio: String(p.verhouding), maxWidth: `calc(48vh * ${p.verhouding})` }}
                aria-label="Puzzel"
              >
                {ligging.map((s, i) => (
                  <div
                    key={i}
                    data-plaats={i}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      leg(neem(e), i);
                    }}
                    onClick={() => (gekozen !== null ? leg(gekozen, i) : s >= 0 && setGekozen(s))}
                    className={`cursor-pointer border border-white/60 ${s < 0 ? 'bg-slate-200/70' : ''} ${gekozen !== null && s === gekozen ? 'ring-4 ring-[var(--accent)] ring-inset' : ''}`}
                    style={s >= 0 ? stukStijl(s, p, foto) : undefined}
                  >
                    {s >= 0 && <div draggable onDragStart={sleep(s)} className="h-full w-full" data-gelegd={s} />}
                  </div>
                ))}
              </div>
              {ligging.every((s) => s >= 0) && !juistGelegd && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">Sommige stukjes liggen nog verkeerd.</p>}
              <div
                className="flex min-h-16 flex-wrap gap-1.5 rounded-xl border-2 border-dashed border-slate-300 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  terugInBak(neem(e));
                }}
                aria-label="Je stukjes"
              >
                {bak.map((s) => (
                  <div
                    key={s}
                    data-stuk={s}
                    draggable
                    onDragStart={sleep(s)}
                    onClick={() => setGekozen(gekozen === s ? null : s)}
                    className={`cursor-grab rounded border border-white shadow ${gekozen === s ? 'ring-4 ring-[var(--accent)]' : ''}`}
                    style={{ ...stukStijl(s, p, foto), height: `${(48 / p.rijen) * 0.7}vh`, minHeight: '3rem', aspectRatio: String(vakVerhouding) }}
                  />
                ))}
                {bak.length === 0 && <span className="self-center px-2 text-sm text-slate-500">Elk juist antwoord geeft een nieuw stukje. Sleep het naar de juiste plaats.</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 text-lg shadow-sm">{children}</div>;
}
