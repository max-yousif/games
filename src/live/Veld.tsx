import { useEffect, useRef, useState } from 'react';
import { BREEDTE, HOOGTE, KLEUREN, MAX_PUNTEN, schilder } from './territorium';

const SCHAAL = 10;

function teken(ctx: CanvasRenderingContext2D, veld: Uint8Array) {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, BREEDTE * SCHAAL, HOOGTE * SCHAAL);
  // Een zacht dambord op leeg gebied, zodat je ziet waar nog niets is.
  ctx.fillStyle = '#eef2f7';
  for (let y = 0; y < HOOGTE; y++) for (let x = (y % 2) as number; x < BREEDTE; x += 2) ctx.fillRect(x * SCHAAL, y * SCHAAL, SCHAAL, SCHAAL);
  for (let i = 0; i < veld.length; i++) {
    const v = veld[i];
    if (!v) continue;
    ctx.fillStyle = KLEUREN[(v - 1) % KLEUREN.length];
    ctx.fillRect((i % BREEDTE) * SCHAAL, Math.floor(i / BREEDTE) * SCHAAL, SCHAAL, SCHAAL);
  }
}

/** Het veld, enkel om te bekijken. */
export function VeldBeeld({ veld, className = '' }: { veld: Uint8Array; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) teken(ctx, veld);
  }, [veld]);
  return <canvas ref={ref} width={BREEDTE * SCHAAL} height={HOOGTE * SCHAAL} className={`aspect-[8/5] w-full rounded-xl border-2 border-slate-300 bg-white ${className}`} aria-label="Speelveld" />;
}

type Fase = 'wacht' | 'bezig' | 'klaar';

/** Lengte van het antwoord: 4 tekens per punt en 1 per lijn (de server bewaart hoogstens 2000 tekens). */
const lengte = (lijnen: [number, number][][]) => lijnen.reduce((n, l) => n + l.length * 4 + 1, 0);

/**
 * Tekenen op het veld, over het hele scherm (zodat er niets kan scrollen). De tijd start bij de
 * eerste klik of aanraking; daarna gaan de lijnen naar `onKlaar`. Wat je tekent, zie je meteen.
 */
