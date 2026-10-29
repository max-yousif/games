import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS } from '../src/live/codekraker';
import {
  cluedoBeoordelingen,
  cluedoToestand,
  kaartVanOpgave,
  metOpgaven,
  opgaveVragen,
  publiekThema,
  themaProblemen,
  trekOplossing,
  type CluedoThema,
} from '../src/live/cluedo';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';

const op = (opgave: string, uitkomst: string) => ({ opgave, uitkomst });
const thema: CluedoThema = {
  titel: 'Integralen',
  verdachten: ['Ann', 'Bob'],
  locaties: ['Keuken', 'Tuin'],
  wapens: ['Mes', 'Touw'],
  opgaven: {
    verdachten: [op('$\\int \\frac{1}{x}dx$', '\\ln|x|+C'), op('', '\\frac{\\pi}{4}')],
    locaties: [op('$\\int 2x\\,dx$', 'x^2+C'), op('$\\int \\cos x\\,dx$', '\\sin x+C')],
    wapens: [op('', 'e^x+C'), op('$\\int \\frac{1}{1+x^2}dx$', '\\operatorname{Bgtan} x+C')],
  },
};
const spelers: LiveSpeler[] = [{ id: 'A', naam: 'A', bijnaam: null, verbonden: true }];
let n = 0;
const ant = (antwoord: object, tijdMs: number): LiveAntwoord => ({ id: `a${n}`, spelerId: 'A', vraagNr: ACTIE_BASIS + n++, antwoord: JSON.stringify(antwoord), tijdMs, juist: null, punten: 0, poging: 1, beloning: null });

describe('cluedo met opgaven per kaart', () => {
  it('de kaart zonder opgave is de oplossing; zonder lege kaart kiest de laptop', () => {
    expect(metOpgaven(thema)).toBe(true);
    expect(themaProblemen(thema)).toEqual([]);
    const o = trekOplossing(thema, () => 0);
    expect(o.verdachte).toBe('Bob');
    expect(o.wapen).toBe('Mes');
    expect(o.locatie).toBe('Keuken');
    // Opgaven voor alle andere kaarten.
    const vragen = opgaveVragen(thema, o);
    expect(vragen.map((v) => kaartVanOpgave(thema, v.id)?.naam)).toEqual(['Ann', 'Tuin', 'Touw']);
    expect(vragen.every((v) => v.gelijkwaardig)).toBe(true);
  });

  it('problemen: twee kaarten zonder opgave, of een kaart zonder uitkomst', () => {
    const fout: CluedoThema = { ...thema, opgaven: { ...thema.opgaven!, verdachten: [op('', 'x'), op('', 'y')], wapens: [op('', ''), op('a', 'b')] } };
    expect(themaProblemen(fout)).toHaveLength(2);
  });

  it('de server krijgt geen opgaven, wel de uitkomsten van alle kaarten', () => {
    const p = publiekThema(thema);
    expect(p.opgaven).toBeUndefined();
    expect(p.uitkomsten!.verdachten).toEqual(['\\ln|x|+C', '\\frac{\\pi}{4}']);
  });

  it('een juiste (gelijkwaardige) uitkomst streept de kaart van die opgave weg', () => {
    const o = trekOplossing(thema, () => 0);
    const vragen = opgaveVragen(thema, o);
    let alle = [ant({ soort: 'opgave', nr: 0, antwoord: 'ln(x)' }, 1000), ant({ soort: 'opgave', nr: 2, antwoord: 'arctan(x)' }, 2000), ant({ soort: 'opgave', nr: 1, antwoord: 'x^3' }, 3000)];
    const b = cluedoBeoordelingen(vragen, thema, o, spelers, alle);
    expect(b.map((x) => x.juist)).toEqual([true, true, false]);
    alle = alle.map((a) => ({ ...a, juist: b.find((x) => x.id === a.id)!.juist, beloning: b.find((x) => x.id === a.id)!.beloning ?? null }));
    const p = cluedoToestand(spelers, alle).spelers.get('A')!;
    expect(p.weg.map((k) => k.naam)).toEqual(['Ann', 'Touw']);
    expect([p.juist, p.fout]).toEqual([2, 1]);
  });
});
