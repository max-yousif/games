import { describe, expect, it } from 'vitest';
import { antwoordWeergave, automatischJuist, publiekeVraag } from '../src/live/logic';
import { parseCsv, rowsToQuestions } from '../src/lib/importFile';
import { juistAntwoord, speelbareVragen, vraagProblemen } from '../src/lib/questions';
import type { Vraag } from '../src/lib/types';
import { gatenAlsTekst, gatenVan, getalJuist, koppelenRechts, leesGetal, ordenenGetoond, tekstMetGaten, vastGeschud } from '../src/lib/vraagtypes';
import { VOORBEELDSETS } from '../src/content/voorbeelden';
import { vraag } from './helpers';

const v = (extra: Partial<Vraag>): Vraag => ({ ...vraag('t'), ...extra });

describe('getallen lezen', () => {
  it('begrijpt hoe leerlingen getallen typen', () => {
    expect(leesGetal('12,5')).toBe(12.5);
    expect(leesGetal(' -3 ')).toBe(-3);
    expect(leesGetal('3/4')).toBe(0.75);
    expect(leesGetal('x = 7')).toBe(7);
    expect(leesGetal('2 500')).toBe(2500);
    expect(leesGetal('$0{,}15$')).toBe(0.15);
    expect(leesGetal('$\\dfrac{1}{4}$')).toBe(0.25);
    expect(leesGetal('3,5 cm')).toBe(3.5);
    expect(leesGetal('15 %')).toBe(15);
    expect(leesGetal('abc')).toBeNull();
    expect(leesGetal('1/0')).toBeNull();
  });

  it('vergelijkt met foutmarge', () => {
    expect(getalJuist('1,26', '1,26', 0.01)).toBe(true);
    expect(getalJuist('1.27', '1,26', 0.01)).toBe(true);
    expect(getalJuist('1,28', '1,26', 0.01)).toBe(false);
    expect(getalJuist('1/6', '1/6')).toBe(true);
    expect(getalJuist('0,1667', '1/6')).toBe(false);
    expect(getalJuist('0,1667', '1/6', 0.001)).toBe(true);
  });
});

describe('invullen', () => {
  const tekst = 'Vul aan: `for i in [[range]](3):` en $\\frac12$ = [[0,5|1/2]]';
  it('vindt de gaten met alternatieven', () => {
    expect(gatenVan(tekst)).toEqual([['range'], ['0,5', '1/2']]);
    expect(tekstMetGaten(tekst)).toBe('Vul aan: `for i in ⟦1⟧(3):` en $\\frac12$ = ⟦2⟧');
    expect(gatenAlsTekst(tekstMetGaten(tekst))).toBe('Vul aan: `for i in ★(3):` en $\\frac12$ = ●');
    expect(tekstMetGaten(tekst, ['range', '0,5'])).toContain('for i in range(3)');
  });
  it('wordt automatisch nagekeken', () => {
    const q = v({ type: 'invullen', tekst });
    expect(automatischJuist(q, JSON.stringify(['range', '0.5']))).toBe(true);
    expect(automatischJuist(q, JSON.stringify([' Range ', '1/2']))).toBe(true);
    expect(automatischJuist(q, JSON.stringify(['range', '0,50']))).toBe(true);
    expect(automatischJuist(q, JSON.stringify(['print', '0,5']))).toBe(false);
    expect(automatischJuist(q, 'geen json')).toBe(false);
    expect(publiekeVraag(q).tekst).not.toContain('range');
    expect(publiekeVraag(q).gaten).toBe(2);
  });
  it('meldt een tekst zonder gaten', () => {
    expect(vraagProblemen(v({ type: 'invullen', tekst: 'Geen gaten' }))).toContain('Zet minstens één antwoord tussen [[ en ]].');
  });
});

describe('ordenen', () => {
  const q = v({ type: 'ordenen', opties: ['a = 1', 'if a > 0:', '    print(a)'], alsCode: true });
  it('toont de items altijd op dezelfde manier door elkaar', () => {
    expect(ordenenGetoond(q)).toEqual(ordenenGetoond(q));
    expect(ordenenGetoond(q)).not.toEqual(q.opties);
    expect([...ordenenGetoond(q)].sort()).toEqual([...q.opties].sort());
    expect(publiekeVraag(q).opties).toEqual(ordenenGetoond(q));
  });
  it('controleert de volgorde, inclusief inspringing', () => {
    expect(automatischJuist(q, JSON.stringify(q.opties))).toBe(true);
    expect(automatischJuist(q, JSON.stringify(['a = 1', 'if a > 0:', 'print(a)']))).toBe(false);
    expect(automatischJuist(q, JSON.stringify(['if a > 0:', 'a = 1', '    print(a)']))).toBe(false);
  });
  it('toont het antwoord van een leerling in letters', () => {
    const pv = publiekeVraag(q);
    const letters = antwoordWeergave(pv, JSON.stringify(q.opties));
    expect(letters).toMatch(/^[A-C] – [A-C] – [A-C]$/);
  });
  it('schudt nooit in de oorspronkelijke volgorde', () => {
    for (let i = 0; i < 50; i++) expect(vastGeschud([1, 2], `zaad${i}`)).toEqual([2, 1]);
  });
});

