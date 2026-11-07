import { describe, expect, it } from 'vitest';
import {
  BASIS_IDS,
  bemonster,
  functieVanDoel,
  grafiekBeoordelingen,
  grafiekStand,
  maakDoelen,
  OVERSLAAN,
  publiek,
  voorschrift,
  zelfdeGrafiek,
  type Doel,
} from '../src/live/grafiekjacht';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';

const doel = (basis: Doel['basis'], a = 1, b = 1, c = 0, d = 0): Doel => ({ basis, a, b, c, d });

function antwoord(spelerId: string, vraagNr: number, tekst: string, poging = 1, juist: boolean | null = null, punten = 0, tijdMs = 1000): LiveAntwoord {
  return { id: `${spelerId}-${vraagNr}-${poging}`, spelerId, vraagNr, antwoord: tekst, tijdMs, juist, punten, poging, beloning: null } as LiveAntwoord;
}

describe('grafiekjacht', () => {
  it('schrijft het voorschrift netjes', () => {
    expect(voorschrift(doel('kwadraat', -2, 1, 3, 1))).toBe('-2(x-3)^2+1');
    expect(voorschrift(doel('kwadraat'))).toBe('x^2');
    expect(voorschrift(doel('wortel', 1, -1, -2, 0))).toBe('\\sqrt{-(x+2)}');
    expect(voorschrift(doel('abs', 0.5, 1, 0, -3))).toBe('\\frac{1}{2}\\left|x\\right|-3');
    expect(voorschrift(doel('sin', 3, 2, 0, 0))).toBe('3\\sin(2x)');
    expect(voorschrift(doel('omgekeerd', 2, 1, 1, 0))).toBe('2\\cdot\\frac{1}{x-1}');
  });

  it('het eigen voorschrift is altijd juist, voor elke basisfunctie en transformatie', () => {
    for (const d of maakDoelen(60, BASIS_IDS, ['verschuiven', 'uitrekken', 'spiegelen', 'horizontaal'])) expect(zelfdeGrafiek(voorschrift(d), d), voorschrift(d)).toBe(true);
  });

  it('gelijkwaardige voorschriften zijn juist, andere niet', () => {
    const d = doel('kwadraat', 1, 1, 2, -1);
    expect(zelfdeGrafiek('x^2-4x+3', d)).toBe(true);
    expect(zelfdeGrafiek('y = (x-2)^2 - 1', d)).toBe(true);
    expect(zelfdeGrafiek('(x+2)^2-1', d)).toBe(false);
    expect(zelfdeGrafiek('(x-2)^2-1.001', d)).toBe(false);
    expect(zelfdeGrafiek('kapot((', d)).toBe(null);
    expect(zelfdeGrafiek('|2x|', doel('abs', 2))).toBe(true);
    expect(zelfdeGrafiek('\\frac{1}{2}x^2', doel('kwadraat', 0.5))).toBe(true);
    // Een ander domein is een andere grafiek.
    expect(zelfdeGrafiek('\\sqrt{x}^2', doel('kwadraat'))).toBe(false);
  });

  it('maakt zichtbare, wisselende doelen met minstens één transformatie', () => {
    const doelen = maakDoelen(30, ['kwadraat', 'abs'], ['verschuiven']);
    for (const [i, d] of doelen.entries()) {
      expect(d.a).toBe(1);
      expect(d.c !== 0 || d.d !== 0).toBe(true);
      if (i > 0) expect(voorschrift(d)).not.toBe(voorschrift(doelen[i - 1]));
      expect(bemonster(functieVanDoel(d)).filter((y) => y !== null && Math.abs(y) <= 6).length).toBeGreaterThanOrEqual(40);
    }
  });

  it('de leerlingen krijgen punten, geen voorschrift', () => {
    const p = publiek([doel('kwadraat', 1, 1, 1, 0)]);
    expect(JSON.stringify(p)).not.toContain('x-1');
    expect(p.doelen[0].y[80]).toBe(1); // x = 0
  });

  it('kijkt na: punten per poging, overslaan pas na 2 foute pogingen', () => {
    const doelen = [doel('kwadraat', 1, 1, 1, 0), doel('abs', 1, 1, 0, 2)];
    const a = [antwoord('an', 0, '(x-1)^2'), antwoord('bo', 0, 'x^2'), antwoord('bo', 1, OVERSLAAN)];
    const b = grafiekBeoordelingen(doelen, a);
    expect(b.map((x) => [x.juist, x.punten])).toEqual([
      [true, 3],
      [false, 0],
      [false, 0],
    ]);
    expect(JSON.parse(b[0].beloning!).oplossing).toBe('(x-1)^2');

    const later = [antwoord('bo', 0, 'x^2', 1, false), antwoord('bo', 0, 'x', 2, false), antwoord('bo', 0, OVERSLAAN, 3), antwoord('an', 1, '|x|+2', 3)];
    const c = grafiekBeoordelingen(doelen, later);
    expect(c.map((x) => [x.juist, x.punten])).toEqual([
      [true, 0],
      [true, 1],
    ]);
    expect(JSON.parse(c[0].beloning!)).toEqual({ oplossing: '(x-1)^2', overgeslagen: true });
  });

  it('ranglijst: punten, dan rondes af, dan tijd', () => {
    const spelers = [
      { id: 'an', naam: 'An', bijnaam: null, verbonden: true },
      { id: 'bo', naam: 'Bo', bijnaam: null, verbonden: true },
      { id: 'cas', naam: 'Cas', bijnaam: null, verbonden: true },
    ] as LiveSpeler[];
    const a = [
      antwoord('an', 0, 'x', 1, true, 3, 5000),
      antwoord('bo', 0, 'x', 1, true, 3, 4000),
      antwoord('cas', 0, 'x', 1, false, 0),
      antwoord('cas', 0, OVERSLAAN, 3, true, 0, 2000),
    ];
    const s = grafiekStand(spelers, a);
    expect(s.map((r) => [r.naam, r.punten, r.juist, r.klaar])).toEqual([
      ['Bo', 3, 1, 1],
      ['An', 3, 1, 1],
      ['Cas', 0, 0, 1],
    ]);
  });
});
