import { describe, expect, it } from 'vitest';
import { parseNamen } from '../src/lib/students';

describe('parseNamen', () => {
  it('leest één naam per lijn en voegt kolommen samen', () => {
    expect(parseNamen('Voornaam\tAchternaam\nAnna\tPeeters\n\nBert  Claes \n')).toEqual(['Anna Peeters', 'Bert Claes']);
  });
  it('houdt een lijst zonder titelrij volledig', () => {
    expect(parseNamen('Anna\nBert')).toEqual(['Anna', 'Bert']);
  });
});

import { korteNamen, naamKandidaten, plakNaarRijen, raadKlaslijst, roepnaam } from '../src/lib/students';

describe('klaslijst importeren', () => {
  it('slaat titels en klasnummers over', () => {
    const tekst = 'Klaslijst 3A\nSchooljaar 2026-2027\n1. Anna Peeters\n2. Bert Claes\n3A\n3) Chloé Janssens';
    const rijen = plakNaarRijen(tekst);
    const k = naamKandidaten(rijen, raadKlaslijst(rijen));
    expect(k.filter((x) => x.aan).map((x) => x.naam)).toEqual(['Anna Peeters', 'Bert Claes', 'Chloé Janssens']);
    expect(k.filter((x) => !x.aan).map((x) => x.reden)).toEqual(['lijkt een titel', 'lijkt een titel', 'lijkt een klasnaam']);
  });

  it('export met kolommen: klasnummer, naam, voornaam, klas', () => {
    const rijen = plakNaarRijen('Klasnummer\tNaam\tVoornaam\tKlas\n1\tPeeters\tAnna\t3A\n2\tClaes\tBert\t3A');
    const keuze = raadKlaslijst(rijen);
    expect(keuze).toEqual({ kopRij: 0, naamKolommen: [1, 2], volgorde: 'achternaam' });
    expect(naamKandidaten(rijen, keuze).map((x) => x.naam)).toEqual(['Peeters Anna', 'Claes Bert']);
  });

  it('zonder titelrij: nummers en klas als kolom worden genegeerd', () => {
    const rijen = plakNaarRijen('1\tAnna\tPeeters\t3A\n2\tBert\tClaes\t3A\n3\tDries\tMertens\t3A');
    expect(raadKlaslijst(rijen)).toEqual({ kopRij: -1, naamKolommen: [1, 2] });
  });

  it('titellijn boven de kolomtitels', () => {
    const rijen = plakNaarRijen('Klaslijst 3A - schooljaar 2026-2027\nKlasnummer\tNaam\tVoornaam\tKlas\n1\tPeeters\tAnna\t3A');
    const keuze = raadKlaslijst(rijen);
    expect(keuze).toEqual({ kopRij: 1, naamKolommen: [1, 2], volgorde: 'achternaam' });
    expect(naamKandidaten(rijen, keuze)).toEqual([{ naam: 'Peeters Anna', aan: true }]);
  });

  it('herkent leerlingen die al in de klas staan en dubbels', () => {
    const rijen = plakNaarRijen('Anna Peeters\nBert Claes\nBert Claes');
    const k = naamKandidaten(rijen, raadKlaslijst(rijen), ['anna peeters']);
    expect(k.map((x) => x.reden)).toEqual(['staat al in de klas', undefined, 'dubbel']);
  });
});

describe('korte namen', () => {
  it('voornaam volgens de naamvolgorde', () => {
    expect(roepnaam('Anna Peeters')).toBe('Anna');
    expect(roepnaam('Van den Broeck Anna', 'achternaam')).toBe('Anna');
  });
  it('zelfde voornaam: eerste letter van de achternaam erbij', () => {
    expect(korteNamen(['Peeters Anna', 'Van den Broeck Anna', 'Claes Bert'], 'achternaam')).toEqual(['Anna P.', 'Anna B.', 'Bert']);
    expect(korteNamen(['Anna Peeters', 'Anna Claes'])).toEqual(['Anna P.', 'Anna C.']);
  });
});
