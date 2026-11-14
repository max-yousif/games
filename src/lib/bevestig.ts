/**
 * Eigen bevestigingsvenster i.p.v. `confirm()`: `await bevestig('…')` geeft true bij "ja".
 * Vragen die tegelijk komen, worden na elkaar getoond. Het venster zelf staat in
 * `components/BevestigVenster.tsx`.
 */
export interface BevestigOpties {
  /** Tekst op de knop om te bevestigen (standaard "OK"). */
  ja?: string;
  /** Rode knop en de focus op "Annuleren" (voor verwijderen en dergelijke). */
  gevaarlijk?: boolean;
}

export interface Vraag {
  id: number;
  tekst: string;
  ja: string;
  gevaarlijk: boolean;
}

let rij: (Vraag & { klaar: (ok: boolean) => void })[] = [];
let volgendId = 1;
const luisteraars = new Set<() => void>();
const meld = () => luisteraars.forEach((f) => f());

export function bevestig(tekst: string, opties: BevestigOpties = {}): Promise<boolean> {
  return new Promise((klaar) => {
    rij = [...rij, { id: volgendId++, tekst, ja: opties.ja ?? 'OK', gevaarlijk: !!opties.gevaarlijk, klaar }];
    meld();
  });
}

/** De vraag die nu getoond wordt (de oudste nog onbeantwoorde). */
export function huidigeVraag(): Vraag | undefined {
  return rij[0];
}

/** Beantwoordt de getoonde vraag; daarna verschijnt de volgende. */
export function beantwoord(ok: boolean) {
  const [eerste, ...rest] = rij;
  if (!eerste) return;
  rij = rest;
  meld();
  eerste.klaar(ok);
}

export function luisterNaarVragen(f: () => void): () => void {
  luisteraars.add(f);
  return () => luisteraars.delete(f);
}
