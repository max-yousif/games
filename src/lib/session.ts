import { newId, nu } from './ids';
import { randomInt as defaultRandomInt, shuffle, type RandomInt } from './random';
import type { Beurt, Leerling, Sessie, SpelType, Team, Vraag, Vragenset } from './types';

export const TEAM_KLEUREN = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2'];
const TEAM_NAMEN = ['Blauw', 'Rood', 'Groen', 'Oranje', 'Paars', 'Turkoois'];

/** Verdeelt leerlingen willekeurig over teams die zo gelijk mogelijk zijn. */
export function maakTeams(leerlingen: readonly Leerling[], aantal: number, rand: RandomInt = defaultRandomInt): Team[] {
  const geschud = shuffle(leerlingen, rand);
  return Array.from({ length: aantal }, (_, i) => ({
    naam: `Team ${TEAM_NAMEN[i] ?? i + 1}`,
    kleur: TEAM_KLEUREN[i % TEAM_KLEUREN.length],
    leerlingen: geschud.filter((_, j) => j % aantal === i),
  }));
}

export function nieuweSessie(opts: {
  spelType: SpelType;
  set: Vragenset;
  vragen: Vraag[];
  klasNaam: string;
  teams: Team[];
  timer: number | null;
}): Sessie {
  return {
    id: newId(),
    spelType: opts.spelType,
    setId: opts.set.id,
    setTitel: opts.set.titel,
    klasNaam: opts.klasNaam,
    vragen: opts.vragen,
    teams: opts.teams,
    timer: opts.timer,
    vraagVolgorde: shuffle(opts.vragen.map((v) => v.id)),
    beurten: [],
    zetten: [],
    gestart: nu(),
    beeindigd: null,
  };
}

export function teamScores(s: Sessie): number[] {
  const scores = s.teams.map(() => 0);
  for (const b of s.beurten) scores[b.team] += b.punten;
  return scores;
}

/** Team dat nu aan de beurt is: om de beurt, te beginnen bij team 0. */
export function teamAanDeBeurt(s: Sessie): number {
  return s.beurten.length % s.teams.length;
}

export function aantalBeurten(s: Sessie, leerlingId: string): number {
  return s.beurten.filter((b) => b.leerlingId === leerlingId).length;
}

/**
 * Kiest willekeurig een leerling uit het team, met voorrang voor wie het minst beurten had.
 * Geeft null als het team leeg is.
 */
export function kiesLeerling(s: Sessie, team: number, rand: RandomInt = defaultRandomInt): Leerling | null {
  const leden = s.teams[team]?.leerlingen ?? [];
  if (leden.length === 0) return null;
  const min = Math.min(...leden.map((l) => aantalBeurten(s, l.id)));
  const kandidaten = leden.filter((l) => aantalBeurten(s, l.id) === min);
  return kandidaten[rand(kandidaten.length)];
}

export function voegBeurtToe(s: Sessie, beurt: Omit<Beurt, 'tijd'>): Sessie {
  return { ...s, beurten: [...s.beurten, { ...beurt, tijd: nu() }] };
}

export function beeindig(s: Sessie): Sessie {
  return s.beeindigd ? s : { ...s, beeindigd: nu() };
}

/** Vragen die al gespeeld werden. */
export function gespeeldeVragen(s: Sessie): Set<string> {
  return new Set(s.beurten.map((b) => b.vraagId));
}

/**
 * Volgende vraag voor spellen die vragen trekken (vier op een rij): de eerste vraag in de
 * volgorde die het minst vaak gespeeld werd. Als alle vragen op zijn, begint de reeks opnieuw.
 */
export function volgendeVraag(s: Sessie): Vraag | null {
  const telling = new Map<string, number>();
  for (const b of s.beurten) telling.set(b.vraagId, (telling.get(b.vraagId) ?? 0) + 1);
  const volgorde = s.vraagVolgorde.filter((id) => s.vragen.some((v) => v.id === id));
  if (volgorde.length === 0) return null;
  const min = Math.min(...volgorde.map((id) => telling.get(id) ?? 0));
  const id = volgorde.find((i) => (telling.get(i) ?? 0) === min)!;
  return s.vragen.find((v) => v.id === id) ?? null;
}

export interface LeerlingResultaat {
  naam: string;
  team: string;
  beurten: number;
  juist: number;
  fout: number;
  punten: number;
}

/** Overzicht per leerling (alle leerlingen, ook wie geen beurt had), plus beurten van het hele team. */
export function resultatenPerLeerling(s: Sessie): LeerlingResultaat[] {
  const rijen: LeerlingResultaat[] = [];
  s.teams.forEach((team, ti) => {
    for (const l of team.leerlingen) {
      const bs = s.beurten.filter((b) => b.leerlingId === l.id);
      rijen.push(rij(l.naam, team.naam, bs));
    }
    const teamBeurten = s.beurten.filter((b) => b.team === ti && b.leerlingId === null);
    if (teamBeurten.length > 0) rijen.push(rij('(hele team)', team.naam, teamBeurten));
  });
  return rijen;
}

function rij(naam: string, team: string, bs: readonly Beurt[]): LeerlingResultaat {
  const juist = bs.filter((b) => b.juist).length;
  return { naam, team, beurten: bs.length, juist, fout: bs.length - juist, punten: bs.reduce((t, b) => t + b.punten, 0) };
}

/** Naam van een leerling in de sessie (ook als de klas intussen gewijzigd is). */
export function leerlingNaam(s: Sessie, id: string | null): string {
  if (id === null) return 'hele team';
  for (const t of s.teams) {
    const l = t.leerlingen.find((x) => x.id === id);
    if (l) return l.naam;
  }
  return '?';
}
