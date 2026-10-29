import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS, vraagIndex } from '../src/live/codekraker';
import {
  BREEDTE,
  codeerLijnen,
  codeerVeld,
  HOOGTE,
  MAX_TEKENS,
  aantalVakjes,
  gekleurd,
  kenKleurenToe,
  KLEURPLATEN,
  leesLijnen,
  maskerVan,
  maxLengte,
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
    // Punten worden middens van vakjes; een grote sprong wordt in stapjes opgedeeld.
    const lijnen: [number, number][][] = [
      [
        [0.5, 0.5],
        [3.5, 2.5],
        [3.5, 2.5],
        [9.5, 2.5],
      ],
      [[4.2, 4.9]],
    ];
    const terug = leesLijnen(codeerLijnen(lijnen));
    expect(terug[0][0]).toEqual([0.5, 0.5]);
    expect(terug[0].at(-1)).toEqual([9.5, 2.5]);
    expect(terug[0]).toContainEqual([3.5, 2.5]);
    expect(terug[1]).toEqual([[4.5, 4.5]]);
    // Opnieuw coderen geeft hetzelfde: wat de laptop toont, is wat het bord bewaart.
    expect(codeerLijnen(terug)).toBe(codeerLijnen(lijnen));
    // Een snelle, lange krabbel (heen en weer over het hele veld) past ruim in het antwoord.
    const krabbel: [number, number][] = [];
    for (let i = 0; i < 12; i++) for (let x = 0; x < 80; x++) krabbel.push([i % 2 ? 79 - x : x, 4 * i]);
    expect(codeerLijnen([krabbel]).length).toBeLessThan(MAX_TEKENS);
    // Tekeningen van vroeger blijven leesbaar.
    expect(leesLijnen('0a0k')).toEqual([[[5, 10]]]);
    const veld = new Uint8Array(BREEDTE * HOOGTE);
    veld.fill(3, 100, 400);
    veld.fill(12, 2000, 2001);
    const tekst = codeerVeld(veld);
    expect(tekst.length).toBeLessThan(60);
    expect(leesVeld(tekst)).toEqual(veld);
  });

  it('penseel groeit met de reeks, tot een maximum', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(penseel)).toEqual([0.5, 0.75, 1, 1.5, 2, 2.5, 2.5]);
  });

  it('schilderen: een groter penseel kleurt meer', () => {
    const lijn: [number, number][][] = [
      [
        [5.5, 25.5],
        [30.5, 25.5],
      ],
    ];
    const klein = schilder(new Uint8Array(BREEDTE * HOOGTE), lijn, 1, 1);
    const groot = schilder(new Uint8Array(BREEDTE * HOOGTE), lijn, 3, 1);
    expect(groot).toBeGreaterThan(klein * 2);
    // Het kleinste penseel: een lijn van 1 vakje breed.
    const smal = schilder(new Uint8Array(BREEDTE * HOOGTE), lijn, 0.5, 1);
    expect(smal).toBe(26);
    // De hele lijn telt, ook een lange.
    const vrij = new Uint8Array(BREEDTE * HOOGTE);
    schilder(vrij, [[[0, 10], [79, 10], [79, 40], [0, 40]]], 0.5, 1);
    expect(vrij[40 * BREEDTE + 1]).toBe(1);
  });

  it('juist antwoord = tekenbeurt; tekenen kleurt het veld; overschilderen mag', () => {
    let alle = [ant('A', 0, juist('A', 0), 1), ant('B', 0, 'fout', 2), ant('B', 1, juist('B', 1), 3)];
    alle = speel(alle);
    let t = territoriumToestand(spelers, alle, kleuren);
    expect(t.spelers.get('A')!.beurten).toEqual([{ vraag: 0, penseel: 0.5 }]);
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
    expect(t.spelers.get('A')!.beurten.map((b) => b.penseel)).toEqual([0.5, 0.75, 1, 1.5, 0.5]);
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

  it('een beurt kleurt hoogstens een lijn zo lang als het penseel in die tijd kan gaan', () => {
    // Heen en weer over het hele veld: veel te lang voor 3 seconden.
    const krabbel: [number, number][] = [];
    for (let i = 0; i < 10; i++) for (let x = 0; x < 80; x++) krabbel.push([(i % 2 ? 79 - x : x) + 0.5, 5 * i + 0.5]);
    let alle = [ant('A', 0, juist('A', 0), 1), ant('A', ACTIE_BASIS, teken(0, [krabbel]), 2)];
    alle = speel(alle);
    const vrij = territoriumToestand(spelers, alle, kleuren);
    const beperkt = territoriumToestand(spelers, alle, kleuren, { seconden: 3 });
    expect(gekleurd(vrij.veld)).toBeGreaterThan(700);
    expect(gekleurd(beperkt.veld)).toBeLessThanOrEqual(maxLengte(3) + 2);
    expect(gekleurd(beperkt.veld)).toBeGreaterThan(50);
  });

  it('samen inkleuren: enkel lege vakjes in de tekening', () => {
    for (const k of KLEURPLATEN) {
      const m = maskerVan(k.id)!;
      expect(aantalVakjes(m), k.id).toBeGreaterThan(600);
      expect(aantalVakjes(m), k.id).toBeLessThan(BREEDTE * HOOGTE * 0.5);
    }
    expect(maskerVan(undefined)).toBeNull();
    expect(aantalVakjes(null)).toBe(BREEDTE * HOOGTE);
    const masker = maskerVan('hart')!;
    // A kleurt een lijn dwars over het hart, B daarna over dezelfde lijn: B kan A niet overschilderen.
    const lijn: [number, number][][] = [[[0.5, 20.5], [79.5, 20.5]]];
    let alle = [ant('A', 0, juist('A', 0), 1), ant('B', 0, juist('B', 0), 2), ant('A', ACTIE_BASIS, teken(0, lijn), 3), ant('B', ACTIE_BASIS, teken(0, lijn), 4)];
    alle = speel(alle);
    const t = territoriumToestand(spelers, alle, kleuren, { masker });
    const rij = Array.from({ length: BREEDTE }, (_, x) => t.veld[20 * BREEDTE + x]);
    expect(rij.filter((v, x) => v && !masker[20 * BREEDTE + x])).toEqual([]);
    expect(t.spelers.get('A')!.vakjes).toBeGreaterThan(30);
    expect(t.spelers.get('B')!.vakjes).toBe(0);
  });
});
