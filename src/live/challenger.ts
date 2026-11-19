/**
 * Challenger: één leerling (de challenger) tegen de rest van de klas. Per vraag antwoordt eerst de
 * klas, dan de challenger alleen. Challenger juist: wie in de klas fout of niets antwoordde, vliegt
 * eruit ("GET OUT!") naar de Comeback Zone, en de challenger krijgt een punt per uitgeschakelde.
 * Challenger fout: een hart minder. Wie in de Comeback Zone twee keer na elkaar juist antwoordt,
 * komt terug in de klas. Alles hier is puur; het bord bewaart de toestand en kijkt na.
 *
 * Vraagnummers op de server: per vraag q drie nummers, 3q (de klas), 3q + 1 (de challenger) en
 * 3q + 2 (tweede kans van de challenger).
 */

export type Hulplijn = 'peiling' | 'copycat' | 'tweede';
export const HULPLIJNEN: { id: Hulplijn; icoon: string; naam: string }[] = [
  { id: 'peiling', icoon: '📊', naam: 'Wat denkt de klas?' },
  { id: 'copycat', icoon: '🐱', naam: 'Copycat' },
  { id: 'tweede', icoon: '🎯', naam: 'Tweede kans' },
];

export type Fase = 'klas' | 'challenger' | 'tweede';
export const FASEN: Fase[] = ['klas', 'challenger', 'tweede'];
export const nummer = (q: number, fase: Fase) => q * 3 + FASEN.indexOf(fase);
export const uitNummer = (nr: number): { q: number; fase: Fase } => ({ q: Math.floor(nr / 3), fase: FASEN[nr % 3] });

/** Instellingen; ook de leerlingen krijgen ze (in de sessie op de server). */
export interface ChallengerInstellingen {
  versie: 1;
  /** Harten van de challenger bij het begin van een beurt (2–4). */
  harten: number;
  /** Vragen per beurt; 0 = tot de harten op zijn of iedereen eruit ligt. */
  perBeurt: number;
  /** Seconden voor de klas per vraag. */
  klasTijd: number;
}

/** Wat bij een vraag op de server staat, naast de vraag zelf. */
export interface ChallengerVraag {
  fase: Fase;
  challengerId: string;
  challengerNaam: string;
  /** Vraag in de beurt (1, 2 ...). */
  nr: number;
  /** Klasfase: seconden om te antwoorden. */
  tijd?: number;
  inzet?: boolean;
  tweedeKans?: boolean;
  /** Hulplijnen voor de challenger. */
  peiling?: { tekst: string; procent: number }[];
  copycat?: { naam: string; antwoord: string } | null;
}

/** Het resultaat van een vraag (op de server bij de oplossing). */
export interface Uitslag {
  challengerId: string;
  challengerJuist: boolean;
  /** Uit de klas gevlogen en terug in de klas gekomen (speler-id's). */
  getOut: string[];
  comeback: string[];
  /** Punten per speler voor deze vraag (ook bonussen). */
  punten: Record<string, number>;
  harten: number;
  /** De beurt is voorbij: harten op, iedereen eruit, of de vragen van de beurt zijn op. */
  einde: null | 'harten' | 'gewonnen' | 'ronde';
  tekst: string;
}

export interface Toestand {
  beurt: number;
  challengerId: string | null;
  harten: number;
  /** Gespeelde vragen in deze beurt. */
  vragen: number;
  inzetGebruikt: boolean;
  /** Wie in de Comeback Zone zit, met het aantal juiste antwoorden na elkaar. */
  zone: Record<string, number>;
  score: Record<string, number>;
  /** Gebruikte hulplijnen per leerling (elk maar één keer in het hele spel). */
  hulp: Record<string, Hulplijn[]>;
  /** Weetjes voor het einde. */
  knockoutsDezeBeurt: number;
  meesteKnockouts: { id: string; aantal: number } | null;
  langsteBeurt: { id: string; vragen: number } | null;
  klasZeges: number;
}

export const BONUS = 5;

export function beginToestand(): Toestand {
  return {
    beurt: 0,
    challengerId: null,
    harten: 0,
    vragen: 0,
    inzetGebruikt: false,
    zone: {},
    score: {},
    hulp: {},
    knockoutsDezeBeurt: 0,
    meesteKnockouts: null,
    langsteBeurt: null,
    klasZeges: 0,
  };
}

/** Een nieuwe challenger: iedereen terug in de klas, de harten vol. */
export function nieuweBeurt(t: Toestand, challengerId: string, inst: Pick<ChallengerInstellingen, 'harten'>): Toestand {
  return { ...t, beurt: t.beurt + 1, challengerId, harten: inst.harten, vragen: 0, inzetGebruikt: false, zone: {}, knockoutsDezeBeurt: 0 };
}

export const kanHulp = (t: Toestand, id: string, h: Hulplijn) => !(t.hulp[id] ?? []).includes(h);
export const gebruikHulp = (t: Toestand, id: string, h: Hulplijn): Toestand => ({ ...t, hulp: { ...t.hulp, [id]: [...(t.hulp[id] ?? []), h] } });

/** Wie in de klas zit: iedereen behalve de challenger en de Comeback Zone. */
export const inDeKlas = (t: Toestand, spelers: readonly string[]) => spelers.filter((id) => id !== t.challengerId && !(id in t.zone));

