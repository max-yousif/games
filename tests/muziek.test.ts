import { describe, expect, it } from 'vitest';
import { maakArrangement, maakMotief, varieer } from '../src/lib/muziek';

/** Voorspelbare "willekeur" voor de tests. */
function zaad(n: number) {
  let x = n;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

describe('muziekgenerator', () => {
  it('elke ronde heeft een intro, couplet, refreinen, een break met opbouw en een solo', () => {
    for (let i = 1; i < 20; i++) {
      const delen = maakArrangement(zaad(i));
      expect(delen[0].soort).toBe('intro');
      const soorten = delen.map((d) => d.soort);
      for (const s of ['couplet', 'refrein', 'pauze', 'opbouw', 'solo'] as const) expect(soorten).toContain(s);
      expect(soorten.filter((s) => s === 'refrein').length).toBeGreaterThanOrEqual(3);
      // De opbouw komt altijd net voor een refrein.
      expect(soorten[soorten.indexOf('opbouw') + 1]).toBe('refrein');
    }
    // Niet altijd dezelfde volgorde.
    const volgordes = new Set(Array.from({ length: 20 }, (_, i) => maakArrangement(zaad(i + 1)).map((d) => d.soort).join()));
    expect(volgordes.size).toBeGreaterThan(1);
  });

  it('een motief: 2 maten, vraag en antwoord met hetzelfde ritme, eindigt op de grondtoon', () => {
    for (let i = 1; i < 30; i++) {
      const m = maakMotief(zaad(i), 0.5);
      expect(m.every((n) => n.start >= 0 && n.start < 32 && n.duur >= 1 && n.duur <= 4)).toBe(true);
      const vraag = m.filter((n) => n.start < 16).map((n) => n.start);
      const antwoord = m.filter((n) => n.start >= 16).map((n) => n.start - 16);
      expect(antwoord).toEqual(vraag);
      expect([0, 7]).toContain(m.at(-1)!.trap);
      // Sterke tellen in de vraag vallen op een akkoordtoon.
      for (const n of m.filter((x) => x.start < 12 && x.start % 4 === 0)) expect([0, 2, 4, 7, 9]).toContain(n.trap);
    }
  });

  it('motieven verschillen van elkaar; meer dichtheid geeft meer noten', () => {
    const r = zaad(7);
    const motieven = Array.from({ length: 10 }, () => JSON.stringify(maakMotief(r, 0.5)));
    expect(new Set(motieven).size).toBeGreaterThan(8);
    const tel = (d: number) => Array.from({ length: 30 }, (_, i) => maakMotief(zaad(i + 1), d).length).reduce((a, b) => a + b, 0);
    expect(tel(0.8)).toBeGreaterThan(tel(0.2));
    const m = maakMotief(zaad(3), 0.6);
    expect(varieer(zaad(5), m).map((n) => n.start)).toEqual(m.map((n) => n.start));
  });
});
