import { describe, expect, it } from 'vitest';
import { herkenKolommen, parseCsv, rijenNaarVragen } from '../src/lib/importFile';
import { lijktTabel, TEKST_VOORBEELD, tekstNaarVragen } from '../src/lib/tekstImport';

describe('tekstNaarVragen', () => {
  it('leest het voorbeeld met alle soorten vragen', () => {
    const items = tekstNaarVragen(TEKST_VOORBEELD);
    expect(items.every((i) => i.vraag)).toBe(true);
    const v = items.map((i) => i.vraag!);
    expect(v.map((x) => x.type)).toEqual(['meerkeuze', 'waaronwaar', 'open', 'getal', 'invullen', 'koppelen']);
    expect(v[0]).toMatchObject({ categorie: 'Machten', punten: 200, tekst: 'Bereken: $(-3)^{-2}$', uitleg: 'Negatieve exponent: neem het omgekeerde.' });
    expect(v[0].opties[v[0].juisteOptie]).toBe('$\\frac{1}{9}$');
    expect(v[0].opties).toHaveLength(4);
    expect(v[1].juisteOptie).toBe(1);
    expect(v[2]).toMatchObject({ categorie: 'Ontbinden', antwoord: '$(x-7)(x+7)$', alternatieven: ['$(x+7)(x-7)$'] });
    expect(v[3]).toMatchObject({ antwoord: '6,67', tolerantie: 0.01 });
    expect(v[4].categorie).toBe('Python');
    expect(v[5].paren).toEqual([
      ['$y=x^2$', 'dalparabool'],
      ['$y=-x^2$', 'bergparabool'],
    ]);
  });

  it('vraag over meerdere lijnen en codeblokken', () => {
    const [it1] = tekstNaarVragen('Wat drukt dit af?\n```\nx = 3\n\n- 1\nprint(x)\n```\n* 3\n- 4');
    expect(it1.vraag!.tekst).toBe('Wat drukt dit af?\n```\nx = 3\n\n- 1\nprint(x)\n```');
    expect(it1.vraag!.type).toBe('meerkeuze');
  });

  it('meldt problemen per vraag', () => {
    const items = tekstNaarVragen('Vraag 1\n- a\n- b\n\nVraag 2\n= 4\nnog tekst');
    expect(items[0].fout).toMatch(/precies één juist antwoord/);
    expect(items[1].fout).toMatch(/lege lijn/);
  });

  it('herkent een tabel', () => {
    expect(lijktTabel('a\tb\nc\td')).toBe(true);
    expect(lijktTabel('Vraag\n= 3')).toBe(false);
  });
});

describe('kolommen zonder titelrij', () => {
  it('eerste kolom vraag, tweede antwoord, rest foute antwoorden', () => {
    const rijen = parseCsv('Hoeveel is 2+2?\t4\t3\t5\nHoofdstad van België?\tBrussel\n$2^3=8$\twaar');
    const { kolommen, metTitels } = herkenKolommen(rijen);
    expect(metTitels).toBe(false);
    const v = rijenNaarVragen(rijen, kolommen, metTitels).map((i) => i.vraag!);
    expect(v.map((x) => x.type)).toEqual(['meerkeuze', 'open', 'waaronwaar']);
    expect(v[1].antwoord).toBe('Brussel');
  });

  it('titelrij met genummerde kolommen', () => {
    const rijen = parseCsv('Vraag;Antwoord;Fout antwoord 4\nx;y;z');
    expect(herkenKolommen(rijen)).toEqual({ kolommen: ['vraag', 'antwoord', 'fout'], metTitels: true });
  });
});
