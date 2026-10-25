import type { Zet } from './types';

export const RIJEN = 6;
export const KOLOMMEN = 7;

/** Rooster [rij][kolom] met team-index of null; rij 0 is boven. */
export type Rooster = (number | null)[][];

export function bouwRooster(zetten: readonly Zet[]): Rooster {
  const r: Rooster = Array.from({ length: RIJEN }, () => Array<number | null>(KOLOMMEN).fill(null));
  for (const z of zetten) {
    const rij = vrijeRij(r, z.kolom);
    if (rij !== null) r[rij][z.kolom] = z.team;
  }
  return r;
}

/** Laagste vrije rij in een kolom, of null als de kolom vol is. */
export function vrijeRij(r: Rooster, kolom: number): number | null {
  for (let rij = RIJEN - 1; rij >= 0; rij--) if (r[rij][kolom] === null) return rij;
  return null;
}

export function isVol(r: Rooster): boolean {
  return r[0].every((c) => c !== null);
}

/** Team dat vier op een rij heeft, met de winnende vakjes; null als er (nog) geen winnaar is. */
export function winnaar(r: Rooster): { team: number; vakjes: [number, number][] } | null {
  const richtingen: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let rij = 0; rij < RIJEN; rij++) {
    for (let kol = 0; kol < KOLOMMEN; kol++) {
      const team = r[rij][kol];
      if (team === null) continue;
      for (const [dr, dk] of richtingen) {
        const vakjes: [number, number][] = [];
        for (let i = 0; i < 4; i++) {
          const rr = rij + dr * i;
          const kk = kol + dk * i;
          if (rr < 0 || rr >= RIJEN || kk < 0 || kk >= KOLOMMEN || r[rr][kk] !== team) break;
          vakjes.push([rr, kk]);
        }
        if (vakjes.length === 4) return { team, vakjes };
      }
    }
  }
  return null;
}
