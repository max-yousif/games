import type { VraagType } from '../lib/types';

/** Vraag zoals leerlingen ze zien: zonder antwoord. */
export interface PubliekeVraag {
  /** Bij invullen staan de gaten als __(1)__, __(2)__ ... in de tekst. */
  tekst: string;
  type: VraagType;
  /** Keuzevragen: de opties. Ordenen: de items door elkaar. */
  opties: string[];
  /** Koppelen: linkerkolom (vaste volgorde) en rechterkolom (door elkaar). */
  links: string[];
  rechts: string[];
  /** Invullen: aantal gaten. */
  gaten: number;
  alsCode: boolean;
  punten: number;
  categorie: string;
}

export interface Oplossing {
  /** Index van de juiste optie bij meerkeuze, anders null. */
  juisteOptie: number | null;
  antwoord: string;
  uitleg: string;
}

export interface StandRij {
  naam: string;
  punten: number;
  juist: number;
}

export type LiveStatus = 'lobby' | 'vraag' | 'antwoord' | 'einde';

export interface LiveSessie {
  id: string;
  code: string;
  titel: string;
  namen: string[];
  vrijeNaam: boolean;
  status: LiveStatus;
  vraagNr: number;
  aantalVragen: number;
  vraag: PubliekeVraag | null;
  vraagStart: string | null;
  timer: number | null;
  oplossing: Oplossing | null;
  stand: StandRij[];
}

export interface LiveSpeler {
  id: string;
  naam: string;
  /** false = losgekoppeld door de leerkracht. */
  verbonden: boolean;
}

export interface LiveAntwoord {
  id: string;
  spelerId: string;
  vraagNr: number;
  /**
   * Keuzevragen: index van de optie (als tekst). Open en getal: de getypte tekst.
   * Invullen, ordenen en koppelen: een JSON-lijst met teksten (zie antwoordUit in logic.ts).
   */
  antwoord: string;
  tijdMs: number;
  juist: boolean | null;
  punten: number;
}

export interface SessieInfo {
  id: string;
  titel: string;
  vrijeNamen: string[];
  vrijeNaam: boolean;
  status: LiveStatus;
}

export interface Beoordeling {
  id: string;
  juist: boolean;
  punten: number;
}

export type FoutCode =
  | 'onbekende_code'
  | 'gesloten'
  | 'ongeldige_naam'
  | 'naam_bezet'
  | 'geen_vraag'
  | 'al_geantwoord'
  | 'te_laat'
  | 'geen_speler'
  | 'niet_aangemeld'
  | 'anoniem_uit'
  | 'verbinding';

export const FOUT_TEKST: Record<FoutCode, string> = {
  onbekende_code: 'Deze code bestaat niet. Controleer de code op het bord.',
  gesloten: 'Dit spel is al afgelopen.',
  ongeldige_naam: 'Deze naam staat niet op de lijst.',
  naam_bezet: 'Deze naam is al gekozen op een andere laptop. Vraag de leerkracht om je los te koppelen.',
  geen_vraag: 'Deze vraag is al afgesloten.',
  al_geantwoord: 'Je hebt deze vraag al beantwoord.',
  te_laat: 'Te laat: de tijd was om.',
  geen_speler: 'Je bent niet (meer) aangemeld in dit spel.',
  niet_aangemeld: 'Aanmelden is mislukt. Herlaad de pagina.',
  anoniem_uit: 'Anoniem aanmelden staat uit in Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).',
  verbinding: 'Geen verbinding met de server. Controleer het internet en probeer opnieuw.',
};

export class LiveFout extends Error {
  constructor(public code: FoutCode) {
    super(FOUT_TEKST[code]);
  }
}

/** Alles wat de app nodig heeft van de server (Supabase of de lokale demo). */
export interface LiveBackend {
  soort: 'supabase' | 'lokaal';

  // Leerkracht
  maakSessie(input: { titel: string; namen: string[]; vrijeNaam: boolean; aantalVragen: number; timer: number | null }): Promise<LiveSessie>;
  startVraag(sessieId: string, nr: number, vraag: PubliekeVraag): Promise<void>;
  wijzigSessie(sessieId: string, patch: Partial<Pick<LiveSessie, 'status' | 'oplossing' | 'stand'>>): Promise<void>;
  beoordeel(sessieId: string, items: Beoordeling[]): Promise<void>;
  ontkoppel(spelerId: string): Promise<void>;
  verwijderSessie(sessieId: string): Promise<void>;
  volgSpelers(sessieId: string, cb: (s: LiveSpeler[]) => void): () => void;
  volgAntwoorden(sessieId: string, cb: (a: LiveAntwoord[]) => void): () => void;

  // Leerling
  sessieInfo(code: string): Promise<SessieInfo | null>;
  deelnemen(code: string, naam: string): Promise<{ sessieId: string; spelerId: string; naam: string }>;
  mijnSpeler(sessieId: string): Promise<LiveSpeler | null>;
  antwoord(sessieId: string, vraagNr: number, antwoord: string): Promise<void>;

  // Beide (leerlingen zien enkel hun eigen antwoorden)
  volgSessie(sessieId: string, cb: (s: LiveSessie | null) => void): () => void;
}
