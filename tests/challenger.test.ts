import { describe, expect, it } from 'vitest';
import { beginToestand, BONUS, gebruikHulp, inDeKlas, kanHulp, nieuweBeurt, nummer, peiling, uitNummer, verwerkVraag, type VraagInvoer } from '../src/live/challenger';

const spelers = ['cas', 'an', 'bo', 'dirk'];
const namen = { cas: 'Cas', an: 'An', bo: 'Bo', dirk: 'Dirk' };
const start = () => nieuweBeurt(beginToestand(), 'cas', { harten: 3 });
const invoer = (juist: Record<string, boolean>, challenger: boolean[], extra: Partial<VraagInvoer> = {}): VraagInvoer => ({ spelers, juist, challenger, inzet: false, tweedeKans: false, namen, ...extra });

describe('challenger', () => {
  it('vraagnummers per fase', () => {
    expect(nummer(4, 'klas')).toBe(12);
    expect(nummer(4, 'tweede')).toBe(14);
    expect(uitNummer(13)).toEqual({ q: 4, fase: 'challenger' });
  });

  it('challenger juist: wie fout of niets antwoordde vliegt eruit, punten per uitgeschakelde', () => {
    const { toestand: t, uitslag } = verwerkVraag(start(), invoer({ an: true, bo: false }, [true]), { perBeurt: 0 });
    expect(uitslag.getOut.sort()).toEqual(['bo', 'dirk']);
    expect(uitslag.punten).toEqual({ an: 1, cas: 2 });
    expect(inDeKlas(t, spelers)).toEqual(['an']);
    expect(uitslag.tekst).toContain('GET OUT, Bo en Dirk!');
    expect(t.harten).toBe(3);
  });

  it('challenger fout: een hart minder, niemand eruit; met inzet twee harten en dubbele punten bij juist', () => {
    let r = verwerkVraag(start(), invoer({ an: true }, [false]), { perBeurt: 0 });
    expect(r.uitslag.getOut).toEqual([]);
    expect(r.toestand.harten).toBe(2);
    r = verwerkVraag(start(), invoer({ an: true }, [false], { inzet: true }), { perBeurt: 0 });
    expect(r.toestand.harten).toBe(1);
    expect(r.toestand.inzetGebruikt).toBe(true);
    r = verwerkVraag(start(), invoer({ an: true, bo: true }, [true], { inzet: true }), { perBeurt: 0 });
    expect(r.uitslag.punten.cas).toBe(2);
  });

  it('tweede kans: het tweede antwoord telt; beide fout = alle harten weg', () => {
    let r = verwerkVraag(start(), invoer({ an: true }, [false, true], { tweedeKans: true }), { perBeurt: 0 });
    expect(r.uitslag.challengerJuist).toBe(true);
    r = verwerkVraag(start(), invoer({ an: true }, [false, false], { tweedeKans: true }), { perBeurt: 0 });
    expect(r.toestand.harten).toBe(0);
    expect(r.uitslag.einde).toBe('harten');
  });

  it('Comeback Zone: twee keer na elkaar juist = terug in de klas', () => {
    let t = verwerkVraag(start(), invoer({ an: true, bo: true }, [true]), { perBeurt: 0 }).toestand; // dirk eruit
    expect(t.zone).toEqual({ dirk: 0 });
    t = verwerkVraag(t, invoer({ an: true, bo: true, dirk: true }, [false]), { perBeurt: 0 }).toestand;
    expect(t.zone).toEqual({ dirk: 1 });
    t = verwerkVraag(t, invoer({ an: true, bo: true, dirk: false }, [false]), { perBeurt: 0 }).toestand;
    expect(t.zone).toEqual({ dirk: 0 });
    t = verwerkVraag(t, invoer({ an: true, bo: true, dirk: true }, [true]), { perBeurt: 0 }).toestand;
    const r = verwerkVraag({ ...t, harten: 3 }, invoer({ an: true, bo: true, dirk: true }, [true]), { perBeurt: 0 });
    expect(r.uitslag.comeback).toEqual(['dirk']);
    expect(r.toestand.zone).toEqual({});
    expect(r.uitslag.tekst).toContain('COMEBACK voor Dirk!');
  });

  it('einde van de beurt: iedereen eruit (bonus challenger), harten op (bonus klas), of genoeg vragen', () => {
    let r = verwerkVraag(start(), invoer({}, [true]), { perBeurt: 0 });
    expect(r.uitslag.einde).toBe('gewonnen');
    expect(r.uitslag.punten.cas).toBe(3 + BONUS);
    r = verwerkVraag({ ...start(), harten: 1 }, invoer({ an: true }, [false]), { perBeurt: 0 });
    expect(r.uitslag.einde).toBe('harten');
    expect(r.uitslag.punten).toEqual({ an: 1 + BONUS, bo: BONUS, dirk: BONUS });
    expect(r.toestand.klasZeges).toBe(1);
    r = verwerkVraag({ ...start(), vragen: 4 }, invoer({ an: true, bo: true, dirk: true }, [true]), { perBeurt: 5 });
    expect(r.uitslag.einde).toBe('ronde');
  });

  it('nieuwe beurt: iedereen terug in de klas; hulplijnen blijven één keer per spel', () => {
    let t = verwerkVraag(start(), invoer({ an: true }, [true]), { perBeurt: 0 }).toestand;
    t = gebruikHulp(t, 'cas', 'peiling');
    t = nieuweBeurt(t, 'an', { harten: 2 });
    expect(t.zone).toEqual({});
    expect(t.harten).toBe(2);
    expect(kanHulp(t, 'cas', 'peiling')).toBe(false);
    expect(kanHulp(t, 'an', 'peiling')).toBe(true);
    expect(t.score.cas).toBe(2);
    expect(t.meesteKnockouts).toEqual({ id: 'cas', aantal: 2 });
  });

  it('wat denkt de klas: procenten per antwoord', () => {
    expect(peiling([{ antwoord: '0' }, { antwoord: '1' }, { antwoord: '1' }, { antwoord: '1' }], (a) => 'ABC'[Number(a)])).toEqual([
      { tekst: 'B', procent: 75 },
      { tekst: 'A', procent: 25 },
    ]);
  });
});
