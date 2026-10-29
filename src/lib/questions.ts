import { newId, nu } from './ids';
import type { Vak, Vraag, Vragenset } from './types';
import { gatenVan, gatLabel, WAAR_ONWAAR } from './vraagtypes';

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
    tolerantie: 0,
    paren: [
      ['', ''],
      ['', ''],
      ['', ''],
    ],
    alsCode: false,
    uitleg: '',
  };
}

/** Kopie van een vraag met een nieuw id (lijsten worden mee gekopieerd). */
export function kopieVraag(v: Vraag): Vraag {
  return { ...v, id: newId(), opties: [...v.opties], alternatieven: v.alternatieven && [...v.alternatieven], paren: v.paren?.map((p) => [...p] as [string, string]) };
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
    statistiek: undefined,
    vragen: set.vragen.map(kopieVraag),
    aangemaakt: nu(),
    gewijzigd: nu(),
  };
}

/** Het juiste antwoord als tekst (met opmaak voor RichText). */
export function juistAntwoord(v: Vraag): string {
  switch (v.type) {
    case 'meerkeuze':
      return v.opties[v.juisteOptie] ?? '';
    case 'waaronwaar':
      return WAAR_ONWAAR[v.juisteOptie] ?? '';
    case 'getal':
      return v.tolerantie ? `${v.antwoord} (± ${String(v.tolerantie).replace('.', ',')})` : v.antwoord;
    case 'invullen':
      return gatenVan(v.tekst)
        .map((g, i) => `${gatLabel(i)} ${g[0] ?? ''}`)
        .join('\n');
    case 'ordenen':
      return v.alsCode ? `\`\`\`\n${v.opties.join('\n')}\n\`\`\`` : v.opties.map((o, i) => `${i + 1}. ${o}`).join('\n');
    case 'koppelen':
      return (v.paren ?? []).map(([l, r]) => `${l}  →  ${r}`).join('\n');
    default:
      // Enkel het eerste antwoord; andere schrijfwijzen ("ook juist") tellen mee bij het nakijken.
      return juisteAntwoorden(v)[0] ?? '';
  }
}

/** Open vraag: het antwoord en de andere antwoorden die ook juist zijn (zonder lege). */
export function juisteAntwoorden(v: Vraag): string[] {
  return [v.antwoord, ...(v.alternatieven ?? [])].filter((a) => a.trim());
}

/** Problemen die verhinderen dat een vraag gespeeld kan worden. */
export function vraagProblemen(v: Vraag): string[] {
  const p: string[] = [];
  if (!v.tekst.trim()) p.push('De vraag is leeg.');
  switch (v.type) {
    case 'open':
      if (!v.antwoord.trim()) p.push('Er is geen antwoord ingevuld.');
      break;
    case 'getal':
      if (!/\d/.test(v.antwoord)) p.push('Vul het juiste getal in.');
      break;
    case 'meerkeuze':
      if (v.opties.filter((o) => o.trim()).length < 2) p.push('Geef minstens twee opties.');
      if (!v.opties[v.juisteOptie]?.trim()) p.push('De juiste optie is leeg.');
      break;
    case 'invullen': {
      const gaten = gatenVan(v.tekst);
      if (gaten.length === 0) p.push('Zet minstens één antwoord tussen [[ en ]].');
      if (gaten.some((g) => g.length === 0)) p.push('Er is een leeg gat [[ ]].');
      break;
    }
    case 'ordenen':
      if (v.opties.filter((o) => o.trim()).length < 2) p.push('Geef minstens twee items om te ordenen.');
      break;
    case 'koppelen': {
      const volledig = (v.paren ?? []).filter(([l, r]) => l.trim() && r.trim());
      if (volledig.length < 2) p.push('Geef minstens twee volledige paren.');
      if ((v.paren ?? []).some(([l, r]) => (l.trim() === '') !== (r.trim() === ''))) p.push('Er is een paar met maar één kant.');
      break;
    }
  }
  return p;
}

/** Vragen die klaar zijn om te spelen; lege opties, items en paren worden weggelaten. */
export function speelbareVragen(set: Vragenset): Vraag[] {
  return set.vragen
    .filter((v) => vraagProblemen(v).length === 0)
    .map((v) => {
      if (v.type === 'meerkeuze') {
        const juist = v.opties[v.juisteOptie];
        const opties = v.opties.filter((o) => o.trim());
        return { ...v, opties, juisteOptie: opties.indexOf(juist) };
      }
      if (v.type === 'ordenen') return { ...v, opties: v.opties.filter((o) => o.trim()) };
      if (v.type === 'koppelen') return { ...v, paren: (v.paren ?? []).filter(([l, r]) => l.trim() && r.trim()) };
      if (v.type === 'open' && v.alternatieven) return { ...v, alternatieven: v.alternatieven.filter((a) => a.trim()) };
      return v;
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

/** Alle vakken van een vragenset (oudere sets: enkel het ene vak). */
export const vakkenVan = (s: Pick<Vragenset, 'vak' | 'vakken'>): Vak[] => (s.vakken?.length ? s.vakken : [s.vak]);
