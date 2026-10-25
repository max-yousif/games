import { juistAntwoord } from '../lib/questions';
import type { Beurt, Leerling, Sessie, Vraag } from '../lib/types';
import { gatenVan, getalJuist, isKeuzeVraag, keuzeOpties, koppelenRechts, leesGetal, LETTERS, ordenenGetoond, tekstMetGaten } from '../lib/vraagtypes';
import type { Beoordeling, LiveAntwoord, LiveSpeler, Oplossing, PubliekeVraag, StandRij } from './types';

export function publiekeVraag(v: Vraag): PubliekeVraag {
  return {
    tekst: v.type === 'invullen' ? tekstMetGaten(v.tekst) : v.tekst,
    type: v.type,
    opties: isKeuzeVraag(v) ? keuzeOpties(v) : v.type === 'ordenen' ? ordenenGetoond(v) : [],
    links: v.type === 'koppelen' ? (v.paren ?? []).map((p) => p[0]) : [],
    rechts: v.type === 'koppelen' ? koppelenRechts(v) : [],
    gaten: v.type === 'invullen' ? gatenVan(v.tekst).length : 0,
    alsCode: v.alsCode ?? false,
    punten: v.punten,
    categorie: v.categorie,
  };
}

export function oplossingVan(v: Vraag): Oplossing {
  return { juisteOptie: isKeuzeVraag(v) ? v.juisteOptie : null, antwoord: juistAntwoord(v), uitleg: v.uitleg };
}

/** Een antwoord dat als JSON-lijst verstuurd wordt (invullen, ordenen, koppelen). */
export function lijstUit(antwoord: string): string[] {
  try {
    const l: unknown = JSON.parse(antwoord);
    return Array.isArray(l) ? l.map((x) => String(x ?? '')) : [];
  } catch {
    return [];
  }
}

/** Het antwoord van een leerling leesbaar gemaakt (voor het bord en het eigen scherm). */
export function antwoordWeergave(v: PubliekeVraag, antwoord: string): string {
  switch (v.type) {
    case 'meerkeuze':
    case 'waaronwaar': {
      const i = Number(antwoord);
      return `${LETTERS[i] ?? '?'}: ${v.opties[i] ?? ''}`;
    }
    case 'invullen':
      return lijstUit(antwoord)
        .map((a, i) => `(${i + 1}) ${a || '…'}`)
        .join('   ');
    case 'ordenen': {
      const gebruikt = new Set<number>();
      return lijstUit(antwoord)
        .map((item) => {
          const i = v.opties.findIndex((o, j) => o === item && !gebruikt.has(j));
          gebruikt.add(i);
          return LETTERS[i] ?? '?';
        })
        .join(' – ');
    }
    case 'koppelen':
      return lijstUit(antwoord)
        .map((r, i) => `${i + 1}→${LETTERS[v.rechts.indexOf(r)] ?? '?'}`)
        .join('  ');
    default:
      return antwoord;
  }
}

/**
 * Maakt een antwoord vergelijkbaar: zonder LaTeX-dollartekens en backticks, spaties,
 * hoofdletters, en met een punt als decimaal teken. "x = 7" en "$x=7$" worden dus gelijk.
 */
