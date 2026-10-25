import { newId, nu } from './ids';
import type { Vraag, Vragenset } from './types';

export function nieuweVraag(vorige?: Vraag): Vraag {
  return {
    id: newId(),
    categorie: vorige?.categorie ?? '',
    punten: vorige ? Math.min(vorige.punten + 100, 500) : 100,
    type: 'open',
    tekst: '',
    antwoord: '',
    opties: ['', '', '', ''],
    juisteOptie: 0,
    uitleg: '',
  };
}

export function nieuweSet(): Vragenset {
  return {
    id: newId(),
    titel: 'Nieuwe vragenset',
    beschrijving: '',
    vak: 'wiskunde',
    leerjaar: '',
    vragen: [nieuweVraag()],
    aangemaakt: nu(),
    gewijzigd: nu(),
  };
}

export function dupliceerSet(set: Vragenset): Vragenset {
  return {
    ...set,
    id: newId(),
    titel: `${set.titel} (kopie)`,
    voorbeeld: undefined,
    vragen: set.vragen.map((v) => ({ ...v, id: newId(), opties: [...v.opties] })),
    aangemaakt: nu(),
    gewijzigd: nu(),
  };
}

/** Het juiste antwoord als tekst (optie bij meerkeuze). */
export function juistAntwoord(v: Vraag): string {
  return v.type === 'meerkeuze' ? (v.opties[v.juisteOptie] ?? '') : v.antwoord;
}

/** Problemen die verhinderen dat een vraag gespeeld kan worden. */
export function vraagProblemen(v: Vraag): string[] {
  const p: string[] = [];
  if (!v.tekst.trim()) p.push('De vraag is leeg.');
  if (v.type === 'open' && !v.antwoord.trim()) p.push('Er is geen antwoord ingevuld.');
  if (v.type === 'meerkeuze') {
    if (v.opties.filter((o) => o.trim()).length < 2) p.push('Geef minstens twee opties.');
    if (!v.opties[v.juisteOptie]?.trim()) p.push('De juiste optie is leeg.');
  }
  return p;
}

/** Vragen die klaar zijn om te spelen; lege opties worden weggelaten. */
export function speelbareVragen(set: Vragenset): Vraag[] {
  return set.vragen
    .filter((v) => vraagProblemen(v).length === 0)
    .map((v) => {
      if (v.type !== 'meerkeuze') return v;
      const juist = v.opties[v.juisteOptie];
      const opties = v.opties.filter((o) => o.trim());
      return { ...v, opties, juisteOptie: opties.indexOf(juist) };
    });
}

export interface BordKolom {
  categorie: string;
  vragen: Vraag[];
}

/** Quizbord: één kolom per categorie (in volgorde van voorkomen), vragen gesorteerd op punten. */
export function bordIndeling(vragen: readonly Vraag[]): BordKolom[] {
  const kolommen = new Map<string, Vraag[]>();
  for (const v of vragen) {
    const cat = v.categorie.trim() || 'Varia';
    kolommen.set(cat, [...(kolommen.get(cat) ?? []), v]);
  }
  return [...kolommen].map(([categorie, vs]) => ({
    categorie,
    vragen: [...vs].sort((a, b) => a.punten - b.punten),
  }));
}
