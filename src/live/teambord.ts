import type { Team } from '../lib/types';
import type { LiveSpeler, PubliekeVraag } from './types';

/**
 * Quizbord, vier op een rij en bom doorgeven op de laptops: het bord blijft op de projector, maar
 * elk teamlid antwoordt op de eigen laptop. Het team aan de beurt heeft het juist als de meerderheid
 * van de verbonden teamleden juist antwoordt; de andere teams antwoorden mee, maar dat telt niet.
 * Eén teamlid (om beurt) kiest op de laptop het vak of de kolom.
 *
 * Elke stap (kiezen, vraag, schijf laten vallen) is een vraag op de server met een eigen nummer.
 */

export type TeambordSpel = 'quizbord' | 'vieropeenrij' | 'bom';
export const TEAMBORD_SPELLEN: readonly string[] = ['quizbord', 'vieropeenrij', 'bom'];

export type TeambordFase = 'kiezen' | 'vraag' | 'zet';

/** Wat bij een stap op de server staat, naast de vraag zelf. */
export interface TeambordVraag {
  spel: TeambordSpel;
  fase: TeambordFase;
  /** Team aan de beurt. */
  team: number;
  teams: { naam: string; kleur: string }[];
  scores: number[];
  /** Wie kiest (fase kiezen en zet). */
  kiezerId?: string;
  kiezerNaam?: string;
  /** Quizbord, fase kiezen: de vakken. */
  vakken?: { id: string; categorie: string; punten: number; vrij: boolean }[];
  /** Vier op een rij, fase zet: per kolom of er nog plaats is. */
  kolommen?: boolean[];
  /** Fase vraag: seconden om te antwoorden (geen = geen limiet). */
  tijd?: number;
}

/** Een lege vraag voor de stappen kiezen en zet. */
export const geenVraag = (): PubliekeVraag => ({ tekst: '', type: 'open', opties: [], links: [], rechts: [], gaten: 0, alsCode: false, punten: 0, categorie: '' });

/** Het resultaat van een vraag (bij de oplossing). */
export interface TeambordUitslag {
  team: number;
  juist: boolean;
  aantalJuist: number;
  aantal: number;
  /** Bom: de bom ontplofte (bij dit team). */
  boem?: boolean;
  tekst: string;
}

/** Wat op de laptop van de leerkracht bewaard wordt (om te kunnen hervatten). */
export interface TeambordToestand {
  /** Volgend vraagnummer op de server. */
  nr: number;
  /** Team per speler-id. */
  teamVan: Record<string, number>;
  /** Hoe vaak elke speler al koos (om beurt kiezen). */
  gekozen: Record<string, number>;
  /** Het spel is gestart (na de wachtruimte). */
  gestart?: boolean;
  /** De vraag die nu loopt: nummer op de server, vraag, team en (bom) het aantal beurten ervoor. */
  huidig?: { nr: number; vraagId: string; team: number; sleutel: number };
}

export const beginTeambord = (): TeambordToestand => ({ nr: 0, teamVan: {}, gekozen: {} });

/**
 * Team per speler: via de klaslijst (naam op de server → leerling-id → team). Wie al een team had,
 * houdt het; een onbekende naam gaat naar het kleinste team.
 */
export function verdeelSpelers(spelers: readonly LiveSpeler[], teams: readonly Team[], namen: Record<string, string[]> | undefined, vorige: Record<string, number>): Record<string, number> {
  const uit: Record<string, number> = { ...vorige };
  const grootte = teams.map((_, i) => Object.values(uit).filter((t) => t === i).length);
  for (const s of spelers) {
    if (s.id in uit) continue;
    const ids = namen?.[s.naam] ?? [];
    let team = teams.findIndex((t) => t.leerlingen.some((l) => ids.includes(l.id) || l.naam === s.naam));
    if (team < 0) team = grootte.indexOf(Math.min(...grootte));
    uit[s.id] = team;
    grootte[team]++;
  }
  return uit;
}

/**
 * Meerderheid in het team: juist zodra meer dan de helft juist is, fout zodra dat niet meer kan.
 * Met `klaar` (tijd om of de leerkracht sluit af) telt wat er is; anders null = nog niet beslist.
 */
export function meerderheid(aantalJuist: number, aantalFout: number, teamGrootte: number, klaar = false): boolean | null {
  const n = Math.max(1, teamGrootte);
  if (aantalJuist * 2 > n) return true;
  if ((n - aantalFout) * 2 <= n) return false;
  return klaar ? aantalJuist * 2 > n : null;
}

/** Wie van het team kiest: wie het minst koos, bij gelijkstand in vaste volgorde. */
export function kiezer(teamleden: readonly string[], gekozen: Record<string, number>): string | null {
  if (teamleden.length === 0) return null;
  const min = Math.min(...teamleden.map((id) => gekozen[id] ?? 0));
  return teamleden.find((id) => (gekozen[id] ?? 0) === min)!;
}

/** De tekst bij de uitslag, bv. "Team Blauw: 4 van 6 juist ✓". */
export function uitslagTekst(teamNaam: string, juist: boolean, aantalJuist: number, aantal: number): string {
  return `${teamNaam}: ${aantalJuist} van ${aantal} juist ${juist ? '✓' : '✗'}`;
}
