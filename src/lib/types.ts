export type Vak = 'wiskunde' | 'python' | 'andere';

export type VraagType = 'open' | 'meerkeuze' | 'waaronwaar' | 'getal' | 'invullen' | 'ordenen' | 'koppelen';

export interface Vraag {
  id: string;
  /** Kolom op het quizbord, bv. "Ontbinden". */
  categorie: string;
  punten: number;
  type: VraagType;
  /**
   * Tekst met $LaTeX$, `code` en ```codeblokken```.
   * Bij invullen staan de gaten tussen dubbele vierkante haken: [[antwoord]] of [[0,5|1/2]].
   */
  tekst: string;
  /** Antwoord bij een open vraag of een getal. */
  antwoord: string;
  /** Meerkeuze: de opties. Ordenen: de items in de juiste volgorde. */
  opties: string[];
  /** Meerkeuze: index van de juiste optie. Waar/onwaar: 0 = waar, 1 = onwaar. */
  juisteOptie: number;
  /** Getal: toegelaten afwijking (absoluut), bv. 0,01. */
  tolerantie?: number;
  /** Koppelen: paren [links, rechts]. */
  paren?: [string, string][];
  /** Ordenen: items tonen als code (bv. Python-lijnen met inspringing). */
  alsCode?: boolean;
  uitleg: string;
}

export interface Vragenset {
  id: string;
  titel: string;
  beschrijving: string;
  vak: Vak;
  leerjaar: string;
  vragen: Vraag[];
  /** Id van een voorbeeldset, zodat die niet dubbel toegevoegd wordt. */
  voorbeeld?: string;
  aangemaakt: string;
  gewijzigd: string;
}

export interface Leerling {
  id: string;
  naam: string;
}

export interface Klas {
  id: string;
  naam: string;
  leerlingen: Leerling[];
}

export type SpelType = 'quizbord' | 'vieropeenrij' | 'live';

export interface Team {
  naam: string;
  kleur: string;
  leerlingen: Leerling[];
}

export interface Beurt {
  vraagId: string;
  team: number;
  /** null = het hele team antwoordde. */
  leerlingId: string | null;
  juist: boolean;
  punten: number;
  tijd: string;
}

export interface Zet {
  team: number;
  kolom: number;
}

/** Extra gegevens van een live spel (elke leerling op de eigen laptop). */
export interface LiveInfo {
  backend: 'supabase' | 'lokaal';
  sessieId: string;
  code: string;
  snelheidsbonus: boolean;
  /** true wanneer de server-gegevens gewist zijn (na "Afsluiten"). */
  afgesloten: boolean;
}

export interface Sessie {
  id: string;
  spelType: SpelType;
  setId: string;
  setTitel: string;
  klasNaam: string;
  /** Kopie van de vragen bij de start, zodat latere wijzigingen de sessie niet breken. */
  vragen: Vraag[];
  teams: Team[];
  /** Seconden per vraag, of null zonder timer. */
  timer: number | null;
  /** Volgorde waarin vragen getrokken worden (vier op een rij). */
  vraagVolgorde: string[];
  beurten: Beurt[];
  /** Vier op een rij: gevallen schijven. */
  zetten: Zet[];
  gestart: string;
  beeindigd: string | null;
  live?: LiveInfo;
}
