import readXlsxFile from 'read-excel-file/browser';
import writeXlsxFile from 'write-excel-file/browser';
import { newId } from './ids';
import { shuffle } from './random';
import type { Vraag } from './types';

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

type Kolom = 'categorie' | 'punten' | 'vraag' | 'antwoord' | 'fout' | 'uitleg';

const ALIASES: Record<Kolom, string[]> = {
  categorie: ['categorie', 'onderwerp', 'thema', 'hoofdstuk'],
  punten: ['punten', 'score', 'waarde'],
  vraag: ['vraag', 'opgave'],
  antwoord: ['antwoord', 'juist antwoord', 'oplossing'],
  fout: ['fout antwoord', 'fout antwoord 1', 'fout antwoord 2', 'fout antwoord 3', 'fout', 'fout 1', 'fout 2', 'fout 3', 'optie', 'afleider'],
  uitleg: ['uitleg', 'toelichting', 'feedback'],
};

function kolomVan(titel: string): Kolom | null {
  const t = titel.trim().toLocaleLowerCase('nl');
  for (const [kolom, aliases] of Object.entries(ALIASES) as [Kolom, string[]][]) {
    if (aliases.includes(t)) return kolom;
  }
  return null;
}

export class QuestionImportError extends Error {}

/**
 * Zet rijen met een titelrij om naar vragen. Verplicht: "Vraag" en "Antwoord".
 * Met één of meer kolommen "Fout antwoord" wordt het een meerkeuzevraag (opties geschud).
 */
export function rowsToQuestions(rows: readonly (readonly string[])[]): Vraag[] {
  if (rows.length === 0) return [];
  const kolommen = rows[0].map(kolomVan);
  if (!kolommen.includes('vraag') || !kolommen.includes('antwoord')) {
    throw new QuestionImportError('De eerste rij moet minstens de kolommen "Vraag" en "Antwoord" bevatten. Download het sjabloon als voorbeeld.');
  }
  const vind = (row: readonly string[], k: Kolom) => (row[kolommen.indexOf(k)] ?? '').trim();

  return rows
    .slice(1)
    .filter((row) => vind(row, 'vraag'))
    .map((row) => {
      const antwoord = vind(row, 'antwoord');
      const fouten = kolommen.flatMap((k, i) => (k === 'fout' && row[i]?.trim() ? [row[i].trim()] : []));
      const punten = Number.parseInt(vind(row, 'punten'), 10);
      const opties = fouten.length > 0 ? shuffle([antwoord, ...fouten]) : ['', '', '', ''];
      return {
        id: newId(),
        categorie: vind(row, 'categorie'),
        punten: Number.isFinite(punten) && punten > 0 ? punten : 100,
        type: fouten.length > 0 ? 'meerkeuze' : 'open',
        tekst: vind(row, 'vraag'),
        antwoord: fouten.length > 0 ? '' : antwoord,
        opties,
        juisteOptie: fouten.length > 0 ? opties.indexOf(antwoord) : 0,
        uitleg: vind(row, 'uitleg'),
      } satisfies Vraag;
    });
}

/** Leeg sjabloon met de juiste kolomtitels. */
export function downloadQuestionTemplate(): Promise<void> {
  return writeXlsxFile([
    ['Categorie', 'Punten', 'Vraag', 'Antwoord', 'Fout antwoord 1', 'Fout antwoord 2', 'Fout antwoord 3', 'Uitleg'],
    ['Ontbinden', '100', 'Ontbind: $x^2-49$', '$(x-7)(x+7)$', '', '', '', 'Verschil van twee kwadraten'],
    ['Machten', '200', 'Bereken: $(-3)^{-2}$', '$\\frac{1}{9}$', '$-9$', '$-\\frac{1}{9}$', '$9$', ''],
  ]).toFile('vragen-sjabloon.xlsx');
}
