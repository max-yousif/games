import { describe, expect, it } from 'vitest';
import { jarenVan } from '../src/pages/SetsPage';

describe('leerjaar herkennen', () => {
  it('jaren uit vrije tekst', () => {
    expect(jarenVan('3e jaar (5 u)')).toEqual([3]);
    expect(jarenVan('6e jaar Humane wetenschappen')).toEqual([6]);
    expect(jarenVan('5e–6e jaar')).toEqual([5, 6]);
    expect(jarenVan('4de jaar')).toEqual([4]);
    expect(jarenVan('derdes en vierdes')).toEqual([3, 4]);
    expect(jarenVan('zesde jaar')).toEqual([6]);
    expect(jarenVan('')).toEqual([]);
    expect(jarenVan('algemeen')).toEqual([]);
  });
});

describe('leerjaar van een klas', () => {
  it('uit de klasnaam', async () => {
    const { jaarVanKlas } = await import('../src/pages/KlassenPage');
    expect(jaarVanKlas('3A')).toBe(3);
    expect(jaarVanKlas('5 WeWi')).toBe(5);
    expect(jaarVanKlas('6HW')).toBe(6);
    expect(jaarVanKlas('Klas 1')).toBeNull();
    expect(jaarVanKlas('12B')).toBeNull();
  });
});

describe('leerjaar zelf gekozen', () => {
  it('gekozen jaar wint van de naam; 0 = geen jaar', async () => {
    const { klasJaar } = await import('../src/pages/KlassenPage');
    expect(klasJaar({ naam: '3A' })).toBe(3);
    expect(klasJaar({ naam: 'Wiskunde B', jaar: 5 })).toBe(5);
    expect(klasJaar({ naam: '3A', jaar: 4 })).toBe(4);
    expect(klasJaar({ naam: '3A', jaar: 0 })).toBeNull();
  });
});
