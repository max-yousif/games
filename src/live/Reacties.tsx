import { useEffect, useRef, useState } from 'react';
import { REACTIES, type LiveBackend, type Reactie } from './types';

const WACHTTIJD = 5000;

/** Emoji-knoppen voor leerlingen terwijl ze wachten (max. één reactie per 5 s). */
export function ReactieKnoppen({ be, sessieId, naam }: { be: LiveBackend; sessieId: string; naam: string }) {
  const [tot, setTot] = useState(0);
  const [nu, setNu] = useState(() => Date.now());
  const [laatste, setLaatste] = useState<string | null>(null);
  const wacht = nu < tot;

  // Aftellen tot opnieuw reageren mag.
  useEffect(() => {
    if (!wacht) return;
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [wacht]);

  function stuur(emoji: string) {
    if (Date.now() < tot) return;
    setTot(Date.now() + WACHTTIJD);
    setNu(Date.now());
    setLaatste(emoji);
    void be.reageer(sessieId, { emoji, naam }).catch(() => {});
  }

  return (
    <div className="mt-6 text-center">
      <div className="text-sm text-slate-500">{wacht ? `Opnieuw reageren over ${Math.ceil((tot - nu) / 1000)} s` : 'Reageer terwijl je wacht:'}</div>
      <div className="mt-2 flex flex-wrap justify-center gap-2" role="group" aria-label="Reacties">
        {REACTIES.map((r) => (
          <button
            key={r.emoji}
            type="button"
            disabled={wacht}
            onClick={() => stuur(r.emoji)}
            title={r.naam}
            aria-label={r.naam}
            className={`h-14 w-14 rounded-2xl bg-surface text-3xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-90 disabled:opacity-50 ${
              wacht && laatste === r.emoji ? 'ring-4 ring-[var(--accent-soft)]' : ''
            }`}
          >
            {r.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Zweef extends Reactie {
  id: number;
  links: number;
  duur: number;
}

const SLEUTEL = 'klasspelen.reacties-tonen';

/** Of reacties op het bord getoond worden (keuze van de leerkracht, onthouden op deze laptop). */
export function useReactiesTonen(): [boolean, (aan: boolean) => void] {
  const [aan, setAan] = useState(() => {
    try {
      return localStorage.getItem(SLEUTEL) !== '0';
    } catch {
      return true;
    }
  });
  return [
    aan,
    (waarde) => {
      setAan(waarde);
      try {
        localStorage.setItem(SLEUTEL, waarde ? '1' : '0');
      } catch {
        // geen opslag
      }
    },
  ];
}

/** Reacties van de leerlingen zweven over het bord van de leerkracht. */
export function ReactieRegen({ be, sessieId }: { be: LiveBackend; sessieId: string }) {
  const [zwevend, setZwevend] = useState<Zweef[]>([]);
  const volgnummer = useRef(0);
  // Ook op het bord: per naam hoogstens één reactie per 5 seconden.
  const laatstePerNaam = useRef(new Map<string, number>());

  useEffect(
    () =>
      be.volgReacties(sessieId, (r) => {
        const nu = Date.now();
        if (nu - (laatstePerNaam.current.get(r.naam) ?? 0) < WACHTTIJD - 500) return;
        laatstePerNaam.current.set(r.naam, nu);
        const z: Zweef = { ...r, id: volgnummer.current++, links: 5 + Math.random() * 85, duur: 3 + Math.random() * 1.5 };
        // Maximaal 40 tegelijk, zodat een klas die blijft klikken het bord niet overspoelt.
        setZwevend((lijst) => [...lijst.slice(-39), z]);
        window.setTimeout(() => setZwevend((lijst) => lijst.filter((x) => x.id !== z.id)), z.duur * 1000);
      }),
    [be, sessieId],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden="true">
      {zwevend.map((z) => (
        <div key={z.id} className="reactie-zweef absolute bottom-0 flex flex-col items-center" style={{ left: `${z.links}%`, animationDuration: `${z.duur}s` }}>
          <span className="text-6xl drop-shadow">{z.emoji}</span>
          <span className="mt-1 max-w-40 truncate rounded-full bg-white/90 px-2 py-0.5 text-sm font-medium text-slate-700 shadow-sm">{z.naam}</span>
        </div>
      ))}
    </div>
  );
}