export function normaliseer(antwoord: string): string {
  return antwoord
    .replace(/\\[,;!: ]/g, '')
    .replace(/[$`]/g, '')
    .replace(/\\(dfrac|tfrac)/g, '\\frac')
    .replace(/\{,\}/g, ',')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('nl');
}

/** Automatische beoordeling: meerkeuze exact, open vraag als het genormaliseerde antwoord overeenkomt. */
/** Vergelijkt een getypt antwoord met het verwachte: als tekst (genormaliseerd) of als getal. */
function tekstJuist(antwoord: string, verwacht: string): boolean {
  const doel = normaliseer(verwacht);
  if (doel === '') return false;
  const a = normaliseer(antwoord);
  // "x=7" en "7" tellen allebei als juist.
  const zonderVar = (t: string) => t.replace(/^[a-z]=/, '');
  if (a === doel || zonderVar(a) === zonderVar(doel)) return true;
  return leesGetal(verwacht) !== null && getalJuist(antwoord, verwacht);
}

/** Codelijnen vergelijken: inspringing telt, spaties achteraan niet. */
const lijn = (t: string) => t.replace(/\s+$/, '');

export function automatischJuist(v: Vraag, antwoord: string): boolean {
  switch (v.type) {
    case 'meerkeuze':
    case 'waaronwaar':
      return antwoord === String(v.juisteOptie);
    case 'getal':
      return getalJuist(antwoord, v.antwoord, v.tolerantie ?? 0);
    case 'invullen': {
      const gaten = gatenVan(v.tekst);
      const ingevuld = lijstUit(antwoord);
      return gaten.length > 0 && gaten.every((alternatieven, i) => alternatieven.some((alt) => tekstJuist(ingevuld[i] ?? '', alt)));
    }
    case 'ordenen': {
      const l = lijstUit(antwoord);
      return l.length === v.opties.length && l.every((x, i) => lijn(x) === lijn(v.opties[i]));
    }
    case 'koppelen': {
      const l = lijstUit(antwoord);
      const paren = v.paren ?? [];
      return l.length === paren.length && paren.every(([, r], i) => l[i] === r);
    }
    default:
      return tekstJuist(antwoord, v.antwoord);
  }
}

/**
 * Punten voor een juist antwoord. Met snelheidsbonus en timer: van 100 % (meteen) tot 50 %
 * (op het einde van de tijd) van de punten van de vraag.
 */
export function puntenVoor(v: Vraag, juist: boolean, tijdMs: number, timer: number | null, snelheidsbonus: boolean): number {
  if (!juist) return 0;
  if (!snelheidsbonus || !timer) return v.punten;
  const deel = Math.min(Math.max(tijdMs / (timer * 1000), 0), 1);
  return Math.round(v.punten * (1 - deel / 2));
}

/** Beoordelingen voor alle nog niet beoordeelde antwoorden op een vraag. */
export function automatischeBeoordelingen(
  v: Vraag,
  antwoorden: readonly LiveAntwoord[],
  vraagNr: number,
  timer: number | null,
  snelheidsbonus: boolean,
): Beoordeling[] {
  return antwoorden
    .filter((a) => a.vraagNr === vraagNr && a.juist === null)
    .map((a) => {
      const juist = automatischJuist(v, a.antwoord);
      return { id: a.id, juist, punten: puntenVoor(v, juist, a.tijdMs, timer, snelheidsbonus) };
    });
}

/** Tussenstand van alle spelers (ook wie nog niets beantwoordde), hoogste eerst. */
export function berekenStand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): StandRij[] {
  return spelers
    .map((s) => {
      const eigen = antwoorden.filter((a) => a.spelerId === s.id);
      return { naam: s.naam, punten: eigen.reduce((t, a) => t + a.punten, 0), juist: eigen.filter((a) => a.juist).length };
    })
    .sort((a, b) => b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'));
}

/** Plaats in de stand (1 = eerste); gelijke punten delen dezelfde plaats. */
export function plaatsVan(stand: readonly StandRij[], naam: string): number | null {
  const rij = stand.find((r) => r.naam === naam);
  if (!rij) return null;
  return stand.filter((r) => r.punten > rij.punten).length + 1;
}

export interface AntwoordGroep {
  /** Genormaliseerde sleutel. */
  sleutel: string;
  /** Zoals de eerste leerling het typte. */
  tekst: string;
  antwoorden: LiveAntwoord[];
  juist: boolean | null;
}

/** Groepeert open antwoorden die (genormaliseerd) gelijk zijn, meest gegeven eerst. */
export function groepeerAntwoorden(antwoorden: readonly LiveAntwoord[]): AntwoordGroep[] {
  const groepen = new Map<string, AntwoordGroep>();
  for (const a of antwoorden) {
    const sleutel = normaliseer(a.antwoord);
    const g = groepen.get(sleutel);
    if (g) g.antwoorden.push(a);
    else groepen.set(sleutel, { sleutel, tekst: a.antwoord, antwoorden: [a], juist: a.juist });
  }
  return [...groepen.values()].sort((a, b) => b.antwoorden.length - a.antwoorden.length);
}

/**
 * Zet de live antwoorden om naar beurten van de lokale sessie, zodat resultaten en
 * Excel-export werken zoals bij de klassikale spellen. Spelers die niet op de klaslijst
 * staan (vrije naam) worden aan het team toegevoegd.
 */
export function synchroniseer(sessie: Sessie, spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[], volgorde: readonly string[]): Sessie {
  const team = sessie.teams[0];
  const leerlingen: Leerling[] = [...team.leerlingen];
  const idVan = new Map<string, string>();
  for (const s of spelers) {
    let l = leerlingen.find((x) => x.naam === s.naam);
    if (!l) {
      l = { id: s.id, naam: s.naam };
      leerlingen.push(l);
    }
    idVan.set(s.id, l.id);
  }
  const beurten: Beurt[] = antwoorden
    .filter((a) => a.juist !== null && idVan.has(a.spelerId) && volgorde[a.vraagNr])
    .sort((a, b) => a.vraagNr - b.vraagNr || a.tijdMs - b.tijdMs)
    .map((a) => ({ vraagId: volgorde[a.vraagNr], team: 0, leerlingId: idVan.get(a.spelerId)!, juist: a.juist!, punten: a.punten, tijd: sessie.gestart }));
  return { ...sessie, teams: [{ ...team, leerlingen }, ...sessie.teams.slice(1)], beurten };
}
