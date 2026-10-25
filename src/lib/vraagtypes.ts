import type { Vraag, VraagType } from './types';

export const VRAAG_TYPES: { type: VraagType; icoon: string; naam: string; uitleg: string }[] = [
  { type: 'open', icoon: '✏️', naam: 'Open vraag', uitleg: 'Leerling schrijft of zegt het antwoord.' },
  { type: 'meerkeuze', icoon: '🔘', naam: 'Meerkeuze', uitleg: 'Kies het juiste antwoord uit 2 tot 8 opties.' },
  { type: 'waaronwaar', icoon: '⚖️', naam: 'Waar of onwaar', uitleg: 'Is de stelling waar of onwaar?' },
  { type: 'getal', icoon: '🔢', naam: 'Getal', uitleg: 'Het antwoord is een getal, eventueel met een foutmarge.' },
  { type: 'invullen', icoon: '🧩', naam: 'Invullen', uitleg: 'Vul de ontbrekende woorden, getallen of code in.' },
  { type: 'ordenen', icoon: '↕️', naam: 'Ordenen', uitleg: 'Zet de stappen of codelijnen in de juiste volgorde.' },
  { type: 'koppelen', icoon: '🔗', naam: 'Koppelen', uitleg: 'Verbind wat bij elkaar hoort.' },
];

export const typeNaam = (t: VraagType) => VRAAG_TYPES.find((x) => x.type === t)?.naam ?? t;

export const WAAR_ONWAAR = ['Waar', 'Onwaar'];

/** Opties zoals ze getoond worden bij meerkeuze en waar/onwaar. */
export function keuzeOpties(v: Vraag): string[] {
  return v.type === 'waaronwaar' ? WAAR_ONWAAR : v.opties;
}

export const isKeuzeVraag = (v: Pick<Vraag, 'type'>) => v.type === 'meerkeuze' || v.type === 'waaronwaar';

// ---------- Invullen ----------

const GAT = /\[\[([^\]]*?)\]\]/g;

/** De gaten in een invultekst; per gat de toegelaten antwoorden (gescheiden door |). */
export function gatenVan(tekst: string): string[][] {
  return [...tekst.matchAll(GAT)].map((m) =>
    m[1]
      .split('|')
      .map((a) => a.trim())
      .filter(Boolean),
  );
}

/**
 * Merkteken van een gat in de tekst. RichText toont het als een gekleurd symbool (★, ●, ▲ ...),
 * zodat het niet te verwarren is met cijfers in een formule of in code.
 */
export const gatLabel = (i: number) => `⟦${i + 1}⟧`;
export const GAT_MERK = /⟦(\d+)⟧/g;

export const GAT_SYMBOLEN = ['★', '●', '▲', '■', '◆', '♥', '✚', '⬢'];
export const GAT_KLEUREN = ['#f59e0b', '#0ea5e9', '#10b981', '#f43f5e', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899'];
export const gatSymbool = (i: number) => GAT_SYMBOLEN[i % GAT_SYMBOLEN.length];
export const gatKleur = (i: number) => GAT_KLEUREN[i % GAT_KLEUREN.length];

/** Merktekens vervangen door het symbool (voor Excel en gewone tekst). */
export const gatenAlsTekst = (t: string) => t.replace(GAT_MERK, (_, n: string) => gatSymbool(Number(n) - 1));

/** Vervangt de gaten door merktekens (getoond als ★, ●, ▲ ...) of door de ingevulde antwoorden. */
export function tekstMetGaten(tekst: string, invul?: readonly string[]): string {
  let i = 0;
  return tekst.replace(GAT, () => {
    const n = i++;
    return invul ? invul[n] ?? '' : gatLabel(n);
  });
}

// ---------- Getallen ----------

/**
 * Leest een getal zoals leerlingen het typen: "12,5", "-3", "1/4", "x = 7", "2 500", "$0{,}15$", "3,5 cm".
 * Geeft null als het geen getal is.
 */
export function leesGetal(invoer: string): number | null {
  let t = invoer
    .replace(/[$`]/g, '')
    .replace(/\{,\}/g, ',')
    .replace(/\\[,;! ]/g, '')
    .replace(/\\dfrac|\\tfrac|\\frac/g, '\\frac')
    .trim();
  t = t.replace(/^[a-zA-Z]\s*=\s*/, '');
  const breuk = t.match(/^\\frac\{(.+?)\}\{(.+?)\}$/);
  if (breuk) t = `${breuk[1]}/${breuk[2]}`;
  t = t.replace(/(\d)\s+(?=\d{3}\b)/g, '$1').replace(/\s*(%|[a-zA-Zµ°²³]+)$/, '');
  t = t.replace(',', '.').replace(/\s+/g, '').replace('−', '-');
  const deel = t.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (deel) {
    const n = Number(deel[2]);
    return n === 0 ? null : Number(deel[1]) / n;
  }
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t) ? Number(t) : null;
}

export function getalJuist(invoer: string, doel: string, tolerantie = 0): boolean {
  const a = leesGetal(invoer);
  const d = leesGetal(doel);
  if (a === null || d === null) return false;
  // Kleine speling voor afrondingsfouten (1,27 − 1,26 is in de computer net meer dan 0,01).
  return Math.abs(a - d) <= tolerantie + 1e-9 * Math.max(1, Math.abs(d));
}

// ---------- Ordenen en koppelen ----------

/** Pseudo-willekeurige generator met een vaste startwaarde (mulberry32). */
function generator(zaad: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < zaad.length; i++) h = Math.imul(h ^ zaad.charCodeAt(i), 3432918353);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Schudt items altijd op dezelfde manier voor hetzelfde zaad (zodat het bord en de laptops
 * dezelfde volgorde tonen), en nooit in de oorspronkelijke volgorde (als dat kan).
 */
export function vastGeschud<T>(items: readonly T[], zaad: string): T[] {
  const r = generator(zaad);
  const uit = [...items];
  for (let i = uit.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [uit[i], uit[j]] = [uit[j], uit[i]];
  }
  const zelfde = uit.every((x, i) => x === items[i]);
  const allesGelijk = items.every((x) => x === items[0]);
  if (zelfde && items.length > 1 && !allesGelijk) uit.push(uit.shift()!);
  return uit;
}

/** Ordenen: de items in de volgorde waarin ze getoond worden. */
export const ordenenGetoond = (v: Vraag) => vastGeschud(v.opties, `${v.id}:ordenen`);

/** Koppelen: de rechterkolom in de volgorde waarin ze getoond wordt. */
export const koppelenRechts = (v: Vraag) =>
  vastGeschud(
    (v.paren ?? []).map((p) => p[1]),
    `${v.id}:koppelen`,
  );

export const LETTERS = 'ABCDEFGHIJKLMNOP';
