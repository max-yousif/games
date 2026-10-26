import { describe, expect, it } from 'vitest';
import {
  ACTIE_BASIS,
  codekrakerBeoordelingen,
  codekrakerStand,
  codekrakerToestand,
  leesBeloning,
  rolKist,
  vraagIndex,
  wachtwoordOpties,
  WOORDEN,
  volgendeActieNr,
  type DoelBeloning,
  type RaadBeloning,
} from '../src/live/codekraker';
import type { LiveAntwoord, LiveSpeler } from '../src/live/types';
import type { Vraag } from '../src/lib/types';

const vragen = [
  { id: 'v1', type: 'open', tekst: '1+1', antwoord: '2', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
  { id: 'v2', type: 'open', tekst: '2+2', antwoord: '4', opties: [], juisteOptie: 0, punten: 100, categorie: '', uitleg: '' },
] as Vraag[];
const spelers: LiveSpeler[] = ['A', 'B'].map((id) => ({ id, naam: id, bijnaam: null, verbonden: true }));
let teller = 0;
const ant = (spelerId: string, vraagNr: number, antwoord: string, tijdMs: number): LiveAntwoord => ({
  id: `a${teller++}`,
  spelerId,
  vraagNr,
  antwoord,
  tijdMs,
  juist: null,
  punten: 0,
  poging: 1,
  beloning: null,
});
const juisteAntwoord = (spelerId: string, nr: number) => (vragen[vraagIndex(spelerId, nr, 2)].antwoord as string);

/** Laat de leerkracht alles nakijken met een vaste "dobbelsteen". */
function speel(alle: LiveAntwoord[], rand: (n: number) => number) {
  const b = codekrakerBeoordelingen(vragen, { hacken: true }, spelers, alle, rand);
  return alle.map((a) => {
    const x = b.find((y) => y.id === a.id);
    return x ? { ...a, juist: x.juist, beloning: x.beloning ?? null } : a;
  });
}

describe('codekraker', () => {
  it('vraagnummers lopen rond over de vragen, verschillend per leerling', () => {
    expect([0, 1, 2, 3].map((n) => vraagIndex('A', n, 2))).toEqual([0, 1, 0, 1].map((i) => (i + vraagIndex('A', 0, 2)) % 2));
  });

  it('juist antwoord geeft een kistje; het kistje geeft munten', () => {
    let alle = [ant('A', ACTIE_BASIS, JSON.stringify({ soort: 'wachtwoord', woord: wachtwoordOpties('A')[0] }), 1), ant('A', 0, juisteAntwoord('A', 0), 2)];
    alle = speel(alle, () => 0);
    expect(alle[1].juist).toBe(true);
    expect(codekrakerToestand(spelers, alle).spelers.get('A')!.openKisten).toEqual([0]);
    alle.push(ant('A', ACTIE_BASIS + 1, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 1 }), 3));
    alle = speel(alle, () => 0); // rand 0 = eerste mogelijkheid: 1000 munten
    const t = codekrakerToestand(spelers, alle);
    expect(t.spelers.get('A')).toMatchObject({ munten: 1000, openKisten: [] });
    // Een kistje dat al open is, telt niet opnieuw.
    alle.push(ant('A', ACTIE_BASIS + 2, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 0 }), 4));
    alle = speel(alle, () => 0);
    expect(alle.at(-1)!.juist).toBe(false);
    expect(volgendeActieNr(alle.filter((a) => a.spelerId === 'A'))).toBe(ACTIE_BASIS + 3);
  });

  it('vermenigvuldiger en pech', () => {
    const p = { munten: 5000, mult: 3 } as never;
    expect(rolKist(() => 0, p, true)).toEqual({ uitkomst: 'munten', bedrag: 3000 });
    // Pech: 10 % kwijt.
    const pechIndex = 22 + 20 + 13 + 6 + 2 + 10 + 4 + 7;
    expect(rolKist(() => pechIndex, p, true)).toEqual({ uitkomst: 'pech', bedrag: -500 });
  });

  it('hacken: doelwit kiezen, wachtwoord raden, munten stelen', () => {
    const hackIndex = 22 + 20 + 13 + 6 + 2 + 10 + 4 + 7 + 4;
    let alle = [
      ant('A', ACTIE_BASIS, JSON.stringify({ soort: 'wachtwoord', woord: wachtwoordOpties('A')[0] }), 1),
      ant('B', ACTIE_BASIS, JSON.stringify({ soort: 'wachtwoord', woord: wachtwoordOpties('B')[1] }), 1),
      ant('B', 0, juisteAntwoord('B', 0), 2),
      ant('B', ACTIE_BASIS + 1, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 0 }), 3),
    ];
    alle = speel(alle, () => 3); // B: 1000 munten
    alle.push(ant('A', 0, juisteAntwoord('A', 0), 4), ant('A', ACTIE_BASIS + 1, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 2 }), 5));
    alle = speel(alle, () => hackIndex); // A: hackkans
    expect(codekrakerToestand(spelers, alle).spelers.get('A')!.hackKansen).toEqual([ACTIE_BASIS + 1]);
    alle.push(ant('A', ACTIE_BASIS + 2, JSON.stringify({ soort: 'doel', kist: ACTIE_BASIS + 1, doel: 'B' }), 6));
    alle = speel(alle, () => 0);
    const opties = leesBeloning<DoelBeloning>(alle.at(-1)!.beloning)!.opties!;
    expect(opties).toHaveLength(3);
    expect([...opties].sort()).toEqual([...wachtwoordOpties('B')].sort());
    alle.push(ant('A', ACTIE_BASIS + 3, JSON.stringify({ soort: 'raad', doelActie: ACTIE_BASIS + 2, woord: wachtwoordOpties('B')[1] }), 7));
    alle = speel(alle, (n) => (n === 16 ? 15 : 0)); // 25 %
    const raad = leesBeloning<RaadBeloning>(alle.at(-1)!.beloning)!;
    expect(raad).toMatchObject({ gelukt: true, bedrag: 250, doel: 'B' });
    const t = codekrakerToestand(spelers, alle);
    expect(t.spelers.get('A')!.munten).toBe(250);
    expect(t.spelers.get('B')).toMatchObject({ munten: 750, wachtwoord: raad.nieuwWoord });
    expect(wachtwoordOpties('B', 1)).toContain(raad.nieuwWoord);
    expect(t.spelers.get('B')!.melding!.tekst).toMatch(/Gehackt door A/);
    expect(codekrakerStand(t, 10).map((r) => [r.naam, r.punten])).toEqual([
      ['B', 750],
      ['A', 250],
    ]);
    expect(t.gebeurtenissen.at(-1)!.tekst).toMatch(/A hackte B/);
  });

  it('elke leerling krijgt 3 eigen wachtwoorden; enkel die zijn geldig', () => {
    const a = wachtwoordOpties('speler-a');
    expect(new Set(a).size).toBe(3);
    expect(wachtwoordOpties('speler-a')).toEqual(a);
    const verschillend = new Set(['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => wachtwoordOpties(id).join()));
    expect(verschillend.size).toBeGreaterThan(1);
    const anders = WOORDEN.find((w) => !wachtwoordOpties('A').includes(w))!;
    const b = codekrakerBeoordelingen(vragen, { hacken: true }, spelers, [ant('A', ACTIE_BASIS, JSON.stringify({ soort: 'wachtwoord', woord: anders }), 1)]);
    expect(b[0].juist).toBe(false);
  });

  it('firewall houdt hackers tegen', () => {
    const firewallIndex = 22 + 20 + 13 + 6 + 2 + 10 + 4;
    let alle = [
      ant('B', ACTIE_BASIS, JSON.stringify({ soort: 'wachtwoord', woord: wachtwoordOpties('B')[1] }), 1),
      ant('B', 0, juisteAntwoord('B', 0), 2),
      ant('B', ACTIE_BASIS + 1, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 0 }), 3),
    ];
    alle = speel(alle, () => firewallIndex);
    const hackIndex = firewallIndex + 7 + 4;
    alle.push(ant('A', 0, juisteAntwoord('A', 0), 4), ant('A', ACTIE_BASIS, JSON.stringify({ soort: 'kist', vraag: 0, keuze: 0 }), 5));
    alle = speel(alle, () => hackIndex);
    alle.push(ant('A', ACTIE_BASIS + 1, JSON.stringify({ soort: 'doel', kist: ACTIE_BASIS, doel: 'B' }), 6));
    alle = speel(alle, () => 0);
    expect(leesBeloning<DoelBeloning>(alle.at(-1)!.beloning)!.fout).toBe('firewall');
    // De hackkans blijft: een ander doelwit kiezen mag.
    expect(codekrakerToestand(spelers, alle).spelers.get('A')!.hackKansen).toEqual([ACTIE_BASIS]);
  });
});
