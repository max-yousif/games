import { describe, expect, it } from 'vitest';
import { bomAntwoord, bomTijd, bomWinnaar, nieuweBom, ontploffing, volgendTeam } from '../src/lib/bom';
import type { Sessie, Vraag } from '../src/lib/types';

const vraag = { id: 'v1' } as Vraag;
const sessie = (teams: number, levens = 2): Sessie =>
  ({ id: 's', spelType: 'bom', teams: Array.from({ length: teams }, (_, i) => ({ naam: `T${i}`, kleur: '', leerlingen: [] })), beurten: [], beeindigd: null, bom: nieuweBom(teams, levens, 'normaal') }) as unknown as Sessie;

describe('bom doorgeven', () => {
  it('juist geeft de bom door, fout niet', () => {
    let s = bomAntwoord(sessie(3), vraag, false);
    expect(s.bom!.houder).toBe(0);
    s = bomAntwoord(s, vraag, true);
    expect(s.bom!.houder).toBe(1);
    expect(s.beurten.map((b) => [b.team, b.juist, b.punten])).toEqual([
      [0, false, 0],
      [0, true, 1],
    ]);
  });

  it('ontploffing kost een leven; wie eruit ligt, wordt overgeslagen', () => {
    let s = ontploffing(sessie(3, 1)); // team 0 eruit
    expect(s.bom!.levens).toEqual([0, 1, 1]);
    expect(s.bom!.houder).toBe(1);
    expect(volgendTeam(s.bom!, 2)).toBe(1);
    s = bomAntwoord(s, vraag, true);
    expect(s.bom!.houder).toBe(2);
    s = ontploffing(s); // team 2 eruit: team 1 wint
    expect(s.beeindigd).not.toBeNull();
    expect(bomWinnaar(s)).toBe(1);
  });

  it('getroffen team met levens begint opnieuw', () => {
    const s = ontploffing(sessie(2, 3));
    expect(s.bom).toMatchObject({ levens: [2, 3], houder: 0, ronde: 1 });
    expect(s.beeindigd).toBeNull();
  });

  it('verborgen tijd binnen de grenzen', () => {
    expect(bomTijd('kort', () => 0)).toBe(20000);
    expect(bomTijd('kort', (n) => n - 1)).toBe(45000);
  });
});
