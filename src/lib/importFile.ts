import { newId } from './ids';
import { shuffle } from './random';
import type { Vraag, VraagType } from './types';

export class UnsupportedFileError extends Error {
  constructor() {
    super('Dit bestandstype wordt niet ondersteund. Bewaar het bestand in Excel als .xlsx of .csv en probeer opnieuw.');
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('nl-BE');
  return String(value).trim();
}

/** Leest het eerste werkblad van een Excel- (.xlsx) of CSV-bestand als tekst. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'txt') return parseCsv(await file.text());
  if (ext === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    const first = sheets[0];
    if (!first) return [];
    return first.data.map((row) => row.map(cellToString)).filter((row) => row.some((c) => c !== ''));
  }
  throw new UnsupportedFileError();
}

/**
 * Eenvoudige CSV-lezer: herkent ; , of tab als scheidingsteken (Belgische Excel gebruikt ;),
 * ondersteunt aanhalingstekens (ook met regeleindes erin) en slaat lege rijen over.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = ['\t', ';', ','].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), ',');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c !== ''));
}

export type Kolom = 'type' | 'categorie' | 'punten' | 'vraag' | 'antwoord' | 'ookjuist' | 'fout' | 'tolerantie' | 'uitleg';

/** Kolommen in de volgorde van de keuzelijst bij het importeren. */
export const KOLOM_NAMEN: Record<Kolom, string> = {
  vraag: 'Vraag',
  antwoord: 'Antwoord',
  fout: 'Fout antwoord',
  ookjuist: 'Ook juist',
  categorie: 'Categorie',
  punten: 'Punten',
  type: 'Type',
  tolerantie: 'Tolerantie',
  uitleg: 'Uitleg',
};

const ALIASES: Record<Kolom, string[]> = {
  type: ['type', 'soort', 'vraagtype'],
  tolerantie: ['tolerantie', 'foutmarge', 'marge'],
  ookjuist: ['ook juist', 'ook juist 1', 'ook juist 2', 'ook juist 3', 'ander juist antwoord', 'alternatief'],
  categorie: ['categorie', 'onderwerp', 'thema', 'hoofdstuk'],
  punten: ['punten', 'score', 'waarde'],
  vraag: ['vraag', 'opgave', 'vragen'],
  antwoord: ['antwoord', 'juist antwoord', 'oplossing', 'antwoorden', 'juist'],
  fout: ['fout antwoord', 'fout antwoord 1', 'fout antwoord 2', 'fout antwoord 3', 'fout', 'fout 1', 'fout 2', 'fout 3', 'optie', 'afleider', 'foute antwoorden'],
  uitleg: ['uitleg', 'toelichting', 'feedback'],
};

export function kolomVan(titel: string): Kolom | null {
  const t = titel.trim().toLocaleLowerCase('nl');
  for (const [kolom, aliases] of Object.entries(ALIASES) as [Kolom, string[]][]) {
    if (aliases.includes(t) || aliases.includes(t.replace(/\s+\d+$/, ''))) return kolom;
  }
  return null;
}

/**
 * Herkent de kolommen: met een titelrij (Vraag, Antwoord ...) volgens de titels; zonder titelrij
 * is de eerste kolom de vraag, de tweede het antwoord en de rest foute antwoorden (meerkeuze).
 */
export function herkenKolommen(rows: readonly (readonly string[])[]): { kolommen: (Kolom | null)[]; metTitels: boolean } {
  const breedte = Math.max(0, ...rows.map((r) => r.length));
  const titels = (rows[0] ?? []).map(kolomVan);
  if (titels.includes('vraag')) return { kolommen: Array.from({ length: breedte }, (_, i) => titels[i] ?? null), metTitels: true };
  return { kolommen: Array.from({ length: breedte }, (_, i) => (i === 0 ? 'vraag' : i === 1 ? 'antwoord' : 'fout')), metTitels: false };
}

export class QuestionImportError extends Error {}

const TYPE_NAMEN: Record<string, VraagType> = {
  open: 'open',
  'open vraag': 'open',
  meerkeuze: 'meerkeuze',
  'waar/onwaar': 'waaronwaar',
  'waar of onwaar': 'waaronwaar',
  waaronwaar: 'waaronwaar',
  getal: 'getal',
  invullen: 'invullen',
  ordenen: 'ordenen',
  koppelen: 'koppelen',
};

/** Lijnen in één cel: gescheiden door een regeleinde (Alt+Enter in Excel) of door |. */
function lijnenUit(cel: string): string[] {
  const delen = cel.includes('\n') ? cel.split(/\r?\n/) : cel.split('|');
  return delen.map((d) => d.replace(/\s+$/, '')).filter((d) => d.trim());
}

/** Eén ingelezen vraag, of waarom een rij niet gelezen kon worden. */
export interface ImportItem {
  /** Waar het vandaan komt, bv. "rij 3". */
  bron: string;
  vraag?: Vraag;
  fout?: string;
}

const isWaarOnwaar = (a: string) => /^(waar|onwaar|juist|fout)$/i.test(a.trim());

/**
 * Zet rijen om naar vragen volgens de gekozen kolommen. Zonder kolom "Type": met foute antwoorden
 * wordt het meerkeuze, met [[gaten]] invullen, met antwoord waar/onwaar een waar-of-onwaarvraag,
 * anders een open vraag. Met "Type" kan ook: getal (met optionele kolom Tolerantie), ordenen (items
 * in de juiste volgorde, elk op een eigen lijn of gescheiden door |) en koppelen (paren als
 * "links -> rechts", elk op een eigen lijn of met |).
 */
export function rijenNaarVragen(rows: readonly (readonly string[])[], kolommen: readonly (Kolom | null)[], metTitels: boolean): ImportItem[] {
  const index = (k: Kolom) => kolommen.indexOf(k);
  const vind = (row: readonly string[], k: Kolom) => (index(k) >= 0 ? (row[index(k)] ?? '').trim() : '');
  const alle = (row: readonly string[], k: Kolom) => kolommen.flatMap((kk, i) => (kk === k && row[i]?.trim() ? [row[i].trim()] : []));
  const items: ImportItem[] = [];

  rows.forEach((row, i) => {
    if (metTitels && i === 0) return;
    const tekst = vind(row, 'vraag');
    if (!tekst) return;
    const bron = `rij ${i + 1}`;
    // Ruwe cel (niet getrimd), zodat inspringing van codelijnen behouden blijft.
    const antwoordCel = index('antwoord') >= 0 ? (row[index('antwoord')] ?? '') : '';
    const antwoord = antwoordCel.trim();
    const fouten = alle(row, 'fout');
    const punten = Number.parseInt(vind(row, 'punten'), 10);
    const typeCel = vind(row, 'type').toLocaleLowerCase('nl');
    const type: VraagType | undefined = typeCel
      ? TYPE_NAMEN[typeCel]
      : fouten.length > 0
        ? 'meerkeuze'
        : /\[\[.+?\]\]/.test(tekst)
          ? 'invullen'
          : isWaarOnwaar(antwoord) && index('type') < 0
            ? 'waaronwaar'
            : 'open';
    if (!type) {
      items.push({ bron, fout: `Onbekend type "${vind(row, 'type')}" in ${bron}. Gebruik: ${Object.keys(TYPE_NAMEN).join(', ')}.` });
      return;
    }

    const v: Vraag = {
      id: newId(),
      categorie: vind(row, 'categorie'),
      punten: Number.isFinite(punten) && punten > 0 ? punten : 100,
      type,
      tekst,
      antwoord: '',
      opties: ['', '', '', ''],
      juisteOptie: 0,
      uitleg: vind(row, 'uitleg'),
    };
    const maak = (): Vraag => {
      switch (type) {
        case 'meerkeuze': {
          const opties = shuffle([antwoord, ...fouten]);
          return { ...v, opties, juisteOptie: opties.indexOf(antwoord) };
        }
        case 'waaronwaar':
          return { ...v, juisteOptie: /^(onwaar|fout|nee|o|f|false)$/i.test(antwoord) ? 1 : 0 };
        case 'getal':
          return { ...v, antwoord, tolerantie: Math.abs(Number(vind(row, 'tolerantie').replace(',', '.'))) || 0 };
        case 'ordenen':
          return { ...v, opties: lijnenUit(antwoordCel), alsCode: lijnenUit(antwoordCel).some((l) => /^\s/.test(l)) };
        case 'koppelen':
          return {
            ...v,
            paren: lijnenUit(antwoordCel).map((l) => {
              const [links, ...rest] = l.split(/\s*(?:->|→)\s*/);
              return [links.trim(), rest.join(' -> ').trim()] as [string, string];
            }),
          };
        case 'invullen':
          return v;
        default: {
          // Meerdere juiste antwoorden: kolommen "Ook juist", of in Antwoord gescheiden door " | "
          // (met spaties, zodat een absolute waarde zoals $|x|$ niet gesplitst wordt).
          const [eerste, ...rest] = antwoord.split(/\s+\|\s+/).map((a) => a.trim());
          const alternatieven = [...rest, ...alle(row, 'ookjuist')].filter(Boolean);
          return { ...v, antwoord: eerste, ...(alternatieven.length ? { alternatieven } : {}) };
        }
      }
    };
    items.push({ bron, vraag: maak() });
  });
  return items;
}

/** Zet rijen met een titelrij om naar vragen. Verplicht: "Vraag" en "Antwoord". */
export function rowsToQuestions(rows: readonly (readonly string[])[]): Vraag[] {
  if (rows.length === 0) return [];
  const kolommen = rows[0].map(kolomVan);
  if (!kolommen.includes('vraag') || !kolommen.includes('antwoord')) {
    throw new QuestionImportError('De eerste rij moet minstens de kolommen "Vraag" en "Antwoord" bevatten. Download het sjabloon als voorbeeld.');
  }
  const items = rijenNaarVragen(rows, kolommen, true);
  const fout = items.find((it) => it.fout);
  if (fout) throw new QuestionImportError(fout.fout);
  return items.map((it) => it.vraag!);
}

/** Leeg sjabloon met de juiste kolomtitels. */
export async function downloadQuestionTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  return writeXlsxFile([
    ['Type', 'Categorie', 'Punten', 'Vraag', 'Antwoord', 'Ook juist', 'Fout antwoord 1', 'Fout antwoord 2', 'Fout antwoord 3', 'Tolerantie', 'Uitleg'],
    ['open', 'Ontbinden', '100', 'Ontbind: $x^2-49$', '$(x-7)(x+7)$', '$(x+7)(x-7)$', '', '', '', '', 'Verschil van twee kwadraten'],
    ['open', 'Vergelijkingen', '100', 'Los op: $2x = 12$', 'x = 6 | 6', '', '', '', '', '', 'Meerdere juiste antwoorden kan ook met " | " in de cel Antwoord.'],
    ['meerkeuze', 'Machten', '200', 'Bereken: $(-3)^{-2}$', '$\\frac{1}{9}$', '', '$-9$', '$-\\frac{1}{9}$', '$9$', '', ''],
    ['waar/onwaar', 'Machten', '100', '$2^3 \\cdot 2^2 = 2^6$', 'onwaar', '', '', '', '', '', 'Exponenten optellen: $2^5$'],
    ['getal', 'Statistiek', '200', 'Bereken het gemiddelde van 4, 7 en 9.', '6,67', '', '', '', '', '0,01', ''],
    ['invullen', 'Python', '100', 'Vul aan: `for i in [[range]](3):`', '', '', '', '', '', '', ''],
    ['ordenen', 'Python', '300', 'Zet de lijnen in de juiste volgorde.', 'x = int(input())|if x > 0:|    print("positief")', '', '', '', '', '', ''],
    ['koppelen', 'Functies', '200', 'Koppel elk voorschrift aan de grafiek.', '$y=x^2$ -> dalparabool|$y=-x^2$ -> bergparabool', '', '', '', '', '', ''],
  ]).toFile('vragen-sjabloon.xlsx');
}
