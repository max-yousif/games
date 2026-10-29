import { describe, expect, it } from 'vitest';
import { ACTIE_BASIS } from '../src/live/codekraker';
import {
  cluedoBeoordelingen,
  cluedoToestand,
  kaartVanOpgave,
  koppelVragen,
  metOpgaven,
  moderniseer,
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

describe('cluedo met meerkeuzevragen uit de set', () => {
  const mk = (id: string, antwoord: string, fout: string[]) =>
    ({ id, categorie: '', punten: 100, type: 'meerkeuze', tekst: `vraag ${id}`, antwoord: '', opties: [antwoord, ...fout], juisteOptie: 0, uitleg: '' }) as const;
  const setVragen = [mk('q1', '$\\ln|x|+C$', ['$x$', '$-\\frac{\\pi}{4}$']), mk('q2', '$x^2+C$', ['$2x$', '$x^3$']), mk('q3', '$e^x+C$', ['$1$', '$2$'])].map((v) => ({ ...v, opties: [...v.opties] }));
  const t: CluedoThema = {
    titel: 'MK',
    verdachten: ['Ann', 'Bob'],
    locaties: ['Keuken', 'Tuin'],
    wapens: ['Mes', 'Touw'],
    opgaven: {
      verdachten: [{ opgave: '', uitkomst: '\\ln|x|+C', vraagId: 'q1' }, { opgave: '', uitkomst: '-\\frac{\\pi}{4}' }],
      locaties: [{ opgave: '', uitkomst: 'x^2+C', vraagId: 'q2' }, { opgave: '', uitkomst: '' }],
      wapens: [{ opgave: '', uitkomst: 'e^x+C', vraagId: 'q3' }, { opgave: '', uitkomst: '' }],
    },
  };

  it('de vragen uit de set worden de opgaven; het blad krijgt geen uitkomsten', () => {
    expect(themaProblemen(t)).toEqual([]);
    const o = trekOplossing(t);
    expect(o).toEqual({ verdachte: 'Bob', locatie: 'Tuin', wapen: 'Touw' });
    const vragen = opgaveVragen(t, o, setVragen);
    expect(vragen.map((v) => [v.type, kaartVanOpgave(t, v.id)?.naam])).toEqual([
      ['meerkeuze', 'Ann'],
      ['meerkeuze', 'Keuken'],
      ['meerkeuze', 'Mes'],
    ]);
    const p = publiekThema(t);
    expect(p.metOpgaven).toBe(true);
    expect(p.uitkomsten).toBeUndefined();
  });

  it('elke keuze streept stil een kaart weg; de laatste keuze telt', () => {
    const o = trekOplossing(t);
    const vragen = opgaveVragen(t, o, setVragen);
    // Juist: Ann weg. Fout met de uitkomst van een andere kaart (-π/4 = Bob, de dader!): Bob weg. Ander fout antwoord: een vaste andere kaart.
    let alle = [ant({ soort: 'opgave', nr: 0, antwoord: '2' }, 1000), ant({ soort: 'opgave', nr: 1, antwoord: '0' }, 2000), ant({ soort: 'opgave', nr: 2, antwoord: '1' }, 3000)];
    const speel = () => {
      const b = cluedoBeoordelingen(vragen, t, o, spelers, alle);
      alle = alle.map((a) => {
        const x = b.find((y) => y.id === a.id);
        return x ? { ...a, juist: x.juist, beloning: x.beloning ?? null } : a;
      });
    };
    speel();
    expect(alle.every((a) => a.juist)).toBe(true);
    let p = cluedoToestand(spelers, alle).spelers.get('A')!;
    const weg = p.weg.map((k) => k.naam);
    expect(weg.slice(0, 2)).toEqual(['Bob', 'Keuken']);
    expect(weg[2]).not.toBe('Mes');
    // Antwoord op vraag 1 verbeteren: Bob komt terug, Ann verdwijnt.
    alle.push(ant({ soort: 'opgave', nr: 0, antwoord: '0' }, 4000));
    speel();
    p = cluedoToestand(spelers, alle).spelers.get('A')!;
    expect(p.weg.map((k) => k.naam)).toContain('Ann');
    expect(p.weg.map((k) => k.naam)).not.toContain('Bob');
    expect(p.juist).toBe(3);
  });
});

describe('cluedo: kaarten en oplossing aanduiden, vragen automatisch koppelen', () => {
  const vr = (id: string, uitleg = '') => ({ id, categorie: '', punten: 100, type: 'meerkeuze' as const, tekst: id, antwoord: '', opties: [`juist ${id}`, `fout ${id}`], juisteOptie: 0, uitleg });
  const t: CluedoThema = { titel: 'K', verdachten: ['Ann', 'Bob', 'Cas'], locaties: ['Keuken', 'Tuin'], wapens: ['Mes', 'Touw'], metVragen: true, oplossing: { verdachte: 'Bob', locatie: 'Tuin', wapen: 'Touw' } };

  it('de aangeduide oplossing; elke andere kaart een vraag (uitleg eerst, de rest willekeurig)', () => {
    const vragen = [vr('a'), vr('b', 'Waar? keuken'), vr('c'), vr('d'), vr('e')];
    const k = koppelVragen(t, vragen, () => 0);
    if ('fout' in k) throw new Error(k.fout);
    expect(k.oplossing.verdachte).toBe('Bob');
    expect(k.oplossing.wapen).toBe('Touw');
    const opgaven = opgaveVragen(k.thema, k.oplossing, vragen);
    // 7 kaarten - 3 = 4 vragen, elk bij een andere kaart; de Keuken-vraag bij de Keuken.
    expect(opgaven).toHaveLength(4);
    const kaarten = opgaven.map((v) => kaartVanOpgave(k.thema, v.id)!.naam);
    expect(new Set(kaarten).size).toBe(4);
    expect(kaarten).not.toContain('Bob');
    expect(opgaven[kaarten.indexOf('Keuken')].tekst).toBe('b');
    expect(publiekThema(k.thema).uitkomsten).toBeUndefined();
  });

  it('te weinig vragen: een duidelijke melding', () => {
    const k = koppelVragen(t, [vr('a')]);
    expect('fout' in k && k.fout).toMatch(/4 vragen, de set heeft er 1/);
  });

  it('kaarten van vroeger (vraag per kaart) worden omgezet: de kaart zonder vraag is de aangeduide oplossing', () => {
    const oud: CluedoThema = {
      titel: 'Oud',
      verdachten: ['Ann', 'Bob'],
      locaties: ['Keuken', 'Tuin'],
      wapens: ['Mes', 'Touw'],
      opgaven: {
        verdachten: [{ opgave: '', uitkomst: 'x', vraagId: 'q1' }, { opgave: '', uitkomst: '' }],
        locaties: [{ opgave: '', uitkomst: '' }, { opgave: '', uitkomst: 'y', vraagId: 'q2' }],
        wapens: [{ opgave: '', uitkomst: 'z', vraagId: 'q3' }, { opgave: '', uitkomst: '' }],
      },
    };
    const n = moderniseer(oud);
    expect(n.metVragen).toBe(true);
    expect(n.opgaven).toBeUndefined();
    expect(n.oplossing).toEqual({ verdachte: 'Bob', locatie: 'Keuken', wapen: 'Touw' });
  });
});
