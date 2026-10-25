import writeXlsxFile from 'write-excel-file/browser';
import { bestandsnaam } from './backup';
import { juistAntwoord } from './questions';
import { leerlingNaam, resultatenPerLeerling, teamScores } from './session';
import type { Sessie } from './types';

export const SPEL_NAMEN: Record<Sessie['spelType'], string> = {
  quizbord: 'Quizbord',
  vieropeenrij: 'Vier op een rij',
  live: 'Live quiz',
};

const bold = (value: string) => ({ value, fontWeight: 'bold' as const });

export function datumTekst(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

function sessieBladen(s: Sessie, prefix = '') {
  const scores = teamScores(s);
  const perLeerling = [
    [bold('Leerling'), bold('Team'), bold('Beurten'), bold('Juist'), bold('Fout'), bold('Punten')],
    ...resultatenPerLeerling(s).map((r) => [r.naam, r.team, r.beurten, r.juist, r.fout, r.punten]),
    [],
    [bold('Team'), bold('Score')],
    ...s.teams.map((t, i) => [t.naam, scores[i]]),
    [],
    ['Set', s.setTitel],
    ['Klas', s.klasNaam],
    ['Spel', SPEL_NAMEN[s.spelType]],
    ['Datum', datumTekst(s.gestart)],
  ];
  const vraagTekst = (id: string) => s.vragen.find((v) => v.id === id);
  const beurten = [
    [bold('Nr'), bold('Team'), bold('Leerling'), bold('Categorie'), bold('Vraag'), bold('Antwoord'), bold('Juist'), bold('Punten')],
    ...s.beurten.map((b, i) => {
      const v = vraagTekst(b.vraagId);
      return [i + 1, s.teams[b.team]?.naam ?? '', leerlingNaam(s, b.leerlingId), v?.categorie ?? '', v?.tekst ?? '', v ? juistAntwoord(v) : '', b.juist ? 'ja' : 'nee', b.punten];
    }),
  ];
  return [
    { data: perLeerling, sheet: `${prefix}Leerlingen`.slice(0, 31), columns: [{ width: 28 }, { width: 16 }, {}, {}, {}, {}] },
    { data: beurten, sheet: `${prefix}Beurten`.slice(0, 31), columns: [{}, { width: 16 }, { width: 24 }, { width: 18 }, { width: 50 }, { width: 30 }, {}, {}] },
  ];
}

export function exporteerSessie(s: Sessie): Promise<void> {
  const datum = s.gestart.slice(0, 10);
  return writeXlsxFile(sessieBladen(s)).toFile(bestandsnaam(`${datum} ${s.klasNaam} ${s.setTitel}`, 'xlsx'));
}

/** Eén bestand met een overzicht en per leerling de totalen over alle gekozen sessies. */
export function exporteerAlles(sessies: readonly Sessie[]): Promise<void> {
  const overzicht = [
    [bold('Datum'), bold('Klas'), bold('Set'), bold('Spel'), bold('Leerling'), bold('Team'), bold('Beurten'), bold('Juist'), bold('Fout'), bold('Punten')],
    ...sessies.flatMap((s) =>
      resultatenPerLeerling(s).map((r) => [datumTekst(s.gestart), s.klasNaam, s.setTitel, SPEL_NAMEN[s.spelType], r.naam, r.team, r.beurten, r.juist, r.fout, r.punten]),
    ),
  ];
  return writeXlsxFile([
    {
      data: overzicht,
      sheet: 'Alle resultaten',
      stickyRowsCount: 1,
      columns: [{ width: 16 }, { width: 10 }, { width: 30 }, { width: 16 }, { width: 28 }, { width: 16 }, {}, {}, {}, {}],
    },
  ]).toFile(`resultaten-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
