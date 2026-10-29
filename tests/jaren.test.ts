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
