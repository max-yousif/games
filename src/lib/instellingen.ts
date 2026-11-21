import type { SpelType } from './types';

/**
 * Instellingen van stap 4 op de Spelen-pagina, onthouden per spel en klas (in deze browser).
 * Ze worden bewaard bij het starten; zonder bewaarde instellingen voor die klas gelden de laatste
 * van dat spel.
 */
export type SpelInstellingen = Partial<{
  aantal: number;
  timer: number | null;
  snelheidsbonus: boolean;
  willekeurig: boolean;
  vrijeNaam: boolean;
  dubbel: boolean;
  bomTijd: string;
  aantalGrafieken: number;
  stukjes: number;
  harten: number;
  perBeurt: number;
  klasTijd: number;
  basissen: string[];
  transformaties: string[];
  hacken: boolean;
  tekenSeconden: number;
  territoriumModus: string;
  kleurplaat: string;
  escapeMinuten: number | null;
  wachttijd: number;
  aantalSloten: number;
  strafTijd: number;
}>;

export const INSTELLINGEN = 'games.v1.instellingen';

const getal = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const SOORT: Record<keyof SpelInstellingen, (x: unknown) => boolean> = {
  aantal: getal,
  timer: (x) => x === null || getal(x),
  snelheidsbonus: (x) => typeof x === 'boolean',
  willekeurig: (x) => typeof x === 'boolean',
  vrijeNaam: (x) => typeof x === 'boolean',
  dubbel: (x) => typeof x === 'boolean',
  bomTijd: (x) => typeof x === 'string',
  aantalGrafieken: getal,
  stukjes: getal,
  harten: getal,
  perBeurt: getal,
  klasTijd: getal,
  basissen: (x) => Array.isArray(x) && x.every((y) => typeof y === 'string'),
  transformaties: (x) => Array.isArray(x) && x.every((y) => typeof y === 'string'),
  hacken: (x) => typeof x === 'boolean',
  tekenSeconden: getal,
  territoriumModus: (x) => typeof x === 'string',
  kleurplaat: (x) => typeof x === 'string',
  escapeMinuten: (x) => x === null || getal(x),
  wachttijd: getal,
  aantalSloten: getal,
  strafTijd: getal,
};

/** Enkel gekende velden met het juiste soort waarde (de opslag kan oud of beschadigd zijn). */
export function zuiver(ruw: unknown): SpelInstellingen {
  if (!ruw || typeof ruw !== 'object') return {};
  const uit: Record<string, unknown> = {};
  for (const [k, ok] of Object.entries(SOORT)) {
    const v = (ruw as Record<string, unknown>)[k];
    if (v !== undefined && ok(v)) uit[k] = v;
  }
  return uit as SpelInstellingen;
}

function leesAlles(): Record<string, unknown> {
  try {
    const alles = JSON.parse(localStorage.getItem(INSTELLINGEN) ?? '{}') as unknown;
    return alles && typeof alles === 'object' && !Array.isArray(alles) ? (alles as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** '' = zonder klas. */
const sleutel = (spel: SpelType, klasId: string) => `${spel}:${klasId}`;

/** De instellingen voor dit spel en deze klas, anders de laatst gebruikte van dit spel, anders {}. */
export function leesInstellingen(spel: SpelType, klasId: string): SpelInstellingen {
  const alles = leesAlles();
  return zuiver(alles[sleutel(spel, klasId)] ?? alles[spel]);
}

export function bewaarInstellingen(spel: SpelType, klasId: string, inst: SpelInstellingen) {
  try {
    const alles = leesAlles();
    const schoon = zuiver(inst);
    alles[sleutel(spel, klasId)] = schoon;
    alles[spel] = schoon;
    localStorage.setItem(INSTELLINGEN, JSON.stringify(alles));
  } catch {
    // geen opslag: dan onthoudt de pagina niets
  }
}