describe('koppelen', () => {
  const q = v({
    type: 'koppelen',
    paren: [
      ['$x^2-9$', '$(x-3)(x+3)$'],
      ['$x^2+3x$', '$x(x+3)$'],
      ['', ''],
    ],
  });
  it('laat lege paren weg en controleert de koppeling', () => {
    const [speelbaar] = speelbareVragen({ ...VOORBEELDSETS[0], vragen: [q] });
    expect(speelbaar.paren).toHaveLength(2);
    expect(automatischJuist(speelbaar, JSON.stringify(['$(x-3)(x+3)$', '$x(x+3)$']))).toBe(true);
    expect(automatischJuist(speelbaar, JSON.stringify(['$x(x+3)$', '$(x-3)(x+3)$']))).toBe(false);
    const pv = publiekeVraag(speelbaar);
    expect(pv.links).toEqual(['$x^2-9$', '$x^2+3x$']);
    expect(pv.rechts).toEqual(koppelenRechts(speelbaar));
    expect(juistAntwoord(speelbaar)).toContain('→');
  });
});

describe('waar of onwaar en getal', () => {
  it('worden automatisch nagekeken', () => {
    const wo = v({ type: 'waaronwaar', juisteOptie: 1 });
    expect(publiekeVraag(wo).opties).toEqual(['Waar', 'Onwaar']);
    expect(automatischJuist(wo, '1')).toBe(true);
    expect(juistAntwoord(wo)).toBe('Onwaar');
    const g = v({ type: 'getal', antwoord: '6,67', tolerantie: 0.01 });
    expect(automatischJuist(g, '6.666')).toBe(true);
    expect(automatischJuist(g, 'x = 6,67')).toBe(true);
    expect(automatischJuist(g, '6,7')).toBe(false);
    expect(juistAntwoord(g)).toBe('6,67 (± 0,01)');
  });
});

describe('Excel-import met kolom Type', () => {
  it('leest alle types', () => {
    const csv = [
      'Type;Categorie;Punten;Vraag;Antwoord;Fout antwoord 1;Tolerantie',
      'waar/onwaar;A;100;$2^3=6$;onwaar;;',
      'getal;A;200;Gemiddelde?;6,67;;0,01',
      'invullen;B;100;Vul aan: [[range]];;;',
      'ordenen;B;300;Volgorde?;x = 1|if x:|    print(x);;',
      'koppelen;C;200;Koppel;$y=x^2$ -> dal|$y=-x^2$ -> berg;;',
      ';C;100;Zonder type maar met [[gat]];;;',
    ].join('\n');
    const vragen = rowsToQuestions(parseCsv(csv));
    expect(vragen.map((x) => x.type)).toEqual(['waaronwaar', 'getal', 'invullen', 'ordenen', 'koppelen', 'invullen']);
    expect(vragen[0].juisteOptie).toBe(1);
    expect(vragen[1]).toMatchObject({ antwoord: '6,67', tolerantie: 0.01 });
    expect(vragen[3]).toMatchObject({ opties: ['x = 1', 'if x:', '    print(x)'], alsCode: true });
    expect(vragen[4].paren).toEqual([
      ['$y=x^2$', 'dal'],
      ['$y=-x^2$', 'berg'],
    ]);
    expect(vragen.every((x) => vraagProblemen(x).length === 0)).toBe(true);
  });

  it('meldt een onbekend type', () => {
    expect(() => rowsToQuestions([['Type', 'Vraag', 'Antwoord'], ['raadsel', 'x', 'y']])).toThrow(/Onbekend type "raadsel"/);
  });
});

describe('open vraag met meerdere juiste antwoorden', () => {
  it('aanvaardt elk juist antwoord en toont ze allemaal', () => {
    const q = v({ type: 'open', antwoord: 'dalparabool', alternatieven: ['parabool met top onderaan', ''] });
    expect(automatischJuist(q, 'Dalparabool')).toBe(true);
    expect(automatischJuist(q, 'parabool met top  onderaan')).toBe(true);
    expect(automatischJuist(q, 'bergparabool')).toBe(false);
    expect(juistAntwoord(q)).toBe('dalparabool  of  parabool met top onderaan');
  });

  it('leest "Ook juist" en " | " uit Excel, maar splitst een absolute waarde niet', () => {
    const vragen = rowsToQuestions(
      parseCsv(['Vraag;Antwoord;Ook juist', 'Los op: 2x=12;x = 6 | 6;x=6,0', 'Schrijf |x| voor x<0;$|x|=-x$;'].join('\n')),
    );
    expect(vragen[0]).toMatchObject({ type: 'open', antwoord: 'x = 6', alternatieven: ['6', 'x=6,0'] });
    expect(vragen[1].antwoord).toBe('$|x|=-x$');
    expect(vragen[1].alternatieven).toBeUndefined();
  });
});
