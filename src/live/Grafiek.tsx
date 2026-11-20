import { VENSTER, XS } from './grafiekjacht';

const S = 40; // pixels per eenheid
const B = (VENSTER.xMax - VENSTER.xMin) * S;
const H = (VENSTER.yMax - VENSTER.yMin) * S;
const px = (x: number) => (x - VENSTER.xMin) * S;
const py = (y: number) => (VENSTER.yMax - y) * S;

/** Een SVG-pad door de punten; onderbroken waar de grafiek niet bestaat of verspringt (asymptoot). */
export function pad(ys: readonly (number | null)[], xs: readonly number[] = XS): string {
  let d = '';
  let vorige: number | null = null;
  ys.forEach((y, i) => {
    const sprong = y !== null && vorige !== null && Math.abs(y - vorige) > VENSTER.yMax - VENSTER.yMin;
    if (y === null) {
      vorige = null;
      return;
    }
    // Ver buiten beeld afknippen, zodat de lijn er netjes uit loopt.
    const yy = Math.max(VENSTER.yMin - 2, Math.min(VENSTER.yMax + 2, y));
    d += `${vorige === null || sprong ? 'M' : 'L'}${px(xs[i]).toFixed(1)} ${py(yy).toFixed(1)}`;
    vorige = y;
  });
  return d;
}

/** Fijner bemonsteren voor de eigen grafiek (die verandert bij elke toetsaanslag). */
const FIJN = Array.from({ length: 641 }, (_, i) => VENSTER.xMin + i * 0.025);
export function padVan(f: (x: number) => number): string {
  return pad(
    FIJN.map((x) => {
      const y = f(x);
      return Number.isFinite(y) ? y : null;
    }),
    FIJN,
  );
}

const ROOSTER_X = Array.from({ length: VENSTER.xMax - VENSTER.xMin + 1 }, (_, i) => VENSTER.xMin + i);
const ROOSTER_Y = Array.from({ length: VENSTER.yMax - VENSTER.yMin + 1 }, (_, i) => VENSTER.yMin + i);

/** Punten van de doelgrafiek met gehele coördinaten: makkelijk af te lezen. */
export function roosterpunten(ys: readonly (number | null)[]): { x: number; y: number }[] {
  return XS.flatMap((x, i) => {
    const y = ys[i];
    return Number.isInteger(x) && y !== null && Math.abs(y - Math.round(y)) < 0.005 && y >= VENSTER.yMin && y <= VENSTER.yMax ? [{ x, y: Math.round(y) }] : [];
  });
}

/** Assenstelsel met de doelgrafiek (dik) en eventueel de eigen grafiek (gestreept). */
export function Grafiek({ doel, eigen, juist, klein = false }: { doel: readonly (number | null)[]; eigen?: string | null; juist?: boolean; klein?: boolean }) {
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className={`w-full rounded-xl bg-white ${klein ? '' : 'shadow-sm'}`} role="img" aria-label="Grafiek" data-grafiek>
      {ROOSTER_X.map((x) => (
        <line key={`x${x}`} x1={px(x)} x2={px(x)} y1={0} y2={H} stroke={x === 0 ? '#334155' : '#e2e8f0'} strokeWidth={x === 0 ? 2 : 1} />
      ))}
      {ROOSTER_Y.map((y) => (
        <line key={`y${y}`} y1={py(y)} y2={py(y)} x1={0} x2={B} stroke={y === 0 ? '#334155' : '#e2e8f0'} strokeWidth={y === 0 ? 2 : 1} />
      ))}
      {!klein &&
        ROOSTER_X.filter((x) => x !== 0 && x % 2 === 0 && x > VENSTER.xMin && x < VENSTER.xMax).map((x) => (
          <text key={`tx${x}`} x={px(x)} y={py(0) + 16} fontSize={13} textAnchor="middle" fill="#64748b">
            {x}
          </text>
        ))}
      {!klein &&
        ROOSTER_Y.filter((y) => y !== 0 && y % 2 === 0 && y > VENSTER.yMin && y < VENSTER.yMax).map((y) => (
          <text key={`ty${y}`} x={px(0) - 6} y={py(y) + 4} fontSize={13} textAnchor="end" fill="#64748b">
            {y}
          </text>
        ))}
      <path d={pad(doel)} fill="none" stroke={juist ? '#10b981' : '#2563eb'} strokeWidth={klein ? 5 : 6} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
      {!klein && roosterpunten(doel).map((p) => <circle key={`p${p.x}`} cx={px(p.x)} cy={py(p.y)} r={7} fill={juist ? '#059669' : '#1d4ed8'} stroke="#fff" strokeWidth={2} data-roosterpunt />)}
      {eigen && <path d={eigen} fill="none" stroke="#f97316" strokeWidth={3} strokeDasharray="10 6" strokeLinejoin="round" data-eigen-grafiek />}
    </svg>
  );
}
