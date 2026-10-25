export type Vak = 'wiskunde' | 'python' | 'andere';

export interface Vraag {
  id: string;
  /** Kolom op het quizbord, bv. "Ontbinden". */
  categorie: string;
  punten: number;
  type: 'open' | 'meerkeuze';
  /** Tekst met $LaTeX$, `code` en ```codeblokken```. */
  tekst: string;
  /** Antwoord bij een open vraag. */
  antwoord: string;
  /** Opties bij een meerkeuzevraag. */
  opties: string[];
  /** Index van de juiste optie. */
  juisteOptie: number;
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

export type SpelType = 'quizbord' | 'vieropeenrij';

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
}
