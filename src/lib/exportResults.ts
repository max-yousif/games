import { bestandsnaam } from './backup';
import { juistAntwoord } from './questions';
import { gatenAlsTekst } from './vraagtypes';
import { leerlingNaam, overzichtPerLeerling, procentJuist, resultatenPerLeerling, teamScores } from './session';
import type { Sessie } from './types';

/** Tijd als m:ss. */
export function tijdTekst(ms: number): string {
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export const SPEL_NAMEN: Record<Sessie['spelType'], string> = {
  quizbord: 'Quizbord',
  vieropeenrij: 'Vier op een rij',
  bom: 'Bom doorgeven',
  live: 'Live quiz',
  escape: 'Escape room',
  whodunit: 'Whodunit',
  codekraker: 'Crypto Hack',
  cluedo: 'Cluedo',
  territorium: 'Territorium',
};

const bold = (value: string) => ({ value, fontWeight: 'bold' as const });

export function datumTekst(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' });
}

function sessieBladen(s: Sessie, prefix = '') {
  const scores = teamScores(s);
  const ontsnapt = s.live?.ontsnapt;
  const tijd = (naam: string) => (ontsnapt?.[naam] !== undefined ? tijdTekst(ontsnapt[naam]) : '');
  const bijnamen = s.live?.bijnamen;
  const munten = s.live?.munten;
  const gebied = s.live?.gebied;
  const perLeerling = [
    [
      bold('Leerling'),
      ...(bijnamen ? [bold('Bijnaam')] : []),
      bold('Team'),
      bold('Pogingen'),
      bold('Juist'),
      bold('Fout'),
      bold('Punten'),
      ...(ontsnapt ? [bold(s.spelType === 'whodunit' || s.spelType === 'cluedo' ? 'Opgelost na' : 'Ontsnapt na')] : []),
      ...(munten ? [bold('Munten')] : []),
      ...(gebied ? [bold('Gebied (vakjes)')] : []),
    ],
    ...resultatenPerLeerling(s).map((r) => [
      r.naam,
      ...(bijnamen ? [bijnamen[r.naam] ?? ''] : []),
      r.team,
      r.beurten,
      r.juist,
      r.fout,
      r.punten,
      ...(ontsnapt ? [tijd(r.naam)] : []),
      ...(munten ? [munten[r.naam] ?? 0] : []),
      ...(gebied ? [gebied[r.naam] ?? 0] : []),
    ]),
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
      return [i + 1, s.teams[b.team]?.naam ?? '', leerlingNaam(s, b.leerlingId), v?.categorie ?? '', v?.tekst ?? '', v ? gatenAlsTekst(juistAntwoord(v)) : '', b.juist ? 'ja' : 'nee', b.punten];
    }),
  ];
  return [
    { data: perLeerling, sheet: `${prefix}Leerlingen`.slice(0, 31), columns: [{ width: 28 }, { width: 16 }, {}, {}, {}, {}] },
    { data: beurten, sheet: `${prefix}Beurten`.slice(0, 31), columns: [{}, { width: 16 }, { width: 24 }, { width: 18 }, { width: 50 }, { width: 30 }, {}, {}] },
  ];
}

/** De Excel-bibliotheek wordt pas geladen bij het exporteren. */
const excel = () => import('write-excel-file/browser').then((m) => m.default);

export async function exporteerSessie(s: Sessie): Promise<void> {
  const datum = s.gestart.slice(0, 10);
  const writeXlsxFile = await excel();
  return writeXlsxFile(sessieBladen(s)).toFile(bestandsnaam(`${datum} ${s.klasNaam} ${s.setTitel}`, 'xlsx'));
}

/** Eén bestand met een overzicht en per leerling de totalen over alle gekozen sessies. */
export async function exporteerAlles(sessies: readonly Sessie[]): Promise<void> {
  const writeXlsxFile = await excel();
  const overzicht = [
    [bold('Datum'), bold('Klas'), bold('Set'), bold('Spel'), bold('Leerling'), bold('Team'), bold('Beurten'), bold('Juist'), bold('Fout'), bold('Punten')],
    ...sessies.flatMap((s) =>
      resultatenPerLeerling(s).map((r) => [datumTekst(s.gestart), s.klasNaam, s.setTitel, SPEL_NAMEN[s.spelType], r.naam, r.team, r.beurten, r.juist, r.fout, r.punten]),
    ),
  ];
  const perLeerling = [
    [bold('Klas'), bold('Leerling'), bold('Spellen'), bold('Beurten'), bold('Juist'), bold('Fout'), bold('% juist'), bold('Punten')],
    ...overzichtPerLeerling(sessies).map((o) => [o.klas, o.naam, o.spellen, o.beurten, o.juist, o.fout, procentJuist(o) ?? '', o.punten]),
  ];
  return writeXlsxFile([
    {
      data: perLeerling,
      sheet: 'Per leerling',
      stickyRowsCount: 1,
      columns: [{ width: 10 }, { width: 28 }, {}, {}, {}, {}, {}, {}],
    },
    {
      data: overzicht,
      sheet: 'Alle resultaten',
      stickyRowsCount: 1,
      columns: [{ width: 16 }, { width: 10 }, { width: 30 }, { width: 16 }, { width: 28 }, { width: 16 }, {}, {}, {}, {}],
    },
  ]).toFile(`resultaten-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
