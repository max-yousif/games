import { newId } from './ids';
import type { Leerling, NaamVolgorde } from './types';

// ---------- Klaslijst importeren ----------

/** Kolomtitels met (een deel van) de naam. */
const NAAM_KOP = ['naam', 'leerling', 'voornaam', 'achternaam', 'familienaam', 'name', 'roepnaam', 'volledige naam', 'leerlingnaam'];
/** Andere kolomtitels die in een export uit Smartschool, Informat ... voorkomen. */
const ANDERE_KOP = ['klas', 'klasnummer', 'klasnr', 'nr', 'nr.', 'nummer', 'stamnummer', 'e-mail', 'email', 'geboortedatum', 'geslacht', 'gebruikersnaam', 'id', 'richting', 'leerjaar', 'school'];

const kop = (c: string) => c.replace(/\(.*?\)/g, '').trim().toLocaleLowerCase('nl');
const isEmail = (c: string) => /\S+@\S+\.\S+/.test(c);
const isDatum = (c: string) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(c.trim());
/** Klasnaam zoals 3A, 6HW, 4 LAT b. */
const isKlascode = (c: string) => /^\d\s?[a-z]{1,5}\s?[a-z0-9]?$/i.test(c.trim());
/** Ziet eruit als een naam: woorden met een hoofdletter, eventueel met tussenvoegsels (van, de ...). */
const lijktNaam = (c: string) => /^\p{Lu}[\p{L}'’-]*(\s+(van|de|der|den|von|da|le|la|du|ter|ten|op|het|'t|\p{Lu}[\p{L}'’-]*))*$/u.test(c);
const TITELWOORDEN = /\b(klas|klaslijst|klassenlijst|leerlingen|leerlingenlijst|lijst|schooljaar|titularis|groep|overzicht|afgedrukt|pagina|datum)\b/i;

/** Plakte tekst (uit Excel, Smartschool, Word ...) als rijen met kolommen; lege cellen blijven staan. */
export function plakNaarRijen(text: string): string[][] {
  const lijnen = text.split(/\r?\n/).filter((l) => l.trim());
  const sep = lijnen.some((l) => l.includes('\t')) ? '\t' : lijnen.some((l) => l.includes(';')) ? ';' : null;
  return lijnen.map((l) => (sep ? l.split(sep) : [l]).map((c) => c.trim()));
}

export interface KlaslijstKeuze {
  /** Index van de rij met kolomtitels, of -1. Rijen erboven zijn titels en worden overgeslagen. */
  kopRij: number;
  /** Kolommen die samen de naam vormen, in deze volgorde. */
  naamKolommen: number[];
  /** Herkende naamvolgorde (uit de kolomtitels), of undefined als dat niet te zien is. */
  volgorde?: NaamVolgorde;
}

/** Raadt welke rij de titels bevat en welke kolommen de naam vormen. */
export function raadKlaslijst(rows: readonly (readonly string[])[]): KlaslijstKeuze {
  const breedte = Math.max(0, ...rows.map((r) => r.length));
  // Titelrij: de eerste rij die (bijna) enkel bekende kolomtitels bevat, eventueel na een paar titellijnen.
  const kopIndex = rows.slice(0, 5).findIndex((r) => {
    const cellen = r.filter(Boolean).map(kop);
    return cellen.length > 0 && cellen.some((c) => NAAM_KOP.includes(c)) && cellen.every((c) => NAAM_KOP.includes(c) || ANDERE_KOP.includes(c));
  });
  if (kopIndex >= 0) {
    const titels = rows[kopIndex].map(kop);
    // In de volgorde van het bestand: "Naam, Voornaam" geeft "Peeters Anna".
    const naam = titels.flatMap((t, i) => (NAAM_KOP.includes(t) ? [i] : []));
    const voornaam = titels.findIndex((t) => t === 'voornaam' || t === 'roepnaam');
    const volgorde: NaamVolgorde | undefined = voornaam < 0 || naam.length < 2 ? undefined : naam[0] === voornaam ? 'voornaam' : 'achternaam';
    return { kopRij: kopIndex, naamKolommen: naam, ...(volgorde ? { volgorde } : {}) };
  }
  const data = rows;
  const naamKolommen: number[] = [];
  for (let k = 0; k < breedte; k++) {
    const cellen = data.map((r) => r[k] ?? '').filter(Boolean);
    if (cellen.length === 0) continue;
    const tekst = cellen.filter((c) => /\p{L}/u.test(c) && !isEmail(c) && !isDatum(c) && !isKlascode(c));
    const verschillend = new Set(cellen).size;
    if (tekst.length / cellen.length >= 0.6 && (verschillend > 1 || cellen.length <= 2)) naamKolommen.push(k);
  }
  return { kopRij: -1, naamKolommen: naamKolommen.length ? naamKolommen : [0] };
}

export interface NaamKandidaat {
  naam: string;
  /** Standaard aangevinkt? */
  aan: boolean;
  /** Waarom niet aangevinkt. */
  reden?: string;
}

/**
 * Namen uit de rijen volgens de gekozen kolommen. Titels, klasnummers, klasnamen en leerlingen die al
 * in de klas staan, worden herkend en niet aangevinkt (de leerkracht kan ze toch aanvinken).
 */
export function naamKandidaten(rows: readonly (readonly string[])[], keuze: KlaslijstKeuze, bestaand: readonly string[] = []): NaamKandidaat[] {
  const al = new Set(bestaand.map((n) => n.toLocaleLowerCase('nl')));
  const gezien = new Set<string>();
  const breedte = Math.max(0, ...rows.map((r) => r.filter(Boolean).length));
  const lijst: NaamKandidaat[] = [];
  rows.forEach((r, i) => {
    if (i <= keuze.kopRij) return;
    const delen = keuze.naamKolommen.map((k) => r[k] ?? '').filter(Boolean);
    // Nummering vooraan ("12. Anna Peeters", "3) Bert") weglaten.
    let naam = delen.join(' ').replace(/\s+/g, ' ').trim();
    naam = naam.replace(/^\d+\s*[.)\-:]\s*/, '').replace(/^\d+\s+(?=\p{L})/u, '').trim();
    if (!naam) return;
    const k = naam.toLocaleLowerCase('nl');
    let reden: string | undefined;
    // Een losse cel in een tabel met meerdere kolommen is meestal een titel, tenzij het op een naam lijkt.
    const alleenCel = breedte > 1 && r.filter(Boolean).length === 1 && !lijktNaam(naam);
    if (!/\p{L}/u.test(naam)) reden = 'geen naam';
    else if (NAAM_KOP.includes(kop(naam)) || ANDERE_KOP.includes(kop(naam)) || keuze.naamKolommen.every((c) => NAAM_KOP.includes(kop(r[c] ?? '')))) reden = 'kolomtitel';
    else if (TITELWOORDEN.test(naam) || naam.includes(':') || /\d{4}\s*[-–]\s*\d{2,4}/.test(naam) || alleenCel) reden = 'lijkt een titel';
    else if (isKlascode(naam)) reden = 'lijkt een klasnaam';
    else if (isEmail(naam) || isDatum(naam)) reden = 'geen naam';
    else if (naam.split(' ').length > 6) reden = 'te lang voor een naam';
    else if (al.has(k)) reden = 'staat al in de klas';
    else if (gezien.has(k)) reden = 'dubbel';
    gezien.add(k);
    lijst.push({ naam, aan: !reden, ...(reden ? { reden } : {}) });
  });
  return lijst;
}

/** Zet geplakte tekst om naar namen (enkel de herkende, zonder titels en nummers). */
export function parseNamen(text: string): string[] {
  const rows = plakNaarRijen(text);
  return naamKandidaten(rows, raadKlaslijst(rows))
    .filter((k) => k.aan)
    .map((k) => k.naam);
}

const TUSSENVOEGSEL = /^(van|de|der|den|vanden|vande|vander|vandeen|le|la|du|d'|el|ten|ter|op|in|'t|t')$/i;

/**
 * Raadt of namen als "Voornaam Achternaam" of "Achternaam Voornaam" geschreven zijn: een
 * tussenvoegsel vooraan (Van den Broeck Anna) wijst op achternaam eerst, een tussenvoegsel als
 * tweede woord (Anna Van den Broeck) op voornaam eerst. Met de volgorde van de lijst erbij: een
 * klaslijst is meestal alfabetisch op achternaam gesorteerd.
 */
export function raadNaamVolgorde(namen: readonly string[], metLijstvolgorde = false): NaamVolgorde | undefined {
  const woorden = namen.map((n) => n.trim().split(/\s+/)).filter((w) => w.length >= 2);
  if (woorden.length === 0) return undefined;
  let score = 0;
  for (const w of woorden) {
    // Al ingekort tot "Anna P.": voornaam eerst.
    if (isInitiaal(w.at(-1)!)) score -= 2;
    else if (TUSSENVOEGSEL.test(w[0])) score += 2;
    else if (w.length >= 3 && TUSSENVOEGSEL.test(w[1])) score -= 2;
  }
  if (metLijstvolgorde && woorden.length >= 4) {
    const gesorteerd = (f: (w: string[]) => string) =>
      woorden.slice(1).filter((w, i) => f(woorden[i]).localeCompare(f(w), 'nl', { sensitivity: 'base' }) <= 0).length / (woorden.length - 1);
    const eerste = gesorteerd((w) => w[0]);
    const laatste = gesorteerd((w) => w.at(-1)!);
    if (eerste >= 0.9 && laatste < 0.75) score += woorden.length;
    else if (laatste >= 0.9 && eerste < 0.75) score -= woorden.length;
  }
  return score > 0 ? 'achternaam' : score < 0 ? 'voornaam' : undefined;
}

/** Naamvolgorde van een klas: ingesteld, anders geraden, anders achternaam eerst (zoals in de meeste klaslijsten). */
export const naamVolgordeVan = (namen: readonly string[], ingesteld?: NaamVolgorde): NaamVolgorde => ingesteld ?? raadNaamVolgorde(namen) ?? 'achternaam';

/** "P." of "Pe.": een ingekorte achternaam. */
const isInitiaal = (w: string) => /^\p{Lu}\p{Ll}{0,3}\.$/u.test(w);

/** Is deze naam al ingekort tot voornaam en initiaal (of maar één woord)? */
export const isIngekort = (naam: string) => {
  const w = naam.trim().split(/\s+/);
  return w.length < 2 || (w.length === 2 && isInitiaal(w[1]));
};

/**
 * Namen inkorten tot voornaam en initiaal van de achternaam (privacy): "Peeters Anna" wordt
 * "Anna P.". Zouden twee leerlingen dezelfde korte naam krijgen (ook met wie al in de klas staat),
 * dan komen er letters bij: "Anna Pe." en "Anna Pa.". Al ingekorte namen blijven zoals ze zijn.
 */
export function inkorten(namen: readonly string[], volgorde: NaamVolgorde, bezet: readonly string[] = []): string[] {
  const delen = namen.map((n) => {
    if (isIngekort(n)) return null;
    const w = n.trim().split(/\s+/);
    const voornaam = volgorde === 'achternaam' ? w.at(-1)! : w[0];
    const achternaam = (volgorde === 'achternaam' ? w.slice(0, -1) : w.slice(1)).join('');
    return { voornaam, achternaam };
  });
  const lengte = delen.map(() => 1);
  const maak = (i: number) => {
    const d = delen[i]!;
    const stuk = d.achternaam.slice(0, lengte[i]);
    return `${d.voornaam} ${stuk.charAt(0).toLocaleUpperCase('nl')}${stuk.slice(1).toLocaleLowerCase('nl')}.`;
  };
  const sleutel = (t: string) => t.toLocaleLowerCase('nl');
  for (let ronde = 0; ronde < 20; ronde++) {
    const uit = delen.map((d, i) => (d ? maak(i) : namen[i].trim()));
    const tel = new Map<string, number>();
    for (const t of [...uit, ...bezet]) tel.set(sleutel(t), (tel.get(sleutel(t)) ?? 0) + 1);
    let verlengd = false;
    delen.forEach((d, i) => {
      if (d && tel.get(sleutel(uit[i]))! > 1 && lengte[i] < d.achternaam.length) {
        lengte[i]++;
        verlengd = true;
      }
    });
    if (!verlengd) return uit;
  }
  return delen.map((d, i) => (d ? maak(i) : namen[i].trim()));
}

/** De voornaam: het eerste woord, of bij "Achternaam Voornaam" het laatste woord. */
export function roepnaam(naam: string, volgorde: NaamVolgorde = 'voornaam'): string {
  const w = naam.trim().split(/\s+/);
  return (volgorde === 'achternaam' ? w.at(-1) : w[0]) ?? naam;
}

/**
 * Korte namen voor op het bord. Hebben twee leerlingen dezelfde voornaam, dan komt de eerste letter
 * van de achternaam erbij (Anna P., Anna V.).
 */
export function korteNamen(namen: readonly string[], volgorde: NaamVolgorde = 'voornaam'): string[] {
  const kort = namen.map((n) => roepnaam(n, volgorde));
  return kort.map((k, i) => {
    if (kort.filter((x) => x === k).length < 2) return k;
    // Al ingekort ("Anna Pe."): die korte naam is uniek.
    if (isIngekort(namen[i])) return namen[i].trim();
    const w = namen[i].trim().split(/\s+/);
    const achternaam = volgorde === 'achternaam' ? w.slice(0, -1).join(' ') : w.slice(1).join(' ');
    // Eerste hoofdletter van de achternaam (bij "Van den Broeck" de B).
    const letter = achternaam.match(/\p{Lu}(?=[\p{Ll}'’-]*$)/u)?.[0] ?? achternaam.match(/\p{L}/u)?.[0];
    return letter ? `${k} ${letter.toLocaleUpperCase('nl')}.` : k;
  });
}

export function naarLeerlingen(namen: readonly string[]): Leerling[] {
  return namen.map((naam) => ({ id: newId(), naam }));
}

export function sorteerOpNaam(leerlingen: readonly Leerling[]): Leerling[] {
  return [...leerlingen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }));
}
