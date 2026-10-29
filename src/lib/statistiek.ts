import { leerlingNaam, overzichtPerLeerling, procentJuist } from './session';
import type { Sessie } from './types';

/**
 * Statistieken over bewaarde spellen: hoe goed deed de klas het, per spel, per onderwerp en per
 * vraag, en welke leerlingen springen eruit (sterk, extra aandacht, vooruitgang, weinig deelname).
 */

export interface PerSpel {
  id: string;
  titel: string;
  klas: string;
  datum: string;
  procent: number;
  beurten: number;
}

export interface PerOnderwerp {
  onderwerp: string;
  procent: number;
  beurten: number;
}

export interface MoeilijkeVraag {
  tekst: string;
  set: string;
  procent: number;
  beurten: number;
}

export interface Leerling {
  naam: string;
  klas: string;
  procent: number;
  beurten: number;
  spellen: number;
}

export interface Vooruitgang {
  naam: string;
  klas: string;
  /** % juist in de eerste en de tweede helft van de beurten (in tijd). */
  voor: number;
  na: number;
}

export interface Deelname {
  naam: string;
  klas: string;
  spellen: number;
  /** Aantal bewaarde spellen van die klas. */
  van: number;
}

export interface Statistieken {
  perSpel: PerSpel[];
  perOnderwerp: PerOnderwerp[];
  moeilijkst: MoeilijkeVraag[];
  sterkst: Leerling[];
  aandacht: Leerling[];
  vooruitgang: Vooruitgang[];
  deelname: Deelname[];
}

const pct = (juist: number, totaal: number) => Math.round((juist / totaal) * 100);

/** Minimum aantal beurten om een leerling of vraag mee te tellen (anders zegt het percentage weinig). */
export const MIN_BEURTEN = 4;

export function statistieken(sessies: readonly Sessie[]): Statistieken {
  const chronologisch = [...sessies].sort((a, b) => a.gestart.localeCompare(b.gestart));

  const perSpel: PerSpel[] = chronologisch
    .filter((s) => s.beurten.length > 0)
    .map((s) => ({ id: s.id, titel: s.setTitel, klas: s.klasNaam, datum: s.gestart, procent: pct(s.beurten.filter((b) => b.juist).length, s.beurten.length), beurten: s.beurten.length }));

  // Per onderwerp (categorie van de vraag) en per vraag, over alle spellen.
  const onderwerpen = new Map<string, { naam: string; juist: number; totaal: number }>();
  const vragen = new Map<string, { tekst: string; set: string; juist: number; totaal: number }>();
  for (const s of sessies) {
    for (const b of s.beurten) {
      const v = s.vragen.find((x) => x.id === b.vraagId);
      if (!v) continue;
      const naam = v.categorie.trim() || 'Zonder onderwerp';
      const o = onderwerpen.get(naam.toLocaleLowerCase('nl')) ?? { naam, juist: 0, totaal: 0 };
      o.totaal++;
      if (b.juist) o.juist++;
      onderwerpen.set(naam.toLocaleLowerCase('nl'), o);
      const sleutel = `${s.setId}\u0000${v.id}`;
      const q = vragen.get(sleutel) ?? { tekst: v.tekst, set: s.setTitel, juist: 0, totaal: 0 };
      q.totaal++;
      if (b.juist) q.juist++;
      vragen.set(sleutel, q);
    }
  }
  const perOnderwerp = [...onderwerpen.values()]
    .map((o) => ({ onderwerp: o.naam, procent: pct(o.juist, o.totaal), beurten: o.totaal }))
    .sort((a, b) => a.procent - b.procent || b.beurten - a.beurten);
  const moeilijkst = [...vragen.values()]
    .filter((q) => q.totaal >= 3)
    .map((q) => ({ tekst: q.tekst, set: q.set, procent: pct(q.juist, q.totaal), beurten: q.totaal }))
    .sort((a, b) => a.procent - b.procent || b.beurten - a.beurten)
    .slice(0, 5);

  // Leerlingen: enkel wie genoeg beurten had.
  const alle = overzichtPerLeerling(sessies);
  const genoeg: Leerling[] = alle
    .filter((o) => o.beurten >= MIN_BEURTEN)
    .map((o) => ({ naam: o.naam, klas: o.klas, procent: procentJuist(o) ?? 0, beurten: o.beurten, spellen: o.spellen }));
  const sterkst = genoeg
    .filter((l) => l.procent >= 60)
    .sort((a, b) => b.procent - a.procent || b.beurten - a.beurten)
    .slice(0, 5);
  const aandacht = [...genoeg]
    .filter((l) => l.procent < 60)
    .sort((a, b) => a.procent - b.procent || b.beurten - a.beurten)
    .slice(0, 5);

  // Vooruitgang: eerste helft van de beurten (in tijd) tegenover de tweede helft.
  const beurtenPer = new Map<string, { naam: string; klas: string; juist: boolean[] }>();
  for (const s of chronologisch) {
    for (const b of s.beurten) {
      if (b.leerlingId === null) continue;
      const naam = leerlingNaam(s, b.leerlingId);
      const sleutel = `${s.klasNaam}\u0000${naam.toLocaleLowerCase('nl')}`;
      const l = beurtenPer.get(sleutel) ?? { naam, klas: s.klasNaam, juist: [] };
      l.juist.push(b.juist);
      beurtenPer.set(sleutel, l);
    }
  }
  const vooruitgang = [...beurtenPer.values()]
    .filter((l) => l.juist.length >= 2 * MIN_BEURTEN)
    .map((l) => {
      const helft = Math.floor(l.juist.length / 2);
      const eerste = l.juist.slice(0, helft);
      const tweede = l.juist.slice(helft);
      return { naam: l.naam, klas: l.klas, voor: pct(eerste.filter(Boolean).length, eerste.length), na: pct(tweede.filter(Boolean).length, tweede.length) };
    })
    .filter((v) => v.na > v.voor)
    .sort((a, b) => b.na - b.voor - (a.na - a.voor))
    .slice(0, 5);

  // Deelname: wie was het minst aanwezig (afwezigen staan bij de start niet in de teams).
  const spellenPerKlas = new Map<string, number>();
  const aanwezig = new Map<string, { naam: string; klas: string; spellen: number }>();
  for (const s of sessies) {
    spellenPerKlas.set(s.klasNaam, (spellenPerKlas.get(s.klasNaam) ?? 0) + 1);
    for (const l of new Map(s.teams.flatMap((t) => t.leerlingen).map((l) => [l.naam.toLocaleLowerCase('nl'), l])).values()) {
      const sleutel = `${s.klasNaam}\u0000${l.naam.toLocaleLowerCase('nl')}`;
      const a = aanwezig.get(sleutel) ?? { naam: l.naam, klas: s.klasNaam, spellen: 0 };
      a.spellen++;
      aanwezig.set(sleutel, a);
    }
  }
  const deelname = [...aanwezig.values()]
    .map((a) => ({ ...a, van: spellenPerKlas.get(a.klas) ?? 0 }))
    .filter((d) => d.van >= 2 && d.spellen < d.van)
    .sort((a, b) => a.spellen / a.van - b.spellen / b.van || a.naam.localeCompare(b.naam, 'nl'))
    .slice(0, 5);

  return { perSpel, perOnderwerp, moeilijkst, sterkst, aandacht, vooruitgang, deelname };
}
