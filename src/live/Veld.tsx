import { useEffect, useRef, useState } from 'react';
import { BREEDTE, codeerLijnen, HOOGTE, KLEUREN, leesLijnen, MAX_TEKENS, maxLengte, schilder, SNELHEID } from './territorium';

const SCHAAL = 10;

function teken(ctx: CanvasRenderingContext2D, veld: Uint8Array, masker: Uint8Array | null) {
  ctx.fillStyle = masker ? '#ffffff' : '#f8fafc';
  ctx.fillRect(0, 0, BREEDTE * SCHAAL, HOOGTE * SCHAAL);
  // Een zacht dambord op leeg gebied (bij samen inkleuren: enkel in de tekening), zodat je ziet waar nog niets is.
  ctx.fillStyle = '#eef2f7';
  for (let y = 0; y < HOOGTE; y++)
    for (let x = (y % 2) as number; x < BREEDTE; x += 2) if (!masker || masker[y * BREEDTE + x]) ctx.fillRect(x * SCHAAL, y * SCHAAL, SCHAAL, SCHAAL);
  for (let i = 0; i < veld.length; i++) {
    const v = veld[i];
    if (!v) continue;
    ctx.fillStyle = KLEUREN[(v - 1) % KLEUREN.length];
    ctx.fillRect((i % BREEDTE) * SCHAAL, Math.floor(i / BREEDTE) * SCHAAL, SCHAAL, SCHAAL);
  }
  if (!masker) return;
  // De omtrek van de tekening.
  const binnen = (x: number, y: number) => x >= 0 && y >= 0 && x < BREEDTE && y < HOOGTE && masker[y * BREEDTE + x] === 1;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < HOOGTE; y++)
    for (let x = 0; x < BREEDTE; x++) {
      if (!binnen(x, y)) continue;
      const [l, r, b, o] = [x * SCHAAL, (x + 1) * SCHAAL, y * SCHAAL, (y + 1) * SCHAAL];
      if (!binnen(x - 1, y)) (ctx.moveTo(l, b), ctx.lineTo(l, o));
      if (!binnen(x + 1, y)) (ctx.moveTo(r, b), ctx.lineTo(r, o));
      if (!binnen(x, y - 1)) (ctx.moveTo(l, b), ctx.lineTo(r, b));
      if (!binnen(x, y + 1)) (ctx.moveTo(l, o), ctx.lineTo(r, o));
    }
  ctx.stroke();
}

/** Het veld, enkel om te bekijken. */
export function VeldBeeld({ veld, masker = null, className = '' }: { veld: Uint8Array; masker?: Uint8Array | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) teken(ctx, veld, masker);
  }, [veld, masker]);
  return <canvas ref={ref} width={BREEDTE * SCHAAL} height={HOOGTE * SCHAAL} className={`aspect-[8/5] w-full rounded-xl border-2 border-slate-300 bg-white ${className}`} aria-label="Speelveld" />;
}

type Fase = 'wacht' | 'bezig' | 'klaar';

/**
 * Tekenen op het veld, over het hele scherm (zodat er niets kan scrollen). De tijd start bij de
 * eerste klik of aanraking; daarna gaan de lijnen naar `onKlaar`. Wat je tekent, zie je meteen.
 * Het penseel volgt de muis of vinger met een vaste snelheid (SNELHEID): sneller slepen helpt niet.
 */
