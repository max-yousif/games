import { describe, expect, it } from 'vitest';
import { statistieken } from '../src/lib/statistiek';
import type { Beurt, Sessie } from '../src/lib/types';
import { sessie, vraag } from './helpers';

/** Een spel met beurten: [leerlingId, vraagId, juist]. */
function spel(datum: string, beurten: [string, string, boolean][]): Sessie {
  const s = sessie([vraag('v1', 'Machten'), vraag('v2', 'Wortels'), vraag('v3', 'Machten')]);
  s.gestart = datum;
  s.beurten = beurten.map(([l, v, juist]): Beurt => ({ vraagId: v, team: l === 'c' ? 1 : 0, leerlingId: l, juist, punten: juist ? 100 : 0, tijd: datum }));
  return s;
}

describe('statistieken', () => {
  const vroeg = spel('2026-10-01T09:00:00Z', [
    ['a', 'v1', false], ['a', 'v2', false], ['a', 'v3', false], ['a', 'v1', true],
    ['b', 'v1', true], ['b', 'v2', true], ['b', 'v3', true], ['b', 'v2', true],
  ]);
  const laat = spel('2026-10-20T09:00:00Z', [
    ['a', 'v1', true], ['a', 'v2', true], ['a', 'v3', true], ['a', 'v1', true],
    ['b', 'v1', true], ['b', 'v2', false], ['b', 'v3', true], ['b', 'v2', false],
  ]);
  const st = statistieken([laat, vroeg]);

  it('per spel in tijdsvolgorde, per onderwerp moeilijkste eerst', () => {
    expect(st.perSpel.map((p) => p.procent)).toEqual([63, 75]);
    expect(st.perOnderwerp.map((o) => o.onderwerp)).toEqual(['Wortels', 'Machten']);
    expect(st.perOnderwerp[0]).toMatchObject({ procent: 50, beurten: 6 });
    expect(st.moeilijkst[0].tekst).toBe('Vraag v2');
  });

  it('leerlingen: sterkst, vooruitgang, deelname', () => {
    expect(st.sterkst.map((l) => [l.naam, l.procent])).toEqual([
      ['Bert', 75],
      ['Anna', 63],
    ]);
    expect(st.aandacht).toEqual([]);
    // Anna: eerst 1 op 4 juist, daarna 4 op 4.
    expect(st.vooruitgang).toEqual([{ naam: 'Anna', klas: '3A', voor: 25, na: 100 }]);
    // Iedereen was telkens aanwezig.
    expect(st.deelname).toEqual([]);
    // Bert was er bij een derde spel niet bij.
    const zonderBert = spel('2026-10-25T09:00:00Z', [['a', 'v1', true]]);
    zonderBert.teams = zonderBert.teams.map((t) => ({ ...t, leerlingen: t.leerlingen.filter((l) => l.id !== 'b') }));
    expect(statistieken([vroeg, laat, zonderBert]).deelname).toEqual([{ naam: 'Bert', klas: '3A', spellen: 2, van: 3 }]);
  });
});
