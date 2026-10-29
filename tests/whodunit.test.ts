import { describe, expect, it } from 'vitest';
import { VOORBEELDSETS } from '../src/content/voorbeelden';
import { EINDCODE, slotVraag } from '../src/live/escape';
import { automatischJuist } from '../src/live/logic';
import type { LiveAntwoord } from '../src/live/types';
import { hintsUitBeloning, hintsVoorOefening, publiekRaadsel, raadselProblemen, rasterJuist, rasterNaarTekst, whodunitBeoordelingen } from '../src/live/whodunit';

const set = VOORBEELDSETS.find((s) => s.raadsel)!;
const raadsel = set.raadsel!;
const oplossing = raadsel.categorieen.map((c) => c.oplossing);

const antwoord = (vraagNr: number, tekst: string, id = `a${vraagNr}`): LiveAntwoord => ({
  id,
  spelerId: 'p1',
  vraagNr,
  antwoord: tekst,
  tijdMs: 1000,
  juist: null,
  punten: 0,
  poging: 1,
  beloning: null,
});

describe('whodunit', () => {
  it('verdeelt hints eerlijk over de oefeningen', () => {
    expect(Array.from({ length: 12 }, (_, i) => hintsVoorOefening(i, 12, 12))).toEqual(Array.from({ length: 12 }, (_, i) => [i]));
    expect(Array.from({ length: 4 }, (_, i) => hintsVoorOefening(i, 4, 6)).flat()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Array.from({ length: 6 }, (_, i) => hintsVoorOefening(i, 6, 3)).flat()).toEqual([0, 1, 2]);
  });

  it('toont leerlingen geen oplossing en sorteert de keuzes', () => {
    const p = publiekRaadsel(raadsel);
    expect(JSON.stringify(p)).not.toContain(raadsel.hints[0]);
    expect(p.categorieen[0].opties).toEqual(['Fien', 'Lars', 'Mats', 'Noor']);
    expect(p.aantalHints).toBe(12);
  });

  it('kijkt oefeningen en de tabel na', () => {
    // Achter welke oefening (slot) staat bij deze leerling de eerste en de tweede vraag van de set?
    const slot = (i: number) => set.vragen.findIndex((_, nr) => slotVraag('p1', nr, set.vragen) === i);
    const items = whodunitBeoordelingen(set.vragen, raadsel, [antwoord(slot(0), 'y = π/2'), antwoord(slot(1), '131'), antwoord(EINDCODE, rasterNaarTekst(oplossing))]);
    expect(items[0]).toMatchObject({ juist: true, punten: 100 });
    expect(hintsUitBeloning(items[0].beloning!)).toEqual(hintsVoorOefening(slot(0), set.vragen.length, raadsel.hints.length).map((i) => ({ nr: i + 1, tekst: raadsel.hints[i] })));
    expect(items[1]).toMatchObject({ juist: false, beloning: null });
    expect(items[2].juist).toBe(true);
    const fout = oplossing.map((r) => [...r]);
    [fout[0][0], fout[0][1]] = [fout[0][1], fout[0][0]];
    expect(rasterJuist(raadsel, fout)).toBe(false);
    expect(rasterJuist(raadsel, oplossing.map((r) => r.map((w) => ` ${w.toUpperCase()} `)))).toBe(true);
  });

  it('het voorbeeldraadsel is volledig en heeft precies één oplossing', () => {
    expect(raadselProblemen(raadsel)).toEqual([]);
    // Alle verdelingen van de waarden over de 4 plaatsen; de hints moeten precies één toelaten.
    const perms = (l: string[]): string[][] => (l.length <= 1 ? [l] : l.flatMap((x, i) => perms([...l.slice(0, i), ...l.slice(i + 1)]).map((p) => [x, ...p])));
    const [namen, drank, outfit, stunt] = raadsel.categorieen.map((c) => perms(c.oplossing));
    const plaats = (rij: string[], w: string) => rij.indexOf(w);
    const buren = (a: number, b: number) => Math.abs(a - b) === 1;
    const randen = (i: number) => i === 0 || i === 3;
    let oplossingen = 0;
    for (const n of namen)
      for (const d of drank)
        for (const o of outfit)
          for (const s of stunt) {
            const st = (deel: string) => s.findIndex((x) => x.includes(deel));
            const ok =
              plaats(d, 'Bier') === st('Gepaaldanst') &&
              randen(st('Gevochten')) &&
              plaats(d, 'Wijn') === st('slaap') &&
              randen(plaats(d, 'Wijn')) &&
              buren(plaats(o, 'Dierenonesie'), plaats(n, 'Lars')) &&
              plaats(n, 'Fien') === plaats(o, 'Dierenonesie') &&
              randen(plaats(d, 'Cava')) &&
              plaats(o, 'Dierenonesie') === plaats(d, 'Cava') &&
              buren(plaats(o, 'Overall'), st('snack')) &&
              buren(st('snack'), plaats(o, 'Geruit hemd')) &&
              plaats(o, 'Geruit hemd') === 3 &&
              plaats(n, 'Mats') === 2;
            if (ok) {
              oplossingen++;
              expect([n, d, o, s]).toEqual(oplossing);
            }
          }
    expect(oplossingen).toBe(1);
  });

  it('aanvaardt gangbare schrijfwijzen van de oefeningen', () => {
    const goed: [number, string][] = [
      [0, '\\frac{\\pi}{2}'],
      [0, 'y=pi/2'],
      [3, '\\frac{7\\pi}{60}'],
      [4, 'u_{n}=4n-10'],
      [5, 'Ja'],
      [6, '0,6'],
      [8, '247 500'],
      [9, '[-9,-1]'],
      [10, 'y=\\sin\\left(6\\left(x+\\frac{2-\\pi}{6}\\right)\\right)-1'],
      [10, 'y = sin(6(x+(2+π)/6)) - 1'],
      [11, 'w = -3'],
    ];
    for (const [nr, a] of goed) expect(automatischJuist(set.vragen[nr], a), `${nr}: ${a}`).toBe(true);
    expect(automatischJuist(set.vragen[10], 'y = sin(6x+2)-1')).toBe(false);
  });
});
