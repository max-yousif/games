import { describe, expect, it } from 'vitest';
import { automatischJuist, automatischeBeoordelingen, berekenStand, groepeerAntwoorden, normaliseer, plaatsVan, publiekeVraag, puntenVoor, synchroniseer } from '../src/live/logic';
import { isGeldigeReactie, type LiveAntwoord } from '../src/live/types';
import type { Vraag } from '../src/lib/types';
import { sessie, vraag } from './helpers';

const mk: Vraag = { ...vraag('m', 'Machten', 200), type: 'meerkeuze', opties: ['-9', '1/9', '9'], juisteOptie: 1, antwoord: '' };
const open: Vraag = { ...vraag('o', 'Vergelijkingen', 100), antwoord: '$x=7$' };
const ant = (id: string, spelerId: string, vraagNr: number, antwoord: string, extra: Partial<LiveAntwoord> = {}): LiveAntwoord => ({
  id,
  spelerId,
  vraagNr,
  antwoord,
  tijdMs: 1000,
  juist: null,
  punten: 0,
  poging: 1,
  beloning: null,
  ...extra,
});

describe('live: publieke vraag', () => {
  it('bevat geen antwoord', () => {
    const p = publiekeVraag(mk);
    expect(JSON.stringify(p)).not.toContain('juisteOptie');
    expect(p.opties).toEqual(['-9', '1/9', '9']);
    expect(JSON.stringify(publiekeVraag(open))).not.toContain('x=7');
  });
});

describe('live: beoordelen', () => {
  it('normaliseert schrijfwijzen', () => {
    expect(normaliseer('$x = 7$')).toBe('x=7');
    expect(normaliseer('0,15')).toBe(normaliseer('$0{,}15$'));
    expect(normaliseer('$\\dfrac{1}{9}$')).toBe(normaliseer('\\frac{1}{9}'));
  });

  it('herkent juiste open antwoorden, ook zonder "x ="', () => {
    expect(automatischJuist(open, 'x=7')).toBe(true);
    expect(automatischJuist(open, ' 7 ')).toBe(true);
    expect(automatischJuist(open, '8')).toBe(false);
    expect(automatischJuist(mk, '1')).toBe(true);
    expect(automatischJuist(mk, '0')).toBe(false);
  });

  it('geeft punten met snelheidsbonus van 100 % tot 50 %', () => {
    expect(puntenVoor(mk, true, 0, 20, true)).toBe(200);
    expect(puntenVoor(mk, true, 10000, 20, true)).toBe(150);
    expect(puntenVoor(mk, true, 30000, 20, true)).toBe(100);
    expect(puntenVoor(mk, true, 10000, 20, false)).toBe(200);
    expect(puntenVoor(mk, true, 10000, null, true)).toBe(200);
    expect(puntenVoor(mk, false, 0, 20, true)).toBe(0);
  });

  it('beoordeelt enkel nog niet beoordeelde antwoorden op de huidige vraag', () => {
    const b = automatischeBeoordelingen(mk, [ant('1', 'a', 0, '1'), ant('2', 'b', 0, '2'), ant('3', 'c', 1, '1'), ant('4', 'd', 0, '1', { juist: false })], 0, null, false);
    expect(b).toEqual([
      { id: '1', juist: true, punten: 200 },
      { id: '2', juist: false, punten: 0 },
    ]);
  });
});