export function VeldTekenen({
  veld,
  kleur,
  straal,
  seconden,
  onKlaar,
  onOverslaan,
}: {
  veld: Uint8Array;
  kleur: number;
  straal: number;
  seconden: number;
  onKlaar: (lijnen: [number, number][][]) => void;
  onOverslaan: () => void;
}) {
  const duur = seconden * 1000;
  const ref = useRef<HTMLCanvasElement>(null);
  const laag = useRef<HTMLDivElement>(null);
  const kopie = useRef(new Uint8Array(veld));
  const lijnen = useRef<[number, number][][]>([]);
  const omlaag = useRef(false);
  const klaar = useRef(false);
  const [fase, setFase] = useState<Fase>('wacht');
  const [rest, setRest] = useState(duur);
  const start = useRef(0);
  const kleurCode = KLEUREN[kleur % KLEUREN.length];

  // Zolang er getekend wordt: de pagina niet laten scrollen (muiswiel, touchpad, aanraakscherm).
  useEffect(() => {
    const vorig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = laag.current;
    const stop = (e: Event) => e.preventDefault();
    el?.addEventListener('wheel', stop, { passive: false });
    el?.addEventListener('touchmove', stop, { passive: false });
    return () => {
      document.body.style.overflow = vorig;
      el?.removeEventListener('wheel', stop);
      el?.removeEventListener('touchmove', stop);
    };
  }, []);

  // Het veld van de server kan intussen veranderen: opnieuw beginnen van dat veld zolang er niet getekend werd.
  useEffect(() => {
    if (fase !== 'wacht') return;
    kopie.current = new Uint8Array(veld);
    const ctx = ref.current?.getContext('2d');
    if (ctx) teken(ctx, kopie.current);
  }, [veld, fase]);

  const stop = () => {
    if (klaar.current) return;
    klaar.current = true;
    omlaag.current = false;
    setFase('klaar');
    onKlaar(lijnen.current.filter((l) => l.length));
  };

  useEffect(() => {
    if (fase !== 'bezig') return;
    const id = window.setInterval(() => {
      const r = duur - (Date.now() - start.current);
      setRest(Math.max(0, r));
      if (r <= 0) stop();
    }, 40);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const punt = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(BREEDTE - 0.01, ((e.clientX - r.left) / r.width) * BREEDTE));
    const y = Math.max(0, Math.min(HOOGTE - 0.01, ((e.clientY - r.top) / r.height) * HOOGTE));
    return [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
  };

  const verf = (a: [number, number], b: [number, number]) => {
    schilder(kopie.current, [[a, b]], straal, kleur + 1);
    const ctx = ref.current?.getContext('2d');
    if (ctx) teken(ctx, kopie.current);
  };

  return (
    <div
      ref={laag}
      className="fixed inset-0 z-50 flex touch-none flex-col items-center justify-center gap-3 overscroll-none bg-slate-900/95 p-4 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex w-full max-w-[min(100%,calc((100vh-9rem)*1.6))] items-center gap-4 text-white">
        <span className="inline-block h-9 w-9 shrink-0 rounded-lg border-2 border-white/60" style={{ background: kleurCode }} aria-hidden />
        <div className="font-mono text-4xl font-bold tabular-nums" aria-live="polite">
          {fase === 'klaar' ? '✓' : `${(rest / 1000).toFixed(1)} s`}
        </div>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-white/20" aria-label="Tijd">
          <div className="h-full rounded-full" style={{ width: `${(rest / duur) * 100}%`, background: kleurCode }} />
        </div>
        <span className="text-sm text-white/70" title="Penseel (groter met een reeks juiste antwoorden)">
          penseel {'●'.repeat(Math.round(straal * 2))}
        </span>
        {fase === 'wacht' && (
          <button type="button" onClick={onOverslaan} className="rounded-lg px-3 py-1 text-sm text-white/70 underline hover:text-white">
            Niet tekenen
          </button>
        )}
      </div>
      <div className="relative">
        <canvas
          ref={ref}
          width={BREEDTE * SCHAAL}
          height={HOOGTE * SCHAAL}
          data-tekenveld
          className={`block aspect-[8/5] touch-none rounded-xl border-4 bg-white ${fase === 'klaar' ? 'opacity-70' : 'cursor-crosshair'}`}
          style={{ borderColor: kleurCode, width: 'min(calc(100vw - 2rem), calc((100vh - 9rem) * 1.6))' }}
          aria-label="Tekenveld"
          onPointerDown={(e) => {
            e.preventDefault();
            if (klaar.current) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            if (fase === 'wacht') {
              start.current = Date.now();
              setFase('bezig');
            }
            omlaag.current = true;
            const p = punt(e);
            lijnen.current.push([p]);
            verf(p, p);
          }}
          onPointerMove={(e) => {
            if (!omlaag.current || klaar.current) return;
            const lijn = lijnen.current.at(-1)!;
            const vorig = lijn.at(-1)!;
            const p = punt(e);
            if (Math.hypot(p[0] - vorig[0], p[1] - vorig[1]) < 0.75) return;
            lijn.push(p);
            verf(vorig, p);
            if (lengte(lijnen.current) > 1850 || lijnen.current.flat().length >= MAX_PUNTEN) stop();
          }}
          onPointerUp={() => {
            omlaag.current = false;
          }}
        />
        {fase === 'wacht' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-slate-900/80 px-6 py-4 text-center text-white shadow-lg">
              <div className="text-3xl font-bold">🖌️ Teken zo snel mogelijk!</div>
              <div className="mt-1 text-lg">Klik en sleep (of raak aan): je hebt {seconden} seconden.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
