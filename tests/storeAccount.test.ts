import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Klas } from '../src/lib/types';

let uid: string | null = null;
const cloudUids: (string | null)[] = [];
vi.mock('../src/lib/account', () => ({
  useAccount: () => ({ leerkracht: uid ? { uid, naam: uid } : null, afmelden: async () => undefined }),
}));
vi.mock('../src/lib/useCloud', () => ({
  useCloud: (u: string | null) => {
    cloudUids.push(u);
    return { status: 'uit', melding: null, laatsteSync: null, nu: () => undefined };
  },
  vergeetCloud: () => undefined,
}));

const { useStore } = await import('../src/lib/store');
const klas = { id: 'k1', naam: '5A', leerlingen: [] } as unknown as Klas;

describe('gegevens per account', () => {
  beforeEach(() => {
    localStorage.clear();
    cloudUids.length = 0;
  });

  it('een ander account begint leeg en krijgt de gegevens van het vorige niet', () => {
    uid = 'juf';
    const { result, rerender } = renderHook(() => useStore());
    act(() => result.current.setKlassen(() => [klas]));
    expect(result.current.klassen).toHaveLength(1);

    uid = 'gast';
    rerender();
    expect(result.current.klassen).toHaveLength(0);
    expect(result.current.sets).toHaveLength(0);
    // De cloud van het nieuwe account zag nooit de gegevens van het vorige.
    expect(cloudUids.filter((u) => u === 'gast').length).toBeGreaterThan(0);
  });

  it('hetzelfde account houdt zijn gegevens; gegevens van vóór het aanmelden horen bij het eerste account', () => {
    uid = null;
    const { result, rerender } = renderHook(() => useStore());
    act(() => result.current.setKlassen(() => [klas]));
    uid = 'juf';
    rerender();
    expect(result.current.klassen).toHaveLength(1);
    uid = null;
    rerender();
    uid = 'juf';
    rerender();
    expect(result.current.klassen).toHaveLength(1);
  });
});
