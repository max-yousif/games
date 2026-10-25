import { describe, expect, it } from 'vitest';
import { splitsTekst } from '../src/lib/richText';

describe('splitsTekst', () => {
  it('herkent formules, code en codeblokken', () => {
    expect(splitsTekst('Los op: $x^2=4$ met `print(x)`')).toEqual([
      { soort: 'tekst', tekst: 'Los op: ' },
      { soort: 'formule', tex: 'x^2=4', blok: false },
      { soort: 'tekst', tekst: ' met ' },
      { soort: 'code', code: 'print(x)', blok: false },
    ]);
    expect(splitsTekst('Wat print dit?\n```python\nx = 5\nprint(x)\n```')).toEqual([
      { soort: 'tekst', tekst: 'Wat print dit?\n' },
      { soort: 'code', code: 'x = 5\nprint(x)', blok: true },
    ]);
    expect(splitsTekst('$$\\int_0^1 x$$')).toEqual([{ soort: 'formule', tex: '\\int_0^1 x', blok: true }]);
  });

  it('laat losse dollartekens en \\$ als gewone tekst', () => {
    expect(splitsTekst('Prijs: 5 \\$ per stuk')).toEqual([{ soort: 'tekst', tekst: 'Prijs: 5 $ per stuk' }]);
    expect(splitsTekst('Kost $5')).toEqual([{ soort: 'tekst', tekst: 'Kost $5' }]);
  });
});
