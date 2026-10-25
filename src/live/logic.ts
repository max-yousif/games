import { juistAntwoord, juisteAntwoorden } from '../lib/questions';
import type { Beurt, Leerling, Sessie, Vraag } from '../lib/types';
import { gatenVan, gatLabel, getalJuist, isKeuzeVraag, keuzeOpties, koppelenRechts, leesGetal, LETTERS, ordenenGetoond, tekstMetGaten } from '../lib/vraagtypes';
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
        .map((a, i) => `${gatLabel(i)} ${a || '…'}`)
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
 * Maakt een antwoord vergelijkbaar: zonder LaTeX-dollartekens en backticks, spaties en
 * hoofdletters, met een punt als decimaal teken, en met één schrijfwijze voor breuken, machten,
 * wortels en vermenigvuldigen. Zo zijn "x = 7" en "$x=7$" gelijk, en ook "\\frac{1}{2}" (uit de
 * wiskunde-editor) en "1/2", "x^{2}" en "x²", "2\\cdot x" en "2x", "\\sqrt{9}" en "√9".
 */
export function normaliseer(antwoord: string): string {
  let t = antwoord
    .replace(/\\[,;!: ]/g, '')
    .replace(/[$`]/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\(dfrac|tfrac)/g, '\\frac')
    .replace(/\{,\}/g, ',')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\\(times|cdot)|[×·⋅]/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*([a-z0-9.]+)/gi, 'sqrt($1)');
  // Binnenste breuken, wortels en exponenten eerst (geneste accolades).
  for (let i = 0; i < 5; i++) {
    const vorige = t;
    t = t
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\^\{([^{}]*)\}/g, '^($1)');
    if (t === vorige) break;
  }
  t = t.replace(/[{}]/g, '').replace(/\s+/g, '').toLocaleLowerCase('nl');
  // Haakjes rond één getal of letter zijn overbodig: (1)/(2) = 1/2, x^(2) = x^2.
  for (let i = 0; i < 5; i++) {
    const vorige = t;
    t = t.replace(/\((-?[a-z0-9.]+)\)/g, (m, inhoud: string, pos: number) => (pos > 0 && /[a-z]/.test(t[pos - 1]) && !t.slice(0, pos).endsWith('sqrt') ? m : inhoud));
    if (t === vorige) break;
  }
  // Maalteken naast een letter of haakje weglaten: 2*x = 2x.
  return t.replace(/\*(?=[a-z(])/g, '').replace(/(?<=[a-z)])\*/g, '');
}

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
      return juisteAntwoorden(v).some((juist) => tekstJuist(antwoord, juist));
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

/** Naam zoals op het scherm: de bijnaam als die er is, anders de echte naam. */
export function schermNaam(s: Pick<LiveSpeler, 'naam'> & { bijnaam?: string | null }): string {
  return s.bijnaam || s.naam;
}

/** Tussenstand van alle spelers (ook wie nog niets beantwoordde), hoogste eerst. */
export function berekenStand(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): StandRij[] {
  return spelers
    .map((s) => {
      const eigen = antwoorden.filter((a) => a.spelerId === s.id);
      return { id: s.id, naam: schermNaam(s), punten: eigen.reduce((t, a) => t + a.punten, 0), juist: eigen.filter((a) => a.juist).length };
    })
    .sort((a, b) => b.punten - a.punten || b.juist - a.juist || a.naam.localeCompare(b.naam, 'nl'));
}

/** Plaats van een speler in de stand (1 = eerste); gelijke punten delen dezelfde plaats. */
export function plaatsVan(stand: readonly StandRij[], spelerId: string): number | null {
  const rij = stand.find((r) => r.id === spelerId);
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

/** Bijnamen per echte naam, om in de lokale resultaten te bewaren. */
export function bijnamenVan(spelers: readonly LiveSpeler[]): Record<string, string> {
  return Object.fromEntries(spelers.filter((s) => s.bijnaam).map((s) => [s.naam, s.bijnaam!]));
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
  const bijnamen = { ...sessie.live?.bijnamen, ...bijnamenVan(spelers) };
  return {
    ...sessie,
    teams: [{ ...team, leerlingen }, ...sessie.teams.slice(1)],
    beurten,
    live: sessie.live && { ...sessie.live, ...(Object.keys(bijnamen).length ? { bijnamen } : {}) },
  };
}
