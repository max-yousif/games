import { newId } from './ids';
import type { Leerling } from './types';

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
    // Voornaam vóór achternaam, anders in de volgorde van het bestand.
    const naam = titels.flatMap((t, i) => (NAAM_KOP.includes(t) ? [i] : []));
    const voornaam = titels.findIndex((t) => t === 'voornaam' || t === 'roepnaam');
    const gesorteerd = voornaam >= 0 ? [voornaam, ...naam.filter((i) => i !== voornaam)] : naam;
    return { kopRij: kopIndex, naamKolommen: gesorteerd };
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

export function naarLeerlingen(namen: readonly string[]): Leerling[] {
  return namen.map((naam) => ({ id: newId(), naam }));
}

export function sorteerOpNaam(leerlingen: readonly Leerling[]): Leerling[] {
  return [...leerlingen].sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }));
}