export interface VraagInvoer {
  /** Alle spelers die meedoen (verbonden). */
  spelers: string[];
  /** Antwoorden van de klas en de Comeback Zone: juist of niet (geen antwoord = ontbreekt). */
  juist: Record<string, boolean>;
  /** De antwoorden van de challenger, in volgorde (één, of twee met de tweede kans). */
  challenger: boolean[];
  inzet: boolean;
  tweedeKans: boolean;
  namen: Record<string, string>;
}

const opsomming = (namen: string[]) => (namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`);

/** Kijkt een vraag af: wie eruit vliegt, wie terugkomt, punten, harten en het einde van de beurt. */
export function verwerkVraag(t: Toestand, inv: VraagInvoer, inst: Pick<ChallengerInstellingen, 'perBeurt'>): { toestand: Toestand; uitslag: Uitslag } {
  const cid = t.challengerId!;
  const naam = (id: string) => inv.namen[id] ?? '?';
  const klas = inDeKlas(t, inv.spelers);
  const punten: Record<string, number> = {};
  const plus = (id: string, n: number) => (punten[id] = (punten[id] ?? 0) + n);
  for (const id of inv.spelers) if (id !== cid && inv.juist[id]) plus(id, 1);

  const challengerJuist = inv.tweedeKans ? inv.challenger.slice(0, 2).some(Boolean) : inv.challenger[0] === true;
  let harten = t.harten;
  let getOut: string[] = [];
  if (challengerJuist) {
    getOut = klas.filter((id) => !inv.juist[id]);
    if (getOut.length) plus(cid, getOut.length * (inv.inzet ? 2 : 1));
  } else if (inv.tweedeKans && inv.challenger.length >= 2) harten = 0;
  else harten -= inv.inzet ? 2 : 1;
  harten = Math.max(0, harten);

  // Comeback Zone: twee keer na elkaar juist = terug in de klas.
  const zone: Record<string, number> = {};
  const comeback: string[] = [];
  for (const [id, reeks] of Object.entries(t.zone)) {
    if (!inv.spelers.includes(id)) {
      zone[id] = reeks;
      continue;
    }
    const nieuw = inv.juist[id] ? reeks + 1 : 0;
    if (nieuw >= 2) comeback.push(id);
    else zone[id] = nieuw;
  }
  for (const id of getOut) zone[id] = 0;
  const klasNa = klas.filter((id) => !getOut.includes(id)).length + comeback.length;

  const vragen = t.vragen + 1;
  let einde: Uitslag['einde'] = null;
  if (klasNa === 0 && klas.length > 0) {
    einde = 'gewonnen';
    plus(cid, BONUS);
  } else if (harten <= 0) {
    einde = 'harten';
    for (const id of inv.spelers) if (id !== cid && !(id in zone)) plus(id, BONUS);
  } else if (inst.perBeurt > 0 && vragen >= inst.perBeurt) einde = 'ronde';

  const score = { ...t.score };
  for (const [id, n] of Object.entries(punten)) score[id] = (score[id] ?? 0) + n;
  const knockouts = t.knockoutsDezeBeurt + getOut.length;
  const toestand: Toestand = {
    ...t,
    harten,
    vragen,
    inzetGebruikt: t.inzetGebruikt || inv.inzet,
    zone,
    score,
    knockoutsDezeBeurt: knockouts,
    meesteKnockouts: knockouts > (t.meesteKnockouts?.aantal ?? 0) ? { id: cid, aantal: knockouts } : t.meesteKnockouts,
    langsteBeurt: vragen > (t.langsteBeurt?.vragen ?? 0) ? { id: cid, vragen } : t.langsteBeurt,
    klasZeges: t.klasZeges + (einde === 'harten' ? 1 : 0),
  };

  const delen: string[] = [];
  if (challengerJuist) {
    delen.push(`${naam(cid)} heeft juist!`);
    delen.push(getOut.length ? `GET OUT, ${opsomming(getOut.map(naam))}!` : 'Niemand vliegt eruit.');
  } else delen.push(harten <= 0 ? `${naam(cid)} heeft het fout en heeft geen harten meer.` : `${naam(cid)} heeft het fout en verliest ${inv.inzet ? 'twee harten' : 'een hart'}.`);
  if (comeback.length) delen.push(`COMEBACK voor ${opsomming(comeback.map(naam))}!`);
  if (einde === 'gewonnen') delen.push(`${naam(cid)} verslaat de hele klas! +${BONUS}`);
  if (einde === 'harten') delen.push(`De klas wint! Wie nog in de klas zit: +${BONUS}`);

  return { toestand, uitslag: { challengerId: cid, challengerJuist, getOut, comeback, punten, harten, einde, tekst: delen.join(' ') } };
}

/** Wat denkt de klas? Hoeveel procent elk antwoord koos (de klas, niet de Comeback Zone). */
export function peiling(antwoorden: readonly { antwoord: string }[], tekstVan: (a: string) => string): { tekst: string; procent: number }[] {
  const tel = new Map<string, number>();
  for (const a of antwoorden) {
    const t = tekstVan(a.antwoord);
    tel.set(t, (tel.get(t) ?? 0) + 1);
  }
  const totaal = antwoorden.length || 1;
  return [...tel.entries()].map(([tekst, n]) => ({ tekst, procent: Math.round((n / totaal) * 100) })).sort((a, b) => b.procent - a.procent);
}
