export type Vak = 'wiskunde' | 'python' | 'ict' | 'andere';

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
  /** Open vraag: andere antwoorden die ook juist zijn. */
  alternatieven?: string[];
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

/**
 * Whodunit: een logisch raadsel. Leerlingen vullen een tabel in (per categorie een waarde per kolom)
 * en verdienen hints door de oefeningen van de vragenset juist op te lossen.
 */
export interface Raadsel {
  titel: string;
  /** Het verhaal (met opmaak zoals bij vragen). */
  verhaal: string;
  /** Uitleg boven de kolommen, bv. "Deze leerling is gecrasht als...". */
  kolomTitel: string;
  /** Kolommen van de tabel, bv. 1e, 2e, 3e, 4e. */
  kolommen: string[];
  /** Rijen van de tabel; per categorie de juiste waarde in elke kolom (de oplossing). */
  categorieen: { naam: string; oplossing: string[] }[];
  /** Hints ("roddels"), te verdienen met de oefeningen. */
  hints: string[];
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
  /** Raadsel voor het spel Whodunit. */
  raadsel?: Raadsel;
  /** Cluedo: eigen verdachten, locaties en wapens (anders het standaardthema). */
  cluedo?: CluedoThema;
  /** Coverafbeelding (JPEG als data-URL, 16:9). */
  cover?: string;
  /** Hoe vaak deze set gespeeld werd en met hoeveel spelers in totaal (blijft, ook als resultaten gewist worden). */
  statistiek?: { gespeeld: number; spelers: number };
  aangemaakt: string;
  gewijzigd: string;
}

export interface Leerling {
  id: string;
  naam: string;
}

/** Hoe de namen in een klas geschreven zijn: "Anna Peeters" of "Peeters Anna". */
export type NaamVolgorde = 'voornaam' | 'achternaam';

export interface Klas {
  id: string;
  naam: string;
  leerlingen: Leerling[];
  /** Standaard voornaam eerst. */
  naamVolgorde?: NaamVolgorde;
  /** Leerjaar (1-7), zelf gekozen; 0 = geen jaar. Ontbreekt: afgeleid uit de naam (3A = 3). */
  jaar?: number;
}

/** Cluedo: de kaarten waaruit de oplossing getrokken wordt. */
export interface CluedoThema {
  titel: string;
  verdachten: string[];
  locaties: string[];
  wapens: string[];
}

export interface CluedoOplossing {
  verdachte: string;
  locatie: string;
  wapen: string;
}

export type SpelType = 'quizbord' | 'vieropeenrij' | 'bom' | 'live' | 'escape' | 'whodunit' | 'codekraker' | 'cluedo' | 'territorium';

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
  /** Escape room: de geheime code (enkel bij de leerkracht). */
  escapeCode?: string;
  /** Escape room: tijd tot ontsnappen (ms) per leerlingnaam. */
  ontsnapt?: Record<string, number>;
  /** Codekraker: munten per leerlingnaam op het einde. */
  munten?: Record<string, number>;
  /** Territorium: kleur per speler-id en gebied (vakjes) per leerlingnaam op het einde. */
  kleuren?: Record<string, number>;
  gebied?: Record<string, number>;
  /** Territorium: seconden per tekenbeurt. */
  tekenSeconden?: number;
  /** Territorium: het veld en de ranglijst op het einde (om het eindscherm te tonen). */
  eindveld?: string;
  eindstand?: { naam: string; punten: number; juist: number; kleur?: number }[];
  /** Codekraker: hacken toegestaan. */
  hacken?: boolean;
  /** Namen op de server (voornaam, of een groepje "Anna & Bert") met de leerlingen erachter. */
  namen?: Record<string, string[]>;
  /** Bijnamen per leerlingnaam (voor op het scherm). */
  bijnamen?: Record<string, string>;
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
  /** Whodunit: kopie van het raadsel (met de oplossing) bij de start. */
  raadsel?: Raadsel;
  /** Cluedo: het thema en de oplossing (enkel op de laptop van de leerkracht). */
  cluedo?: { thema: CluedoThema; oplossing: CluedoOplossing };
  /** Bom doorgeven: levens, wie de bom heeft en de ronde. */
  bom?: import('./bom').BomToestand;
  /** Meegeteld in de statistiek van de vragenset. */
  geteld?: boolean;
  /**
   * De leerkracht koos "Resultaten bewaren". Enkel bewaarde spellen staan bij de resultaten en gaan
   * naar de cloud; niet-bewaarde spellen worden opgeruimd. (Ontbreekt bij spellen van vroeger.)
   */
  bewaard?: boolean;
  /** Quizbord: dubbele punten voor een leerling die alleen antwoordt. */
  dubbelIndividueel?: boolean;
  /** Naamvolgorde van de klas, voor de korte namen op het scorebord. */
  naamVolgorde?: NaamVolgorde;
}