export function VeldTekenen({
  veld,
  kleur,
  straal,
  seconden,
  masker = null,
  onKlaar,
  onOverslaan,
}: {
  veld: Uint8Array;
  kleur: number;
  straal: number;
  seconden: number;
  masker?: Uint8Array | null;
  onKlaar: (lijnen: [number, number][][]) => void;
  onOverslaan: () => void;
}) {
  const duur = seconden * 1000;
  const ref = useRef<HTMLCanvasElement>(null);
  const laag = useRef<HTMLDivElement>(null);
  const kopie = useRef(new Uint8Array(veld));
  const lijnen = useRef<[number, number][][]>([]);
  const omlaag = useRef(false);
  /** Waar de muis of vinger is en waar het penseel is (in vakjes). */
  const doel = useRef<[number, number]>([0, 0]);
  const pen = useRef<[number, number]>([0, 0]);
  const vorigeTijd = useRef(0);
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
    if (ctx) teken(ctx, kopie.current, masker);
  }, [veld, fase, masker]);

  const stop = () => {
    if (klaar.current) return;
    klaar.current = true;
    omlaag.current = false;
    toon(codeerLijnen(lijnen.current), false);
    setFase('klaar');
    onKlaar(lijnen.current.filter((l) => l.length));
  };

  // Het penseel naar de muis of vinger laten bewegen, met de vaste snelheid.
  const beweegPen = (nu: number) => {
    const dt = Math.min(0.1, (nu - vorigeTijd.current) / 1000);
    vorigeTijd.current = nu;
    if (!omlaag.current || klaar.current) return;
    const [px, py] = pen.current;
    const [dx, dy] = [doel.current[0] - px, doel.current[1] - py];
    const afstand = Math.hypot(dx, dy);
    if (afstand < 0.01) return;
    const stap = Math.min(afstand, SNELHEID * dt);
    pen.current = [px + (dx / afstand) * stap, py + (dy / afstand) * stap];
    const lijn = lijnen.current.at(-1)!;
    const vorig = lijn.at(-1)!;
    const p = vakMidden(pen.current);
    if (p[0] === vorig[0] && p[1] === vorig[1]) return;
    lijn.push(p);
    const code = codeerLijnen(lijnen.current);
    // Bijna te lang voor de server: hier stoppen (wat je ziet, is wat bewaard wordt).
    if (code.length > MAX_TEKENS) {
      lijn.pop();
      stop();
      return;
    }
    toon(code);
  };

  useEffect(() => {
    if (fase !== 'bezig') return;
    let id = 0;
    const lus = () => {
      const r = duur - (Date.now() - start.current);
      setRest(Math.max(0, r));
      if (r <= 0) return stop();
      beweegPen(performance.now());
      id = requestAnimationFrame(lus);
    };
    id = requestAnimationFrame(lus);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const punt = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(BREEDTE - 0.01, ((e.clientX - r.left) / r.width) * BREEDTE)), Math.max(0, Math.min(HOOGTE - 0.01, ((e.clientY - r.top) / r.height) * HOOGTE))];
  };
  // Het midden van het vakje: precies zoals het bord de tekening leest.
  const vakMidden = ([x, y]: [number, number]): [number, number] => [Math.floor(x) + 0.5, Math.floor(y) + 0.5];

  // Tonen wat het bord zal bewaren: de tekening gecodeerd en terug gelezen, op het veld van de server.
  const toon = (code: string, metPen = true) => {
    kopie.current = new Uint8Array(veld);
    schilder(kopie.current, leesLijnen(code), straal, kleur + 1, maxLengte(seconden), masker);
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    teken(ctx, kopie.current, masker);
    if (!metPen) return;
    // Het penseel zelf: een ring.
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pen.current[0] * SCHAAL, pen.current[1] * SCHAAL, Math.max(4, straal * SCHAAL + 2), 0, 2 * Math.PI);
    ctx.stroke();
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
            doel.current = punt(e);
            pen.current = doel.current;
            vorigeTijd.current = performance.now();
            lijnen.current.push([vakMidden(pen.current)]);
            toon(codeerLijnen(lijnen.current));
          }}
          onPointerMove={(e) => {
            if (omlaag.current) doel.current = punt(e);
          }}
          onPointerUp={() => {
            omlaag.current = false;
            if (!klaar.current) toon(codeerLijnen(lijnen.current), false);
          }}
        />
        {fase === 'wacht' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-slate-900/80 px-6 py-4 text-center text-white shadow-lg">
              <div className="text-3xl font-bold">{masker ? '🖌️ Kleur mee de tekening in!' : '🖌️ Teken zo snel mogelijk!'}</div>
              <div className="mt-1 text-lg">Klik en sleep (of raak aan): je hebt {seconden} seconden.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
