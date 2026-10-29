import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS, vraagIndex } from '../src/live/codekraker';
import {
  aantalWeg,
  alleKaarten,
  cluedoBeoordelingen,
  cluedoStand,
  cluedoToestand,
  lijstUitTekst,
  STANDAARD_THEMA,
  STRAF_MS,
  strafMsVan,
  themaProblemen,
  trekOplossing,
  type CluedoThema,
} from '../src/live/cluedo';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';
import type { Vraag } from '../src/lib/types';

const vragen = [
  { id: 'v1', type: 'open', tekst: '1+1', antwoord: '2', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
  { id: 'v2', type: 'open', tekst: '2+2', antwoord: '4', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
] as Vraag[];
const thema: CluedoThema = { titel: 'Test', verdachten: ['Ann', 'Bob', 'Cas'], locaties: ['Keuken', 'Tuin'], wapens: ['Mes', 'Touw'] };
const oplossing = { verdachte: 'Bob', locatie: 'Tuin', wapen: 'Mes' };
const spelers: LiveSpeler[] = ['A', 'B'].map((id) => ({ id, naam: id, bijnaam: null, verbonden: true }));
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
const juist = (spelerId: string, nr: number) => vragen[vraagIndex(spelerId, nr, 2)].antwoord as string;
const beschuldig = (verdachte: string, locatie: string, wapen: string) => JSON.stringify({ soort: 'beschuldig', verdachte, locatie, wapen });

function speel(alle: LiveAntwoord[], rand: (n: number) => number = () => 0) {
  const b = cluedoBeoordelingen(vragen, thema, oplossing, spelers, alle, rand);
  return alle.map((a) => {
    const x = b.find((y) => y.id === a.id);
    return x ? { ...a, juist: x.juist, beloning: x.beloning ?? null } : a;
  });
}

describe('cluedo', () => {
  it('standaardthema is in orde; problemen worden gemeld', () => {
    expect(themaProblemen(STANDAARD_THEMA)).toEqual([]);
    expect(aantalWeg(STANDAARD_THEMA)).toBe(18);
    expect(themaProblemen({ ...thema, wapens: ['Mes'] })).toHaveLength(1);
    expect(themaProblemen({ ...thema, verdachten: ['Ann', 'ann'] })).toHaveLength(1);
    expect(lijstUitTekst(' Ann \n\nBob\n')).toEqual(['Ann', 'Bob']);
    const o = trekOplossing(thema, (n) => n - 1);
    expect(o).toEqual({ verdachte: 'Cas', locatie: 'Tuin', wapen: 'Touw' });
  });

  it('elk juist antwoord streept een kaart weg, nooit de oplossing', () => {
    let alle: LiveAntwoord[] = [];
    // 4 kaarten kunnen weg (7 - 3); daarna levert een juist antwoord niets meer op.
    for (let nr = 0; nr < 6; nr++) {
      alle.push(ant('A', nr, nr === 1 ? 'fout' : juist('A', nr), nr * 10));
      alle = speel(alle, (n) => n - 1);
    }
    const p = cluedoToestand(spelers, alle).spelers.get('A')!;
    expect(p.juist).toBe(5);
    expect(p.fout).toBe(1);
    expect(p.weg).toHaveLength(4);
    const over = alleKaarten(thema).filter((k) => !p.weg.some((w) => w.soort === k.soort && w.naam === k.naam));
    expect(over.map((k) => k.naam).sort()).toEqual(['Bob', 'Mes', 'Tuin']);
  });

  it('de straftijd is instelbaar', () => {
    const alle = [ant('B', ACTIE_BASIS, beschuldig('Ann', 'Tuin', 'Mes'), 5), ant('B', ACTIE_BASIS + 1, beschuldig('Bob', 'Tuin', 'Mes'), 30_010)];
    const b = cluedoBeoordelingen(vragen, thema, oplossing, spelers, alle, () => 0, 30_000);
    expect(b.map((x) => x.juist)).toEqual([false, true]);
    expect(strafMsVan(120)).toBe(120_000);
    expect(strafMsVan(0)).toBe(STRAF_MS);
  });

  it('beschuldigen: fout geeft straf, juist = opgelost; ranglijst', () => {
    let alle = [ant('A', 0, juist('A', 0), 1), ant('B', ACTIE_BASIS, beschuldig('Ann', 'Tuin', 'Mes'), 5)];
    alle = speel(alle);
    let t = cluedoToestand(spelers, alle);
    expect(t.spelers.get('B')!.strafVanaf).toBe(5);
    expect(t.gebeurtenissen.at(-1)!.tekst).toMatch(/B beschuldigde/);
    // Te snel opnieuw beschuldigen telt niet.
    alle.push(ant('B', ACTIE_BASIS + 1, beschuldig('Bob', 'Tuin', 'Mes'), 1000));
    alle = speel(alle);
    expect(cluedoToestand(spelers, alle).spelers.get('B')!.opgelostMs).toBeNull();
    alle.push(ant('B', ACTIE_BASIS + 2, beschuldig('Bob', 'Tuin', 'Mes'), 5 + STRAF_MS));
    alle.push(ant('A', ACTIE_BASIS, beschuldig('Bob', 'Tuin', 'Mes'), 9 + STRAF_MS));
    alle = speel(alle);
    t = cluedoToestand(spelers, alle);
    expect(t.spelers.get('B')!.opgelostMs).toBe(5 + STRAF_MS);
    expect(t.spelers.get('A')!.opgelostMs).toBe(9 + STRAF_MS);
    expect(cluedoStand(t).map((r) => r.naam)).toEqual(['B', 'A']);
    expect(t.gebeurtenissen.filter((g) => g.soort === 'opgelost')).toHaveLength(2);
  });

  it('wie nog niet opgelost heeft, staat gerangschikt op weggestreepte kaarten', () => {
    let alle = [ant('A', 0, juist('A', 0), 1), ant('A', 1, juist('A', 1), 2), ant('B', 0, juist('B', 0), 3)];
    alle = speel(alle);
    expect(cluedoStand(cluedoToestand(spelers, alle)).map((r) => [r.naam, r.punten])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });
});
