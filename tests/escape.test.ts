import { describe, expect, it } from 'vitest';
import { escapeBeoordelingen, escapeStand, escapeVoortgang, maakEscapeCode, slotVraag } from '../src/live/escape';
import { lokaalBackend, type Opslag } from '../src/live/lokaal';
import { LiveFout, type LiveAntwoord } from '../src/live/types';
import type { Vraag } from '../src/lib/types';
import { vraag } from './helpers';

const vragen: Vraag[] = [
  { ...vraag('a', 'X', 100), type: 'getal', antwoord: '6' },
  { ...vraag('b', 'X', 200), type: 'meerkeuze', opties: ['1', '2'], juisteOptie: 1 },
];
const ant = (id: string, spelerId: string, vraagNr: number, antwoord: string, extra: Partial<LiveAntwoord> = {}): LiveAntwoord => ({
  id,
  spelerId,
  vraagNr,
  antwoord,
  tijdMs: 1000,
  juist: null,
  punten: 0,
  poging: 1,
  beloning: null,
  ...extra,
});

describe('escape room: logica', () => {
  it('maakt een code met één cijfer per slot', () => {
    expect(maakEscapeCode(5)).toMatch(/^\d{5}$/);
    expect(maakEscapeCode(3, () => 7)).toBe('777');
  });

  it('geeft het cijfer van het slot bij een juist antwoord en controleert de eindcode', () => {
    // Elke leerling heeft de vragen in een andere volgorde achter de sloten; het cijfer hoort bij het slot.
    const achter = (nr: number) => vragen[slotVraag('p', nr, vragen)];
    const juist = (nr: number) => (achter(nr).type === 'getal' ? 'x = 6' : '1');
    const fout = (nr: number) => (achter(nr).type === 'getal' ? '7' : '0');
    const b = escapeBeoordelingen(vragen, '48', [
      ant('1', 'p', 0, juist(0)),
      ant('2', 'p', 1, fout(1)),
      ant('3', 'p', -1, '4 8'),
      ant('4', 'p', -1, '84'),
      ant('5', 'p', 0, '6', { juist: true }),
    ]);
    expect(b).toEqual([
      { id: '1', juist: true, punten: achter(0).punten, beloning: '4' },
      { id: '2', juist: false, punten: 0, beloning: null },
      { id: '3', juist: true, punten: 0, beloning: null },
      { id: '4', juist: false, punten: 0, beloning: null },
    ]);
  });

  it('elke leerling een eigen volgorde, enkel binnen dezelfde categorie', () => {
    const lijst = ['A', 'A', 'A', 'A', 'B', 'B', 'B'].map((categorie) => ({ categorie }));
    const volgorde = (id: string) => lijst.map((_, nr) => slotVraag(id, nr, lijst));
    for (const id of ['anna', 'bert', 'chloe']) {
      const v = volgorde(id);
      expect([...v].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(v.slice(0, 4).every((i) => i < 4)).toBe(true);
      expect(v).toEqual(volgorde(id));
    }
    expect(new Set(['anna', 'bert', 'chloe', 'dries'].map((id) => volgorde(id).join())).size).toBeGreaterThan(1);
  });

  it('rangschikt: ontsnapt (snelste eerst), dan meeste sloten', () => {
    const spelers = ['Anna', 'Bert', 'Chloé', 'Dries'].map((naam) => ({ id: naam, naam, bijnaam: null, verbonden: true }));
    const v = escapeVoortgang(spelers, [
      ant('1', 'Anna', 0, '', { juist: true }),
      ant('2', 'Bert', 0, '', { juist: true }),
      ant('3', 'Bert', 1, '', { juist: true }),
      ant('4', 'Bert', -1, '', { juist: true, tijdMs: 90000 }),
      ant('5', 'Chloé', 0, '', { juist: true }),
      ant('6', 'Chloé', 1, '', { juist: true }),
      ant('7', 'Chloé', -1, '', { juist: true, tijdMs: 60000 }),
      ant('8', 'Dries', 1, '', { juist: false }),
      ant('9', 'Dries', 1, '', { juist: null, poging: 2 }),
    ]);
    expect(v.map((x) => x.speler.naam)).toEqual(['Chloé', 'Bert', 'Anna', 'Dries']);
    expect(v[3].fout.get(1)).toBe(1);
    expect(v[3].bezig.has(1)).toBe(true);
    expect(escapeStand(v)[0]).toEqual({ id: 'Chloé', naam: 'Chloé', punten: 2, juist: 2, tijdMs: 60000 });
  });
});

describe('escape room: lokale server (demo)', () => {
  it('volgt dezelfde regels als de database', async () => {
    let waarde: string | null = null;
    const opslag = (): Opslag => ({ lees: () => waarde, schrijf: (w) => (waarde = w), luister: () => () => {} });
    let t = 0;
    const klok = () => t;
    const host = lokaalBackend('host', opslag(), klok);
    const anna = lokaalBackend('anna', opslag(), klok);
    const s = await host.maakSessie({ titel: 'E', namen: [], vrijeNaam: true, aantalVragen: 2, timer: 600, modus: 'escape', vragen: [], wachttijd: 10 });
    await anna.deelnemen(s.code, 'Anna');
    const fout = async (p: Promise<unknown>) => p.then(() => null, (e) => (e instanceof LiveFout ? e.code : String(e)));

    expect(await fout(anna.antwoord(s.id, 0, 'x'))).toBe('geen_vraag');
    await host.startEscape(s.id);
    await anna.antwoord(s.id, 0, 'fout');
    expect(await fout(anna.antwoord(s.id, 0, 'nog eens'))).toBe('wacht');
    /** Haalt de antwoorden op zoals de leerkracht ze ziet. */
    const lees = async () => {
      let r: LiveAntwoord[] = [];
      const stop = host.volgAntwoorden(s.id, (a) => (r = a));
      await Promise.resolve();
      stop();
      return r;
    };
    let rijen = await lees();
    await host.beoordeel(s.id, [{ id: rijen[0].id, juist: false, punten: 0 }]);
    expect(await fout(anna.antwoord(s.id, 0, 'nog eens'))).toBe('wacht');
    t += 11000;
    await anna.antwoord(s.id, 0, 'nog eens');
    rijen = await lees();
    expect(rijen.map((r) => r.poging)).toEqual([1, 2]);
    await host.beoordeel(s.id, [{ id: rijen[1].id, juist: true, punten: 100, beloning: '3' }]);
    expect(await fout(anna.antwoord(s.id, 0, 'x'))).toBe('al_opgelost');
    await anna.antwoord(s.id, -1, '12');
    expect(await fout(anna.antwoord(s.id, 2, 'x'))).toBe('geen_vraag');
    t += 700000;
    expect(await fout(anna.antwoord(s.id, 1, 'x'))).toBe('te_laat');
  });
});
