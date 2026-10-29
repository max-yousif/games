import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS } from '../src/live/codekraker';
import { cijferVoor, escapeActieBeoordelingen, escapeAlsAntwoorden, escapeStaat, escapeStaatStand, slotVraag, STRAF } from '../src/live/escape';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';
import type { Vraag } from '../src/lib/types';
import { vraag } from './helpers';

const vragen: Vraag[] = [
  { ...vraag('a', 'X', 100), type: 'meerkeuze', opties: ['1', '2', '3', '4'], juisteOptie: 2 },
  { ...vraag('b', 'X', 100), type: 'meerkeuze', opties: ['x', 'y', 'z'], juisteOptie: 0 },
  { ...vraag('c', 'X', 100), type: 'waaronwaar', opties: [], juisteOptie: 1 },
];
const CODE = '507';
const spelers: LiveSpeler[] = [{ id: 'p', naam: 'Anna', bijnaam: null, verbonden: true }];
let n = 0;
const actie = (tijdMs: number, a: object): LiveAntwoord => ({ id: `a${n}`, spelerId: 'p', vraagNr: ACTIE_BASIS + n++, antwoord: JSON.stringify(a), tijdMs, juist: null, punten: 0, poging: 1, beloning: null });
const vraagAchter = (slot: number) => vragen[slotVraag('p', slot, vragen)];
function speel(alle: LiveAntwoord[]) {
  const b = escapeActieBeoordelingen(vragen, CODE, 60, alle);
  return alle.map((a) => {
    const x = b.find((y) => y.id === a.id);
    return x ? { ...a, juist: x.juist, beloning: x.beloning ?? null } : a;
  });
}

describe('escape room v2', () => {
  it('elk antwoord geeft een cijfer; enkel het juiste geeft het cijfer van de code', () => {
    for (let slot = 0; slot < 3; slot++) {
      const v = vraagAchter(slot);
      const aantal = v.type === 'waaronwaar' ? 2 : v.opties.length;
      const cijfers = Array.from({ length: aantal }, (_, k) => cijferVoor(CODE, 'p', slot, v, k));
      expect(cijfers[v.juisteOptie]).toBe(CODE[slot]);
      expect(new Set(cijfers).size).toBe(aantal);
      cijfers.forEach((c) => expect(c).toMatch(/^\d$/));
    }
  });

  it('een fout antwoord valt niet op: het wordt aanvaard met een ander cijfer', () => {
    const v = vraagAchter(0);
    const fout = (v.juisteOptie + 1) % v.opties.length;
    const alle = speel([actie(1000, { soort: 'slot', slot: 0, keuze: fout })]);
    expect(alle[0].juist).toBe(true);
    expect(alle[0].beloning).not.toBe(CODE[0]);
    const st = escapeStaat(vragen, spelers, alle, 60)[0];
    expect(st.cijfers.get(0)).toBe(alle[0].beloning);
    expect(st.juist).toBe(0);
    // De stand voor de server verraadt niets: enkel het aantal ingevulde sloten.
    expect(escapeStaatStand([st])[0]).toMatchObject({ punten: 1, juist: 1 });
  });

  it('foute code: straftijd waarin niets aanvaard wordt; daarna verbeteren en ontsnappen', () => {
    const juist = (slot: number) => vraagAchter(slot).juisteOptie;
    const fout0 = (juist(0) + 1) % 4;
    let alle = speel([
      actie(1000, { soort: 'slot', slot: 0, keuze: fout0 }),
      actie(2000, { soort: 'slot', slot: 1, keuze: juist(1) }),
      actie(3000, { soort: 'slot', slot: 2, keuze: juist(2) }),
    ]);
    let st = escapeStaat(vragen, spelers, alle, 60)[0];
    const gok = [0, 1, 2].map((s) => st.cijfers.get(s)).join('');
    alle = speel([...alle, actie(4000, { soort: 'code', code: gok })]);
    expect(alle.at(-1)!.juist).toBe(false);
    st = escapeStaat(vragen, spelers, alle, 60)[0];
    expect(st.fout).toBe(1);
    expect(st.strafTot).toBe(64000);
    // Tijdens de straftijd: geen nieuwe keuze en geen nieuwe code.
    alle = speel([...alle, actie(10000, { soort: 'slot', slot: 0, keuze: juist(0) }), actie(11000, { soort: 'code', code: CODE })]);
    expect(alle.slice(-2).map((a) => [a.juist, a.beloning])).toEqual([
      [false, STRAF],
      [false, STRAF],
    ]);
    st = escapeStaat(vragen, spelers, alle, 60)[0];
    expect(st.ontsnaptMs).toBeNull();
    expect(st.cijfers.get(0)).toBe(gok[0]);
    // Na de straftijd.
    alle = speel([...alle, actie(65000, { soort: 'slot', slot: 0, keuze: juist(0) }), actie(66000, { soort: 'code', code: CODE })]);
    st = escapeStaat(vragen, spelers, alle, 60)[0];
    expect(st.cijfers.get(0)).toBe(CODE[0]);
    expect(st.ontsnaptMs).toBe(66000);
    expect(st.juist).toBe(3);
    // Resultaten: per vraag juist of fout (laatste keuze).
    const r = escapeAlsAntwoorden(vragen, [st]);
    expect(r.map((a) => a.juist)).toEqual([true, true, true]);
    expect(r.map((a) => a.vraagNr).sort()).toEqual([0, 1, 2]);
  });
});
