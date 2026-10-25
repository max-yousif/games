import { describe, expect, it } from 'vitest';
import { lokaalBackend, type Opslag } from '../src/live/lokaal';
import { LiveFout, type LiveAntwoord, type LiveSessie, type LiveSpeler } from '../src/live/types';

/** Gedeelde opslag zoals localStorage, met meldingen naar de andere "tabbladen". */
function gedeeldeOpslag() {
  let waarde: string | null = null;
  const luisteraars = new Set<() => void>();
  return (): Opslag => {
    let eigen: (() => void) | null = null;
    return {
      lees: () => waarde,
      schrijf: (w) => {
        waarde = w;
        luisteraars.forEach((l) => l !== eigen && l());
      },
      luister: (cb) => {
        eigen = cb;
        luisteraars.add(cb);
        return () => luisteraars.delete(cb);
      },
    };
  };
}

async function fout(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof LiveFout ? e.code : (e as Error).message;
  }
}

function opzet() {
  const opslag = gedeeldeOpslag();
  let t = 1_000_000;
  const klok = () => t;
  const host = lokaalBackend('host', opslag(), klok);
  const anna = lokaalBackend('anna', opslag(), klok);
  const bert = lokaalBackend('bert', opslag(), klok);
  return { host, anna, bert, verstrijk: (ms: number) => (t += ms) };
}

/** Onthoudt de laatste waarde van een volg-functie. */
function laatste<T>(volg: (cb: (t: T) => void) => () => void): { waarde: () => T | undefined } {
  let w: T | undefined;
  volg((x) => (w = x));
  return { waarde: () => w };
}

describe('lokale live server (demo)', () => {
  it('volgt dezelfde regels als de database', async () => {
    const { host, anna, bert, verstrijk } = opzet();
    const s = await host.maakSessie({ titel: 'Test', namen: ['Anna', 'Bert'], vrijeNaam: false, aantalVragen: 2, timer: 10 });
    expect(s.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    expect((await anna.sessieInfo(s.code.toLowerCase()))?.vrijeNamen).toEqual(['Anna', 'Bert']);
    await anna.deelnemen(s.code, 'Anna');
    expect(await fout(bert.deelnemen(s.code, 'Anna'))).toBe('naam_bezet');
    expect(await fout(bert.deelnemen(s.code, 'Mickey'))).toBe('ongeldige_naam');
    expect(await fout(bert.deelnemen('ZZZZZZ', 'Bert'))).toBe('onbekende_code');
    await bert.deelnemen(s.code, 'Bert');

    expect(await fout(anna.antwoord(s.id, 0, '1'))).toBe('geen_vraag');
    await host.startVraag(s.id, 0, { tekst: '2+2?', type: 'meerkeuze', opties: ['3', '4'], links: [], rechts: [], gaten: 0, alsCode: false, punten: 100, categorie: '' });
    verstrijk(1500);
    await anna.antwoord(s.id, 0, '1');
    expect(await fout(anna.antwoord(s.id, 0, '0'))).toBe('al_geantwoord');
    verstrijk(11000);
    expect(await fout(bert.antwoord(s.id, 0, '1'))).toBe('te_laat');

    const hostAntw = laatste<LiveAntwoord[]>((cb) => host.volgAntwoorden(s.id, cb));
    const annaAntw = laatste<LiveAntwoord[]>((cb) => anna.volgAntwoorden(s.id, cb));
    const bertSessie = laatste<LiveSessie | null>((cb) => bert.volgSessie(s.id, cb));
    await Promise.resolve();
    expect(hostAntw.waarde()).toHaveLength(1);
    expect(hostAntw.waarde()![0].tijdMs).toBe(1500);
    expect(annaAntw.waarde()).toHaveLength(1);
    expect(bertSessie.waarde()?.status).toBe('vraag');

    // Leerlingen kunnen niets wijzigen.
    await anna.wijzigSessie(s.id, { status: 'einde' });
    expect(await fout(anna.beoordeel(s.id, [{ id: hostAntw.waarde()![0].id, juist: true, punten: 999 }]))).toBe('geen_host');
    expect(bertSessie.waarde()?.status).toBe('vraag');

    await host.beoordeel(s.id, [{ id: hostAntw.waarde()![0].id, juist: true, punten: 100 }]);
    expect(annaAntw.waarde()![0]).toMatchObject({ juist: true, punten: 100 });

    // Loskoppelen: Anna verliest toegang, kan opnieuw aansluiten (ook vanop een andere "laptop").
    const spelers = laatste<LiveSpeler[]>((cb) => host.volgSpelers(s.id, cb));
    await Promise.resolve();
    const annaId = spelers.waarde()!.find((p) => p.naam === 'Anna')!.id;
    await host.ontkoppel(annaId);
    expect(await anna.mijnSpeler(s.id)).toBeNull();
    const annaSessie = laatste<LiveSessie | null>((cb) => anna.volgSessie(s.id, cb));
    await Promise.resolve();
    expect(annaSessie.waarde()).toBeNull();
    await anna.deelnemen(s.code, 'Anna');
    expect((await anna.mijnSpeler(s.id))?.id).toBe(annaId);

    await host.verwijderSessie(s.id);
    expect(await anna.sessieInfo(s.code)).toBeNull();
    expect(bertSessie.waarde()).toBeNull();
  });
});