describe('live: stand en groepen', () => {
  const spelers = [
    { id: 'a', naam: 'Anna', bijnaam: null, verbonden: true },
    { id: 'b', naam: 'Bert', bijnaam: null, verbonden: true },
    { id: 'c', naam: 'Chloé', bijnaam: null, verbonden: true },
  ];
  const antwoorden = [ant('1', 'a', 0, '1', { juist: true, punten: 200 }), ant('2', 'b', 0, '1', { juist: true, punten: 200 }), ant('3', 'c', 0, '0', { juist: false })];

  it('sorteert op punten en deelt plaatsen bij gelijkstand', () => {
    const stand = berekenStand(spelers, antwoorden);
    expect(stand.map((r) => r.naam)).toEqual(['Anna', 'Bert', 'Chloé']);
    expect(plaatsVan(stand, 'b')).toBe(1);
    expect(plaatsVan(stand, 'c')).toBe(3);
    expect(plaatsVan(stand, 'niemand')).toBeNull();
    // Met bijnaam: op het scherm de bijnaam.
    expect(berekenStand([{ ...spelers[0], bijnaam: 'Pi' }], antwoorden)[0]).toMatchObject({ id: 'a', naam: 'Pi', punten: 200 });
  });

  it('groepeert gelijke open antwoorden', () => {
    const g = groepeerAntwoorden([ant('1', 'a', 0, 'x = 7'), ant('2', 'b', 0, '$x=7$'), ant('3', 'c', 0, '8')]);
    expect(g.map((x) => x.antwoorden.length)).toEqual([2, 1]);
    expect(g[0].tekst).toBe('x = 7');
  });

  it('zet antwoorden om naar beurten per leerling, ook voor namen buiten de klaslijst', () => {
    const s = { ...sessie([mk, open], 'live'), teams: [{ naam: '3A', kleur: '#000', leerlingen: [{ id: 'l1', naam: 'Anna' }] }] };
    const uit = synchroniseer(s, spelers, antwoorden, ['m', 'o']);
    expect(uit.teams[0].leerlingen.map((l) => l.naam)).toEqual(['Anna', 'Bert', 'Chloé']);
    expect(uit.beurten).toHaveLength(3);
    expect(uit.beurten[0]).toMatchObject({ vraagId: 'm', leerlingId: 'l1', juist: true, punten: 200 });
    // Niet beoordeelde antwoorden tellen (nog) niet mee.
    expect(synchroniseer(s, spelers, [ant('9', 'a', 1, 'x')], ['m', 'o']).beurten).toHaveLength(0);
  });
});

describe('live: wiskunde-editor en schrijfwijzen', () => {
  it('herkent LaTeX uit de editor als hetzelfde antwoord', () => {
    const gelijk = (a: string, b: string) => expect(normaliseer(a)).toBe(normaliseer(b));
    gelijk('$\\frac{1}{2}$', '1/2');
    gelijk('$4a^{2}-20a+25$', '$4a^2-20a+25$');
    gelijk('x²+6x+9', '$x^2+6x+9$');
    gelijk('$2\\cdot x$', '2x');
    gelijk('$3\\times 4$', '3*4');
    gelijk('$\\sqrt{9}$', '√9');
    gelijk('$\\frac{x+1}{2}$', '(x+1)/2');
    gelijk('$\\left(x+3\\right)^{2}$', '(x+3)^2');
    expect(normaliseer('$\\frac{1}{2}$')).not.toBe(normaliseer('1/3'));
  });

  it('kijkt antwoorden uit de editor na', () => {
    const q: Vraag = { ...vraag('o'), antwoord: '$\\frac{3}{4}$' };
    expect(automatischJuist(q, '$\\frac{3}{4}$')).toBe(true);
    expect(automatischJuist(q, '3/4')).toBe(true);
    expect(automatischJuist(q, '0,75')).toBe(true);
    const g: Vraag = { ...vraag('g'), type: 'getal', antwoord: '-0,25' };
    expect(automatischJuist(g, '$-\\frac{1}{4}$')).toBe(true);
  });

  it('aanvaardt enkel de afgesproken emoji als reactie', () => {
    expect(isGeldigeReactie({ emoji: '🐐', naam: 'Pi' })).toBe(true);
    expect(isGeldigeReactie({ emoji: '🍕', naam: 'Pi' })).toBe(false);
    expect(isGeldigeReactie({ emoji: '😂' })).toBe(false);
  });
});
