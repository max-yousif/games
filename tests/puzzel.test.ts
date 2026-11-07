import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS, vraagIndex } from '../src/live/codekraker';
import { puzzelBeoordelingen, puzzelStand, puzzelToestand, raster, stukVolgorde } from '../src/live/puzzel';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';
import type { Vraag } from '../src/lib/types';

const vraag = (id: string, antwoord: string): Vraag => ({ id, categorie: '', punten: 1, type: 'open', tekst: id, antwoord, opties: [], juisteOptie: 0, uitleg: '' });
const vragen = [vraag('a', '1'), vraag('b', '2'), vraag('c', '3')];
const juistVoor = (spelerId: string, nr: number) => vragen[vraagIndex(spelerId, nr, vragen.length)].antwoord;

let teller = 0;
function antwoord(spelerId: string, vraagNr: number, tekst: string, tijdMs = ++teller * 1000): LiveAntwoord {
  return { id: `${spelerId}-${vraagNr}`, spelerId, vraagNr, antwoord: tekst, tijdMs, juist: null, punten: 0, poging: 1, beloning: null } as LiveAntwoord;
}

/** Kijkt alles na en geeft de antwoorden met hun beoordeling terug. */
function nakijken(lijst: LiveAntwoord[], aantal: number): LiveAntwoord[] {
  const b = puzzelBeoordelingen(vragen, lijst, aantal);
  return lijst.map((a) => {
    const x = b.find((y) => y.id === a.id);
    return x ? { ...a, juist: x.juist, punten: x.punten, beloning: x.beloning ?? null } : a;
  });
}

describe('puzzel', () => {
  it('kiest een raster met zo vierkant mogelijke stukjes', () => {
    expect(raster(12, 4 / 3)).toEqual({ kolommen: 4, rijen: 3 });
    expect(raster(12, 3 / 4)).toEqual({ kolommen: 3, rijen: 4 });
    expect(raster(16, 1)).toEqual({ kolommen: 4, rijen: 4 });
    expect(raster(20, 16 / 9)).toEqual({ kolommen: 5, rijen: 4 });
  });

  it('elke leerling krijgt alle stukjes, in een eigen vaste volgorde', () => {
    const a = stukVolgorde('an', 12);
    expect([...a].sort((x, y) => x - y)).toEqual([...Array(12).keys()]);
    expect(stukVolgorde('an', 12)).toEqual(a);
    expect(stukVolgorde('bo', 12)).not.toEqual(a);
  });

  it('juist = het volgende stukje, fout = het juiste antwoord tonen', () => {
    const lijst = nakijken([antwoord('an', 0, juistVoor('an', 0)), antwoord('an', 1, 'fout'), antwoord('an', 2, juistVoor('an', 2))], 4);
    expect(lijst.map((a) => [a.juist, a.punten])).toEqual([
      [true, 1],
      [false, 0],
      [true, 1],
    ]);
    expect(JSON.parse(lijst[1].beloning!)).toEqual({ oplossing: juistVoor('an', 1) });
    expect(puzzelToestand(lijst, 'an').stukjes).toEqual(stukVolgorde('an', 4).slice(0, 2));
  });

  it('klaar enkel met alle stukjes én alles op de juiste plaats', () => {
    let lijst: LiveAntwoord[] = [];
    for (let nr = 0; nr < 3; nr++) lijst.push(antwoord('an', nr, juistVoor('an', nr)));
    // Te vroeg: nog geen 4 stukjes.
    lijst.push(antwoord('an', ACTIE_BASIS, JSON.stringify({ soort: 'klaar', ligging: [0, 1, 2, 3] })));
    lijst = nakijken(lijst, 4);
    expect(lijst.at(-1)!.juist).toBe(false);
    lijst.push(antwoord('an', 3, juistVoor('an', 3)));
    lijst.push(antwoord('an', ACTIE_BASIS + 1, JSON.stringify({ soort: 'klaar', ligging: [1, 0, 2, 3] })));
    lijst = nakijken(lijst, 4);
    expect(lijst.at(-1)!.juist).toBe(false);
    lijst.push(antwoord('an', ACTIE_BASIS + 2, JSON.stringify({ soort: 'klaar', ligging: [0, 1, 2, 3] })));
    lijst = nakijken(lijst, 4);
    expect(lijst.at(-1)!.juist).toBe(true);
    expect(puzzelToestand(lijst, 'an').klaarMs).toBe(lijst.at(-1)!.tijdMs);
    // Na alle stukjes levert een juist antwoord niets meer op.
    lijst.push(antwoord('an', 4, juistVoor('an', 4)));
    lijst = nakijken(lijst, 4);
    expect(JSON.parse(lijst.at(-1)!.beloning!)).toEqual({ stuk: null });
  });

  it('ranglijst: wie klaar is eerst (snelste eerst), dan de meeste stukjes', () => {
    const spelers = ['an', 'bo', 'cas'].map((id) => ({ id, naam: id, bijnaam: null, verbonden: true })) as LiveSpeler[];
    let lijst: LiveAntwoord[] = [];
    for (let nr = 0; nr < 2; nr++) lijst.push(antwoord('an', nr, juistVoor('an', nr)), antwoord('bo', nr, juistVoor('bo', nr)));
    lijst.push(antwoord('cas', 0, juistVoor('cas', 0)));
    lijst = nakijken(lijst, 2);
    lijst.push(antwoord('bo', ACTIE_BASIS, JSON.stringify({ soort: 'klaar', ligging: [0, 1] })));
    lijst = nakijken(lijst, 2);
    expect(puzzelStand(spelers, lijst).map((r) => [r.naam, r.punten, r.tijdMs !== null])).toEqual([
      ['bo', 2, true],
      ['an', 2, false],
      ['cas', 1, false],
    ]);
  });
});
