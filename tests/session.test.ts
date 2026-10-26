import { describe, expect, it } from 'vitest';
import { ongedaanMaken } from '../src/pages/SessiePage';
import { wachtOpZet } from '../src/games/VierOpEenRij';
import { aantalBeurten, kiesLeerling, maakTeams, resultatenPerLeerling, teamAanDeBeurt, teamScores, voegBeurtToe, volgendeVraag } from '../src/lib/session';
import { sessie, vraag } from './helpers';

describe('maakTeams', () => {
  it('verdeelt iedereen over gelijke teams', () => {
    const leerlingen = Array.from({ length: 7 }, (_, i) => ({ id: String(i), naam: `L${i}` }));
    const t = maakTeams(leerlingen, 3);
    expect(t.map((x) => x.leerlingen.length).sort()).toEqual([2, 2, 3]);
    expect(t.flatMap((x) => x.leerlingen.map((l) => l.id)).sort()).toEqual(leerlingen.map((l) => l.id).sort());
  });
});

describe('beurten en scores', () => {
  it('wisselt van team en telt punten', () => {
    let s = sessie([vraag('1'), vraag('2', 'A', 200)]);
    expect(teamAanDeBeurt(s)).toBe(0);
    s = voegBeurtToe(s, { vraagId: '1', team: 0, leerlingId: 'a', juist: true, punten: 100 });
    expect(teamAanDeBeurt(s)).toBe(1);
    s = voegBeurtToe(s, { vraagId: '2', team: 1, leerlingId: null, juist: false, punten: 0 });
    expect(teamScores(s)).toEqual([100, 0]);
    const r = resultatenPerLeerling(s);
    expect(r.find((x) => x.naam === 'Anna')).toMatchObject({ beurten: 1, juist: 1, punten: 100 });
    expect(r.find((x) => x.naam === 'Bert')).toMatchObject({ beurten: 0 });
    expect(r.find((x) => x.naam === '(hele team)' && x.team === 'Team Rood')).toMatchObject({ beurten: 1, fout: 1 });
  });

  it('kiest bij voorkeur een leerling die nog geen beurt had', () => {
    let s = sessie([vraag('1')]);
    s = voegBeurtToe(s, { vraagId: '1', team: 0, leerlingId: 'a', juist: true, punten: 100 });
    for (let i = 0; i < 20; i++) expect(kiesLeerling(s, 0)?.id).toBe('b');
    expect(aantalBeurten(s, 'a')).toBe(1);
  });
});

describe('volgendeVraag', () => {
  it('trekt eerst alle vragen één keer en begint daarna opnieuw', () => {
    let s = sessie([vraag('1'), vraag('2'), vraag('3')], 'vieropeenrij');
    const gezien: string[] = [];
    for (let i = 0; i < 3; i++) {
      const v = volgendeVraag(s)!;
      gezien.push(v.id);
      s = voegBeurtToe(s, { vraagId: v.id, team: 0, leerlingId: null, juist: false, punten: 0 });
    }
    expect(gezien.sort()).toEqual(['1', '2', '3']);
    expect(volgendeVraag(s)?.id).toBe(s.vraagVolgorde[0]);
  });
});

describe('vier op een rij: zetten en ongedaan maken', () => {
  it('wacht op een zet na een juist antwoord en maakt eerst de zet ongedaan', () => {
    let s = sessie([vraag('1'), vraag('2')], 'vieropeenrij');
    s = voegBeurtToe(s, { vraagId: '1', team: 0, leerlingId: 'a', juist: true, punten: 1 });
    expect(wachtOpZet(s)).toBe(0);
    s = { ...s, zetten: [{ team: 0, kolom: 3 }] };
    expect(wachtOpZet(s)).toBeNull();
    expect(teamAanDeBeurt(s)).toBe(1);

    const terug = ongedaanMaken(s);
    expect(terug.zetten).toEqual([]);
    expect(terug.beurten).toHaveLength(1);
    expect(ongedaanMaken(terug).beurten).toHaveLength(0);
  });

  it('wacht niet op een zet na een fout antwoord', () => {
    let s = sessie([vraag('1')], 'vieropeenrij');
    s = voegBeurtToe(s, { vraagId: '1', team: 0, leerlingId: null, juist: false, punten: 0 });
    expect(wachtOpZet(s)).toBeNull();
  });
});

import { maakGroepjes as groepjes } from '../src/lib/session';
import { raadNaamVolgorde } from '../src/lib/students';

describe('groepjes en naamvolgorde', () => {
  const ll = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), naam: `L${i}` }));
  it('per 2 en per 3', () => {
    expect(groepjes(ll(7), 2).map((g) => g.leerlingen.length).sort()).toEqual([2, 2, 3]);
    expect(groepjes(ll(7), 3).map((g) => g.leerlingen.length).sort()).toEqual([2, 2, 3]);
    expect(groepjes(ll(1), 2)).toHaveLength(1);
    expect(groepjes(ll(4), 2)[0].naam).toBe('Groepje 1');
  });
  it('raadt de naamvolgorde', () => {
    expect(raadNaamVolgorde(['Van den Broeck Anna', 'Peeters Bert'])).toBe('achternaam');
    expect(raadNaamVolgorde(['Anna Van den Broeck', 'Bert Peeters'])).toBe('voornaam');
    expect(raadNaamVolgorde(['Claes Bert', 'Janssens Anna', 'Peeters Dries', 'Wouters Chloé'], true)).toBe('achternaam');
    // Gesorteerd op het laatste woord: dat is de achternaam.
    expect(raadNaamVolgorde(['Bert Claes', 'Anna Janssens', 'Chloé Peeters', 'Dries Wouters'], true)).toBe('voornaam');
    expect(raadNaamVolgorde(['Anna Claes', 'Bert'])).toBeUndefined();
  });
});

import { aantalSpelers, telGespeeld } from '../src/lib/session';
import type { Sessie, Vragenset } from '../src/lib/types';

describe('statistiek per vragenset', () => {
  const set = { id: 's1', titel: 'S', beschrijving: '', vak: 'wiskunde', leerjaar: '', vragen: [], aangemaakt: '', gewijzigd: '' } as Vragenset;
  const sessie = (live: boolean, beurten: string[]): Sessie =>
    ({
      id: Math.random().toString(),
      spelType: live ? 'live' : 'quizbord',
      setId: 's1',
      teams: [{ naam: 'T', kleur: '', leerlingen: [{ id: 'a', naam: 'Anna' }, { id: 'b', naam: 'Bert' }, { id: 'c', naam: 'Chloé' }] }],
      beurten: beurten.map((id) => ({ vraagId: 'v', team: 0, leerlingId: id, juist: true, punten: 1, tijd: '' })),
      ...(live ? { live: {} } : {}),
    }) as unknown as Sessie;
  it('telt spelers: live wie antwoordde, klassikaal alle leerlingen in de teams', () => {
    expect(aantalSpelers(sessie(true, ['a', 'a', 'b']))).toBe(2);
    expect(aantalSpelers(sessie(false, ['a']))).toBe(3);
  });
  it('telt spellen en spelers op', () => {
    const [s] = telGespeeld([{ ...set, statistiek: { gespeeld: 2, spelers: 40 } }], [sessie(false, []), sessie(true, ['c'])]);
    expect(s.statistiek).toEqual({ gespeeld: 4, spelers: 44 });
  });
});
