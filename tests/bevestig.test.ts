import { describe, expect, it } from 'vitest';
import { beantwoord, bevestig, huidigeVraag, luisterNaarVragen } from '../src/lib/bevestig';

describe('bevestig', () => {
  it('geeft het antwoord terug en toont daarna niets meer', async () => {
    const p = bevestig('Verwijderen?', { ja: 'Verwijderen', gevaarlijk: true });
    expect(huidigeVraag()).toMatchObject({ tekst: 'Verwijderen?', ja: 'Verwijderen', gevaarlijk: true });
    beantwoord(true);
    expect(await p).toBe(true);
    expect(huidigeVraag()).toBeUndefined();
  });

  it('standaard: knop OK, niet gevaarlijk; annuleren geeft false', async () => {
    const p = bevestig('Stoppen?');
    expect(huidigeVraag()).toMatchObject({ ja: 'OK', gevaarlijk: false });
    beantwoord(false);
    expect(await p).toBe(false);
  });

  it('toont vragen die tegelijk komen na elkaar', async () => {
    const a = bevestig('A?');
    const b = bevestig('B?');
    expect(huidigeVraag()?.tekst).toBe('A?');
    beantwoord(false);
    expect(huidigeVraag()?.tekst).toBe('B?');
    beantwoord(true);
    expect([await a, await b]).toEqual([false, true]);
  });

  it('verwittigt luisteraars en negeert een antwoord zonder vraag', () => {
    let keer = 0;
    const stop = luisterNaarVragen(() => keer++);
    void bevestig('C?');
    beantwoord(true);
    beantwoord(true);
    stop();
    void bevestig('D?');
    expect(keer).toBe(2);
    beantwoord(false);
  });
});
