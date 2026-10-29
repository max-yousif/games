import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS, vraagIndex } from '../src/live/codekraker';
import {
  BREEDTE,
  codeerLijnen,
  codeerVeld,
  HOOGTE,
  MAX_SNELHEID,
  kenKleurenToe,
  leesLijnen,
  leesVeld,
  penseel,
  schilder,
  territoriumBeoordelingen,
  territoriumStand,
  territoriumToestand,
} from '../src/live/territorium';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';
import type { Vraag } from '../src/lib/types';

const vragen = [
  { id: 'v1', type: 'open', tekst: '1+1', antwoord: '2', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
  { id: 'v2', type: 'open', tekst: '2+2', antwoord: '4', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
] as Vraag[];
const spelers: LiveSpeler[] = ['A', 'B'].map((id) => ({ id, naam: id, bijnaam: null, verbonden: true }));
const kleuren = { A: 0, B: 1 };
let teller = 0;
const ant = (spelerId: string, vraagNr: number, antwoord: string, tijdMs: number): LiveAntwoord => ({
  id: `a${teller++}`,
  spelerId,
  vraagNr,
  antwoord,
  tijdMs,
  juist: null,
  punten: 0,
  poging: 1,
  beloning: null,
});
const juist = (id: string, nr: number) => vragen[vraagIndex(id, nr, 2)].antwoord as string;
const teken = (vraag: number, lijnen: [number, number][][]) => JSON.stringify({ soort: 'teken', vraag, lijnen: codeerLijnen(lijnen) });
function speel(alle: LiveAntwoord[]) {
  const b = territoriumBeoordelingen(vragen, spelers, alle, kleuren);
  return alle.map((a) => {
    const x = b.find((y) => y.id === a.id);
    return x ? { ...a, juist: x.juist, beloning: x.beloning ?? null } : a;
  });
}

describe('territorium', () => {
  it('lijnen en veld coderen en terug lezen', () => {
    const lijnen: [number, number][][] = [
      [
        [0, 0],
        [10.5, 3],
        [79.5, 49.5],
      ],
      [[4, 4]],
    ];
    expect(leesLijnen(codeerLijnen(lijnen))).toEqual(lijnen);
    const veld = new Uint8Array(BREEDTE * HOOGTE);
    veld.fill(3, 100, 400);
    veld.fill(12, 2000, 2001);
    const tekst = codeerVeld(veld);
    expect(tekst.length).toBeLessThan(60);
    expect(leesVeld(tekst)).toEqual(veld);
  });

  it('penseel groeit met de reeks, tot een maximum', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(penseel)).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 3.5]);
  });

  it('schilderen: een groter penseel kleurt meer, de inkt is beperkt', () => {
    const lijn: [number, number][][] = [
      [
        [5, 25],
        [30, 25],
      ],
    ];
    const klein = schilder(new Uint8Array(BREEDTE * HOOGTE), lijn, 1, 1);
    const groot = schilder(new Uint8Array(BREEDTE * HOOGTE), lijn, 3, 1);
    expect(groot).toBeGreaterThan(klein * 2);
    // Een onmogelijk snelle lijn wordt afgekapt (hier na 1 seconde tekenen).
    const veld = new Uint8Array(BREEDTE * HOOGTE);
    schilder(veld, [[[0, 10], [79, 10], [79, 40], [0, 40]]], 0.5, 1, MAX_SNELHEID);
    const verste = Math.max(...[...veld].map((v, i) => (v ? (i % BREEDTE) + Math.floor(i / BREEDTE) : 0)));
    expect(verste).toBeLessThanOrEqual(10 + MAX_SNELHEID + 1);
    // Zonder grens: de hele lijn.
    const vrij = new Uint8Array(BREEDTE * HOOGTE);
    schilder(vrij, [[[0, 10], [79, 10], [79, 40], [0, 40]]], 0.5, 1);
    expect(vrij[40 * BREEDTE + 1]).toBe(1);
  });

  it('juist antwoord = tekenbeurt; tekenen kleurt het veld; overschilderen mag', () => {
    let alle = [ant('A', 0, juist('A', 0), 1), ant('B', 0, 'fout', 2), ant('B', 1, juist('B', 1), 3)];
    alle = speel(alle);
    let t = territoriumToestand(spelers, alle, kleuren);
    expect(t.spelers.get('A')!.beurten).toEqual([{ vraag: 0, penseel: 1 }]);
    expect(t.spelers.get('B')!.reeks).toBe(1);
    // Zonder beurt tekenen telt niet.
    alle.push(ant('A', ACTIE_BASIS, teken(5, [[[10, 10]]]), 4));
    alle.push(ant('A', ACTIE_BASIS + 1, teken(0, [[[10, 10], [20, 10]]]), 5));
    alle.push(ant('B', ACTIE_BASIS, teken(1, [[[15, 10], [15, 20]]]), 6));
    alle = speel(alle);
    expect(alle.map((a) => a.juist)).toEqual([true, false, true, false, true, true]);
    t = territoriumToestand(spelers, alle, kleuren);
    // B schilderde over een deel van A.
    expect(t.veld[10 * BREEDTE + 15]).toBe(2);
    expect(t.veld[10 * BREEDTE + 11]).toBe(1);
    const stand = territoriumStand(t);
    expect(stand.map((r) => r.naam).sort()).toEqual(['A', 'B']);
    expect(stand.find((r) => r.naam === 'A')!.punten).toBe(t.spelers.get('A')!.vakjes);
    expect(t.spelers.get('A')!.vakjes + t.spelers.get('B')!.vakjes).toBe([...t.veld].filter(Boolean).length);
    // De beurt is opgebruikt.
    expect(t.spelers.get('A')!.beurten).toEqual([]);
  });

  it('een reeks juiste antwoorden geeft een groter penseel; een fout zet terug', () => {
    let alle: LiveAntwoord[] = [];
    for (let nr = 0; nr < 4; nr++) alle.push(ant('A', nr, juist('A', nr), nr));
    alle.push(ant('A', 4, 'fout', 10), ant('A', 5, juist('A', 5), 11));
    alle = speel(alle);
    const t = territoriumToestand(spelers, alle, kleuren);
    expect(t.spelers.get('A')!.beurten.map((b) => b.penseel)).toEqual([1, 1.5, 2, 2.5, 1]);
    expect(t.spelers.get('A')!.besteReeks).toBe(4);
  });

  it('kleuren: nieuwe spelers krijgen een vrije kleur, bestaande blijven', () => {
    const k1 = kenKleurenToe(spelers, {});
    expect(new Set(Object.values(k1)).size).toBe(2);
    const k2 = kenKleurenToe([...spelers, { id: 'C', naam: 'Aa', bijnaam: null, verbonden: true }], k1);
    expect(k2.A).toBe(k1.A);
    expect(k2.B).toBe(k1.B);
    expect(new Set(Object.values(k2)).size).toBe(3);
  });
});
