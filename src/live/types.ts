import type { VraagType } from '../lib/types';

/** Vraag zoals leerlingen ze zien: zonder antwoord. */
export interface PubliekeVraag {
  /** Bij invullen staan de gaten als merktekens ⟦1⟧, ⟦2⟧ ... in de tekst (getoond als ★, ●, ...). */
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
  /** Id van de speler (om de eigen plaats te vinden). */
  id?: string;
  /** Naam zoals op het scherm: de bijnaam als die ingesteld is. */
  naam: string;
  punten: number;
  juist: number;
  /** Escape room: tijd tot ontsnappen (ms), of null als nog niet ontsnapt. */
  tijdMs?: number | null;
}

export type LiveStatus = 'lobby' | 'vraag' | 'antwoord' | 'bezig' | 'einde';
export type LiveModus = 'quiz' | 'escape';

export interface LiveSessie {
  id: string;
  code: string;
  titel: string;
  modus: LiveModus;
  namen: string[];
  vrijeNaam: boolean;
  status: LiveStatus;
  vraagNr: number;
  aantalVragen: number;
  vraag: PubliekeVraag | null;
  /** Escape room: alle sloten. */
  vragen: PubliekeVraag[] | null;
  /** Escape room: seconden wachten na een fout antwoord. */
  wachttijd: number;
  vraagStart: string | null;
  timer: number | null;
  oplossing: Oplossing | null;
  stand: StandRij[];
}

export interface LiveSpeler {
  id: string;
  naam: string;
  /** Bijnaam voor op het scherm, of null. */
  bijnaam: string | null;
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
  /** Escape room: pogingnummer (1, 2, ...). */
  poging: number;
  /** Escape room: het cijfer van de code bij een juist antwoord. */
  beloning: string | null;
}

export interface SessieInfo {
  id: string;
  titel: string;
  vrijeNamen: string[];
  vrijeNaam: boolean;
  status: LiveStatus;
}

/** Emoji's waarmee leerlingen kunnen reageren terwijl ze wachten. */
export const REACTIES = [
  { emoji: '😠', naam: 'boos' },
  { emoji: '😂', naam: 'grappig' },
  { emoji: '❤️', naam: 'hartje' },
  { emoji: '😢', naam: 'droevig' },
  { emoji: '💀', naam: 'doodskop' },
  { emoji: '🐐', naam: 'geit' },
] as const;

/** Een reactie van een leerling (wordt niet bewaard, enkel doorgestuurd naar het bord). */
export interface Reactie {
  emoji: string;
  /** Naam zoals op het scherm (bijnaam als die er is). */
  naam: string;
}

export function isGeldigeReactie(r: unknown): r is Reactie {
  const x = r as Partial<Reactie> | null;
  return !!x && typeof x.naam === 'string' && REACTIES.some((e) => e.emoji === x.emoji);
}

export interface Beoordeling {
  id: string;
  juist: boolean;
  punten: number;
  beloning?: string | null;
}

export type FoutCode =
  | 'onbekende_code'
  | 'gesloten'
  | 'ongeldige_naam'
  | 'naam_bezet'
  | 'geen_vraag'
  | 'al_geantwoord'
  | 'te_laat'
  | 'al_opgelost'
  | 'wacht'
  | 'bijnaam_bezet'
  | 'geen_speler'
  | 'niet_aangemeld'
  | 'anoniem_uit'
  | 'schema_oud'
  | 'login_fout'
  | 'geen_leerkracht'
  | 'verbinding';

export const FOUT_TEKST: Record<FoutCode, string> = {
  onbekende_code: 'Deze code bestaat niet. Controleer de code op het bord.',
  gesloten: 'Dit spel is al afgelopen.',
  ongeldige_naam: 'Deze naam staat niet op de lijst.',
  naam_bezet: 'Deze naam is al gekozen op een andere laptop. Vraag de leerkracht om je los te koppelen.',
  geen_vraag: 'Deze vraag is al afgesloten.',
  al_geantwoord: 'Je hebt deze vraag al beantwoord.',
  te_laat: 'Te laat: de tijd was om.',
  al_opgelost: 'Dit slot is al open.',
  wacht: 'Even wachten voor je opnieuw probeert.',
  bijnaam_bezet: 'Die bijnaam kan niet: het is de naam van een klasgenoot of iemand anders gebruikt hem al.',
  geen_speler: 'Je bent niet (meer) aangemeld in dit spel.',
  niet_aangemeld: 'Aanmelden is mislukt. Herlaad de pagina.',
  anoniem_uit: 'Anoniem aanmelden staat uit in Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).',
  schema_oud: 'Deze functie vraagt een bijgewerkte database. Leerkracht: voer supabase/schema.sql opnieuw uit in Supabase.',
  login_fout: 'Gebruikersnaam of wachtwoord is niet juist.',
  geen_leerkracht: 'Dit kan enkel een leerkracht. Meld je aan met je leerkrachtaccount (rechtsboven).',
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
  maakSessie(input: {
    titel: string;
    namen: string[];
    vrijeNaam: boolean;
    aantalVragen: number;
    timer: number | null;
    modus?: LiveModus;
    vragen?: PubliekeVraag[];
    wachttijd?: number;
  }): Promise<LiveSessie>;
  startVraag(sessieId: string, nr: number, vraag: PubliekeVraag): Promise<void>;
  startEscape(sessieId: string): Promise<void>;
  wijzigSessie(sessieId: string, patch: Partial<Pick<LiveSessie, 'status' | 'oplossing' | 'stand'>>): Promise<void>;
  beoordeel(sessieId: string, items: Beoordeling[]): Promise<void>;
  ontkoppel(spelerId: string): Promise<void>;
  wisBijnaam(spelerId: string): Promise<void>;
  verwijderSessie(sessieId: string): Promise<void>;
  volgSpelers(sessieId: string, cb: (s: LiveSpeler[]) => void): () => void;
  volgAntwoorden(sessieId: string, cb: (a: LiveAntwoord[]) => void): () => void;

  // Leerling
  sessieInfo(code: string): Promise<SessieInfo | null>;
  deelnemen(code: string, naam: string): Promise<{ sessieId: string; spelerId: string; naam: string }>;
  mijnSpeler(sessieId: string): Promise<LiveSpeler | null>;
  /** Bijnaam instellen of wissen (lege tekst); geeft de bewaarde bijnaam terug. */
  bijnaam(sessieId: string, bijnaam: string): Promise<string | null>;
  /** Het spel verlaten: de naam komt weer vrij. */
  verlaten(sessieId: string): Promise<void>;
  antwoord(sessieId: string, vraagNr: number, antwoord: string): Promise<void>;

  // Beide (leerlingen zien enkel hun eigen antwoorden)
  volgSessie(sessieId: string, cb: (s: LiveSessie | null) => void): () => void;

  // Reacties: niet bewaard, rechtstreeks doorgestuurd (Supabase Realtime of tussen tabbladen).
  reageer(sessieId: string, reactie: Reactie): Promise<void>;
  volgReacties(sessieId: string, cb: (r: Reactie) => void): () => void;
}
