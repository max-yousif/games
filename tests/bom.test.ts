import { describe, expect, it } from 'vitest';
import { bomAntwoord, bomTijd, bomVragenOver, bomWinnaar, nieuweBom, ontploffing } from '../src/lib/bom';
import type { Sessie, Vraag } from '../src/lib/types';

const vragen = ['v1', 'v2', 'v3'].map((id) => ({ id }) as Vraag);
const sessie = (teams: number): Sessie =>
  ({
    id: 's',
    spelType: 'bom',
    vragen,
    vraagVolgorde: vragen.map((v) => v.id),
    teams: Array.from({ length: teams }, (_, i) => ({ naam: `T${i}`, kleur: '', leerlingen: [] })),
    beurten: [],
    beeindigd: null,
    bom: nieuweBom(teams, 'normaal'),
  }) as unknown as Sessie;

describe('bom doorgeven', () => {
  it('juist geeft de bom door, fout niet', () => {
    let s = bomAntwoord(sessie(3), vragen[0], false);
    expect(s.bom!.houder).toBe(0);
    s = bomAntwoord(s, vragen[1], true);
    expect(s.bom!.houder).toBe(1);
    expect(s.beurten.map((b) => [b.team, b.juist])).toEqual([
      [0, false],
      [0, true],
    ]);
  });

  it('telt ontploffingen; het spel stopt pas als alle vragen gesteld zijn', () => {
    let s = ontploffing(ontploffing(sessie(2)));
    expect(s.bom!.ontploffingen).toEqual([2, 0]);
    expect(s.beeindigd).toBeNull();
    s = bomAntwoord(s, vragen[0], true);
    s = bomAntwoord(s, vragen[1], true);
    expect(bomVragenOver(s)).toBe(1);
    expect(s.beeindigd).toBeNull();
    s = bomAntwoord(s, vragen[2], false);
    expect(s.beeindigd).not.toBeNull();
    expect(bomWinnaar(s)).toBe(1);
  });

  it('gelijk aantal ontploffingen: meeste juiste antwoorden wint, anders gelijkspel', () => {
    let s = bomAntwoord(sessie(2), vragen[0], true);
    expect(bomWinnaar(s)).toBe(0);
    s = bomAntwoord(s, vragen[1], true);
    expect(bomWinnaar(s)).toBeNull();
  });

  it('verborgen tijd binnen de grenzen', () => {
    expect(bomTijd('kort', () => 0)).toBe(20000);
    expect(bomTijd('kort', (n) => n - 1)).toBe(45000);
  });
});
