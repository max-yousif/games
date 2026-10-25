import { describe, expect, it } from 'vitest';
import { bouwRooster, isVol, RIJEN, vrijeRij, winnaar } from '../src/lib/connectFour';
import type { Zet } from '../src/lib/types';

const zetten = (...lijst: [number, number][]): Zet[] => lijst.map(([team, kolom]) => ({ team, kolom }));

describe('vier op een rij', () => {
  it('stapelt schijven van onder naar boven', () => {
    const r = bouwRooster(zetten([0, 2], [1, 2]));
    expect(r[RIJEN - 1][2]).toBe(0);
    expect(r[RIJEN - 2][2]).toBe(1);
    expect(vrijeRij(r, 2)).toBe(RIJEN - 3);
  });

  it('herkent horizontaal, verticaal en diagonaal', () => {
    expect(winnaar(bouwRooster(zetten([0, 0], [0, 1], [0, 2], [0, 3])))?.team).toBe(0);
    expect(winnaar(bouwRooster(zetten([1, 4], [1, 4], [1, 4], [1, 4])))?.team).toBe(1);
    // Diagonaal: team 0 op (kolom 0, hoogte 1), (1, 2), (2, 3), (3, 4).
    const diag = zetten([0, 0], [1, 1], [0, 1], [1, 2], [1, 2], [0, 2], [1, 3], [1, 3], [1, 3], [0, 3]);
    expect(winnaar(bouwRooster(diag))).toMatchObject({ team: 0 });
    expect(winnaar(bouwRooster(zetten([0, 0], [0, 1], [0, 2])))).toBeNull();
  });

  it('herkent een vol rooster', () => {
    const alles = Array.from({ length: 42 }, (_, i) => ({ team: 0, kolom: i % 7 }));
    expect(isVol(bouwRooster(alles))).toBe(true);
    expect(isVol(bouwRooster([]))).toBe(false);
  });
});
