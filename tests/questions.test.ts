import { describe, expect, it } from 'vitest';
import { VOORBEELDSETS } from '../src/content/voorbeelden';
import { rowsToQuestions, parseCsv, QuestionImportError } from '../src/lib/importFile';
import { bordIndeling, dupliceerSet, juistAntwoord, speelbareVragen, vraagProblemen } from '../src/lib/questions';
import { vraag } from './helpers';

describe('bordIndeling', () => {
  it('groepeert per categorie in volgorde van voorkomen en sorteert op punten', () => {
    const k = bordIndeling([vraag('1', 'B', 200), vraag('2', 'A', 100), vraag('3', 'B', 100), vraag('4', '', 100)]);
    expect(k.map((x) => x.categorie)).toEqual(['B', 'A', 'Varia']);
    expect(k[0].vragen.map((v) => v.id)).toEqual(['3', '1']);
  });
});

describe('speelbareVragen', () => {
  it('laat onvolledige vragen en lege opties weg', () => {
    const mk = { ...vraag('2'), type: 'meerkeuze' as const, opties: ['ja', '', 'nee', ''], juisteOptie: 2 };
    const set = { ...VOORBEELDSETS[0], vragen: [vraag('1'), { ...vraag('x'), tekst: '' }, mk] };
    const v = speelbareVragen(set);
    expect(v.map((x) => x.id)).toEqual(['1', '2']);
    expect(v[1].opties).toEqual(['ja', 'nee']);
    expect(juistAntwoord(v[1])).toBe('nee');
  });
});

describe('voorbeeldsets', () => {
  it('bevatten enkel volledige vragen met unieke id\'s en 4 categorieën van 4 vragen (whodunit: 3 reeksen)', () => {
    for (const set of VOORBEELDSETS) {
      expect(set.vragen.every((v) => vraagProblemen(v).length === 0)).toBe(true);
      expect(new Set(set.vragen.map((v) => v.id)).size).toBe(set.vragen.length);
      const kolommen = bordIndeling(set.vragen);
      expect(kolommen).toHaveLength(set.raadsel ? 3 : 4);
      expect(kolommen.every((k) => k.vragen.length === 4)).toBe(true);
    }
  });

  it('dupliceren geeft nieuwe id\'s', () => {
    const kopie = dupliceerSet(VOORBEELDSETS[0]);
    expect(kopie.id).not.toBe(VOORBEELDSETS[0].id);
    expect(kopie.voorbeeld).toBeUndefined();
    expect(kopie.vragen[0].id).not.toBe(VOORBEELDSETS[0].vragen[0].id);
  });
});

describe('vragen importeren', () => {
  it('leest open en meerkeuzevragen uit een CSV met titelrij', () => {
    const rows = parseCsv('Categorie;Punten;Vraag;Antwoord;Fout antwoord 1;Fout antwoord 2;Uitleg\nMachten;200;$2^3$?;8;6;9;drie keer 2\nOntbinden;;$x^2-1$;$(x-1)(x+1)$;;;\n');
    const v = rowsToQuestions(rows);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ categorie: 'Machten', punten: 200, type: 'meerkeuze', uitleg: 'drie keer 2' });
    expect([...v[0].opties].sort()).toEqual(['6', '8', '9']);
    expect(juistAntwoord(v[0])).toBe('8');
    expect(v[1]).toMatchObject({ type: 'open', punten: 100, antwoord: '$(x-1)(x+1)$' });
  });

  it('geeft een duidelijke fout zonder kolommen Vraag en Antwoord', () => {
    expect(() => rowsToQuestions([['Naam', 'Klas']])).toThrow(QuestionImportError);
  });
});
