import { describe, expect, it } from 'vitest';
import { kiezer, meerderheid, uitslagTekst, verdeelSpelers } from '../src/live/teambord';
import type { Team } from '../src/lib/types';
import type { LiveSpeler } from '../src/live/types';

const speler = (id: string, naam: string): LiveSpeler => ({ id, naam, bijnaam: null, verbonden: true });
const teams: Team[] = [
  { naam: 'Team Blauw', kleur: '#00f', leerlingen: [{ id: 'l1', naam: 'Peeters Anna' }, { id: 'l2', naam: 'Claes Bert' }] },
  { naam: 'Team Rood', kleur: '#f00', leerlingen: [{ id: 'l3', naam: 'Wouters Cas' }] },
];

describe('teambord', () => {
  it('meerderheid: beslist zodra het vaststaat', () => {
    expect(meerderheid(3, 0, 5)).toBe(true);
    expect(meerderheid(2, 0, 5)).toBe(null);
    expect(meerderheid(2, 3, 5)).toBe(false);
    expect(meerderheid(2, 2, 4)).toBe(false); // de helft is geen meerderheid
    expect(meerderheid(1, 0, 4)).toBe(null);
    expect(meerderheid(1, 0, 4, true)).toBe(false);
    expect(meerderheid(1, 0, 1)).toBe(true);
    expect(meerderheid(0, 0, 0, true)).toBe(false);
  });

  it('verdeelt spelers volgens de klaslijst, onbekenden naar het kleinste team', () => {
    const namen = { Anna: ['l1'], Bert: ['l2'], Cas: ['l3'] };
    const t = verdeelSpelers([speler('s1', 'Anna'), speler('s3', 'Cas'), speler('s9', 'Zoë')], teams, namen, {});
    expect(t).toEqual({ s1: 0, s3: 1, s9: 0 });
    // Wie al een team heeft, houdt het.
    expect(verdeelSpelers([speler('s1', 'Anna'), speler('s2', 'Bert')], teams, namen, { s1: 1 })).toEqual({ s1: 1, s2: 0 });
  });

  it('kiest om beurt wie het minst koos', () => {
    expect(kiezer(['a', 'b', 'c'], {})).toBe('a');
    expect(kiezer(['a', 'b', 'c'], { a: 1 })).toBe('b');
    expect(kiezer(['a', 'b'], { a: 1, b: 1 })).toBe('a');
    expect(kiezer([], {})).toBe(null);
  });

  it('uitslagtekst', () => {
    expect(uitslagTekst('Team Blauw', true, 4, 6)).toBe('Team Blauw: 4 van 6 juist ✓');
  });
});
