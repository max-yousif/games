import { describe, expect, it } from 'vitest';
import {
  BASIS_IDS,
  bemonster,
  functieVanDoel,
  grafiekBeoordelingen,
  grafiekStand,
  aantalTransformaties,
  maakDoelen,
  onbekenden,
  vorm,
  OVERSLAAN,
  publiek,
  voorschrift,
  zelfdeGrafiek,
  type Doel,
} from '../src/live/grafiekjacht';
import { roosterpunten } from '../src/live/Grafiek';
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

  it('bouwt op: eerst één transformatie, op het einde alle gekozen', () => {
    const aantal = (d: Doel) => [d.c !== 0 || d.d !== 0, Math.abs(d.a) !== 1, d.a < 0 || d.b < 0].filter(Boolean).length;
    const doelen = maakDoelen(9, ['kwadraat', 'abs', 'wortel'], ['verschuiven', 'uitrekken', 'spiegelen']);
    expect(doelen.slice(0, 3).map(aantal)).toEqual([1, 1, 1]);
    expect(doelen.slice(3, 6).map(aantal)).toEqual([2, 2, 2]);
    expect(doelen.slice(6).map(aantal)).toEqual([3, 3, 3]);
    expect(aantalTransformaties(0, 10, 2)).toBe(1);
    expect(aantalTransformaties(9, 10, 2)).toBe(2);
  });

  it('bij de sinus telkens één transformatie meer', () => {
    const aantal = (d: Doel) => [d.c !== 0 || d.d !== 0, Math.abs(d.a) !== 1, Math.abs(d.b) !== 1, d.a < 0 || d.b < 0].filter(Boolean).length;
    const doelen = maakDoelen(9, ['sin'], ['verschuiven', 'uitrekken', 'spiegelen', 'horizontaal']);
    expect(doelen.slice(0, 3).map(aantal)).toEqual([2, 2, 2]);
    expect(doelen.slice(3, 6).map(aantal)).toEqual([3, 3, 3]);
    expect(doelen.slice(6).map(aantal)).toEqual([4, 4, 4]);
  });

  it('de vorm toont enkel de letters die meedoen', () => {
    expect(vorm(doel('kwadraat', -2, 1, 3, 1))).toBe('a(x-c)^2+d');
    expect(vorm(doel('wortel', 1, 1, 0, 2))).toBe('\\sqrt{x}+d');
    expect(vorm(doel('omgekeerd', 2, 2, 0, 0))).toBe('a\\cdot\\frac{1}{bx}');
    expect(onbekenden(vorm(doel('kwadraat', -2, 1, 3, 1)))).toBe('a, c en d');
    expect(onbekenden(vorm(doel('omgekeerd', 2, 2, 0, 0)))).toBe('a en b');
    expect(onbekenden(vorm(doel('abs', 1, 1, 2, 0)))).toBe('c');
    expect(onbekenden(vorm(doel('sin', 1, -1, 0, 0)))).toBe('b');
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

describe('roosterpunten', () => {
  it('enkel punten met gehele coördinaten in beeld', () => {
    const p = roosterpunten(bemonster(functieVanDoel(doel('kwadraat', 1, 1, 2, -1))));
    expect(p).toContainEqual({ x: 2, y: -1 });
    expect(p).toContainEqual({ x: 4, y: 3 });
    expect(p.every((q) => Number.isInteger(q.x) && Number.isInteger(q.y) && Math.abs(q.y) <= 6)).toBe(true);
    expect(p.find((q) => q.x === 6)).toBeUndefined(); // y = 15 valt buiten beeld
  });
});
