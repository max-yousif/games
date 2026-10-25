import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kluisSleutels, leesKluis, ontsleutel, schrijfKluis, versleutel, type KluisServer } from '../src/lib/kluis';
import type { Klas } from '../src/lib/types';

/** Gedeelde "Supabase" in het geheugen, zoals kluis_lees en kluis_schrijf. */
const rijen = new Map<string, { data: string; bijgewerkt: string }>();
const geheugen: KluisServer = {
  async lees(id) {
    return rijen.get(id) ?? null;
  },
  async schrijf(id, data) {
    const bijgewerkt = new Date().toISOString();
    rijen.set(id, { data, bijgewerkt });
    return bijgewerkt;
  },
};
vi.mock('../src/lib/kluisServer', () => ({ supabaseKluis: () => geheugen }));

const { useKluis } = await import('../src/lib/useKluis');

const klas = (id: string, naam: string, leerlingen: string[]): Klas => ({ id, naam, leerlingen: leerlingen.map((n, i) => ({ id: `${id}-${i}`, naam: n })) });
const CODE = 'mijn geheime kluiscode 2026';

beforeEach(() => {
  rijen.clear();
  localStorage.clear();
});

describe('kluis: versleuteling', () => {
  it('leidt een vast id af en versleutelt zodat de server geen namen ziet', async () => {
    const a = await kluisSleutels(CODE);
    const b = await kluisSleutels(`  ${CODE} `);
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(b.id).toBe(a.id);
    expect((await kluisSleutels('een andere code!!')).id).not.toBe(a.id);

    await schrijfKluis(geheugen, CODE, [klas('k1', '3A', ['Anna Peeters'])]);
    const opgeslagen = [...rijen.values()][0].data;
    expect(opgeslagen).not.toContain('Anna');
    expect(opgeslagen).not.toContain('3A');
    expect((await leesKluis(geheugen, CODE))?.klassen[0].leerlingen[0].naam).toBe('Anna Peeters');
  });

  it('weigert een verkeerde sleutel', async () => {
    const { sleutel } = await kluisSleutels(CODE);
    const { sleutel: fout } = await kluisSleutels('verkeerde kluiscode');
    const tekst = await versleutel({ versie: 1, bijgewerkt: '', klassen: [] }, sleutel);
    await expect(ontsleutel(tekst, fout)).rejects.toThrow(/niet geopend/);
  });
});

/** Een "toestel": eigen klassen in React-state, met de kluis-hook erbij. */
function toestel(start: Klas[]) {
  return renderHook(() => {
    const [klassen, setKlassen] = useState(start);
    return { klassen, setKlassen, kluis: useKluis(klassen, setKlassen) };
  });
}

describe('kluis: synchroniseren tussen toestellen', () => {
  it('nieuwe kluis, openen op een ander toestel (samenvoegen) en wijzigingen doorgeven', async () => {
    // Laptop op school: maakt de kluis met zijn klassen.
    const school = toestel([klas('k1', '3A', ['Anna Peeters'])]);
    await act(() => school.result.current.kluis.koppel(CODE, 'nieuw'));
    expect(school.result.current.kluis.gekoppeld).toBe(true);

    // Thuis (andere browser): een verkeerde code geeft een duidelijke fout.
    localStorage.clear();
    const thuis = toestel([klas('k2', '4B', ['Bert Claes'])]);
    await expect(act(() => thuis.result.current.kluis.koppel('typfout in de code', 'openen'))).rejects.toThrow(/geen kluis/);
    await act(() => thuis.result.current.kluis.koppel(CODE, 'openen'));
    expect(thuis.result.current.klassen.map((k) => k.naam).sort()).toEqual(['3A', '4B']);

    // Thuis een leerling toevoegen: wordt automatisch bewaard.
    act(() => thuis.result.current.setKlassen((ks) => ks.map((k) => (k.id === 'k1' ? { ...k, leerlingen: [...k.leerlingen, { id: 'n', naam: 'Chloé' }] } : k))));
    await waitFor(async () => expect((await leesKluis(geheugen, CODE))?.klassen.find((k) => k.id === 'k1')?.leerlingen).toHaveLength(2), { timeout: 4000 });

    // Volgende dag op school: de site haalt de nieuwere versie op.
    localStorage.setItem('games.v1.kluis', JSON.stringify({ code: CODE, laatsteSync: '2000-01-01T00:00:00.000Z' }));
    const schoolMorgen = toestel([klas('k1', '3A', ['Anna Peeters'])]);
    await waitFor(() => expect(schoolMorgen.result.current.klassen.map((k) => k.naam).sort()).toEqual(['3A', '4B']), { timeout: 4000 });
    expect(schoolMorgen.result.current.klassen.find((k) => k.id === 'k1')?.leerlingen.map((l) => l.naam)).toEqual(['Anna Peeters', 'Chloé']);
  });
});
