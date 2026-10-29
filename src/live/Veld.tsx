import { useEffect, useRef, useState } from 'react';
import { BREEDTE, HOOGTE, INKT, KLEUREN, MAX_PUNTEN, schilder, TEKEN_MS } from './territorium';

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

/**
 * Tekenen op het veld: de tijd (3 s) start bij de eerste aanraking; daarna of als de inkt op is,
 * gaan de lijnen naar `onKlaar`. Wat je tekent, zie je meteen (op een kopie van het veld).
 */
export function VeldTekenen({ veld, kleur, straal, onKlaar }: { veld: Uint8Array; kleur: number; straal: number; onKlaar: (lijnen: [number, number][][]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kopie = useRef(new Uint8Array(veld));
  const lijnen = useRef<[number, number][][]>([]);
  const inkt = useRef(INKT);
  const omlaag = useRef(false);
  const klaar = useRef(false);
  const [fase, setFase] = useState<Fase>('wacht');
  const [rest, setRest] = useState(TEKEN_MS);
  const [inktOver, setInktOver] = useState(1);
  const start = useRef(0);

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
      const r = TEKEN_MS - (Date.now() - start.current);
      setRest(Math.max(0, r));
      if (r <= 0) stop();
    }, 50);
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

  const aantalPunten = () => lijnen.current.reduce((n, l) => n + l.length, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold">{fase === 'wacht' ? '🖌️ Teken!' : fase === 'bezig' ? `⏱ ${(rest / 1000).toFixed(1)} s` : '✓ Klaar'}</div>
        <div className="flex flex-1 items-center gap-2" aria-label="Inkt">
          <span className="text-sm text-slate-500">inkt</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full transition-[width]" style={{ width: `${inktOver * 100}%`, background: KLEUREN[kleur % KLEUREN.length] }} />
          </div>
        </div>
      </div>
      <canvas
        ref={ref}
        width={BREEDTE * SCHAAL}
        height={HOOGTE * SCHAAL}
        data-tekenveld
        className={`mx-auto block aspect-[8/5] touch-none rounded-xl border-4 bg-white ${fase === 'klaar' ? 'opacity-70' : 'cursor-crosshair'}`}
        // Zo groot mogelijk, maar volledig op het scherm (ook op een kleine laptop).
        style={{ borderColor: KLEUREN[kleur % KLEUREN.length], width: 'min(100%, calc((100vh - 250px) * 1.6))' }}
        aria-label="Tekenveld"
        onPointerDown={(e) => {
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
          const d = Math.hypot(p[0] - vorig[0], p[1] - vorig[1]);
          if (d < 0.5) return;
          const stuk = Math.min(d, inkt.current);
          const echt: [number, number] = stuk < d ? [vorig[0] + ((p[0] - vorig[0]) * stuk) / d, vorig[1] + ((p[1] - vorig[1]) * stuk) / d] : p;
          lijn.push(echt);
          verf(vorig, echt);
          inkt.current -= stuk;
          setInktOver(Math.max(0, inkt.current / INKT));
          if (inkt.current <= 0 || aantalPunten() >= MAX_PUNTEN) stop();
        }}
        onPointerUp={() => {
          omlaag.current = false;
        }}
      />
      <p className="text-sm text-slate-500">{fase === 'wacht' ? 'Raak het veld aan om te beginnen: je hebt 3 seconden en een beperkte hoeveelheid inkt.' : fase === 'bezig' ? 'Kleur zoveel mogelijk gebied in!' : 'Doorgestuurd.'}</p>
    </div>
  );
}
