import { nieuweSessie } from '../src/lib/session';
import type { Sessie, SpelType, Team, Vraag, Vragenset } from '../src/lib/types';

export function vraag(id: string, categorie = 'A', punten = 100): Vraag {
  return { id, categorie, punten, type: 'open', tekst: `Vraag ${id}`, antwoord: 'x', opties: [], juisteOptie: 0, uitleg: '' };
}

export function teams(): Team[] {
  return [
    { naam: 'Team Blauw', kleur: '#00f', leerlingen: [{ id: 'a', naam: 'Anna' }, { id: 'b', naam: 'Bert' }] },
    { naam: 'Team Rood', kleur: '#f00', leerlingen: [{ id: 'c', naam: 'Chloé' }] },
  ];
}

export function sessie(vragen: Vraag[], spelType: SpelType = 'quizbord'): Sessie {
  const set: Vragenset = { id: 's', titel: 'Test', beschrijving: '', vak: 'wiskunde', leerjaar: '', vragen, aangemaakt: '', gewijzigd: '' };
  return nieuweSessie({ spelType, set, vragen, klasNaam: '3A', teams: teams(), timer: null });
}
