import { describe, expect, it } from 'vitest';
import { parseNamen } from '../src/lib/students';

describe('parseNamen', () => {
  it('leest één naam per lijn en voegt kolommen samen', () => {
    expect(parseNamen('Voornaam\tAchternaam\nAnna\tPeeters\n\nBert  Claes \n')).toEqual(['Anna Peeters', 'Bert Claes']);
  });
  it('houdt een lijst zonder titelrij volledig', () => {
    expect(parseNamen('Anna\nBert')).toEqual(['Anna', 'Bert']);
  });
});
