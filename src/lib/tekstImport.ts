import { newId } from './ids';
import type { ImportItem } from './importFile';
import { shuffle } from './random';
import type { Vraag } from './types';

/**
 * Snel vragen typen of plakken (bv. uit Word of uit een AI-chatbot), één vraag per blok:
 *
 *   # Machten                     ← categorie voor de vragen eronder
 *   Bereken: $(-3)^{-2}$          ← de vraag (mag meerdere lijnen zijn)
 *   * $\frac{1}{9}$               ← juist antwoord (meerkeuze); + mag ook
 *   - $-9$                        ← fout antwoord
 *   > Negatieve exponent: omgekeerde.   ← uitleg (optioneel)
 *
 *   Ontbind: $x^2-49$
 *   = $(x-7)(x+7)$                ← antwoord (open vraag); meerdere = lijnen: ook juist
 *
 * Verder: "= waar" of "= onwaar" (waar of onwaar), "= 6,67 ± 0,01" (getal met foutmarge),
 * "= links -> rechts" op elke lijn (koppelen), een vraag met [[gaten]] (invullen) en
 * "(200)" achteraan de eerste lijn voor het aantal punten. Blokken worden gescheiden door een lege lijn.
 */
export const TEKST_VOORBEELD = `# Machten
Bereken: $(-3)^{-2}$ (200)
* $\\frac{1}{9}$
- $-9$
- $9$
- $-\\frac{1}{9}$
> Negatieve exponent: neem het omgekeerde.

$2^3 \\cdot 2^2 = 2^6$
= onwaar
> Exponenten optellen: $2^5$

# Ontbinden
Ontbind: $x^2-49$
= $(x-7)(x+7)$
= $(x+7)(x-7)$

Bereken het gemiddelde van 4, 7 en 9.
= 6,67 ± 0,01

# Python
Vul aan: \`for i in [[range]](3):\`

Koppel elk voorschrift aan de grafiek.
= $y=x^2$ -> dalparabool
= $y=-x^2$ -> bergparabool`;

/** Opdracht om vragen te laten maken door een AI-chatbot, in het formaat hierboven. */
export function aiOpdracht(onderwerp: string): string {
  return `Maak 10 toetsvragen voor leerlingen secundair onderwijs over: ${onderwerp || '[onderwerp en leerjaar]'}.
Gebruik EXACT dit formaat, zonder extra uitleg of opmaak (geen vetjes, geen nummering, geen codeblok rond het geheel):

# Categorie (kort, bv. Machten)
Vraag (wiskunde tussen $...$ in LaTeX, Python-code tussen \`...\`)
* juist antwoord
- fout antwoord
- fout antwoord
- fout antwoord
> korte uitleg

Regels:
- Zet een lege lijn tussen twee vragen.
- Meerkeuze: precies één lijn met * en twee of drie lijnen met -.
- Open vraag: geen * of -, maar een lijn "= antwoord" (meerdere = lijnen als er meerdere schrijfwijzen juist zijn).
- Waar of onwaar: "= waar" of "= onwaar".
- Getal met foutmarge: "= 6,67 ± 0,01".
- Wissel meerkeuze, open vragen en waar/onwaar af.`;
}

const PUNTEN = /\s*\((\d{2,4})\)\s*$/;
const OPTIE = /^([*+-])\s+(.*)$/;

/** Leest vragen uit tekst in het formaat hierboven. */
export function tekstNaarVragen(tekst: string): ImportItem[] {
  const items: ImportItem[] = [];
  let categorie = '';
  const lijnen = tekst.replace(/^﻿/, '').split(/\r?\n/);
  let blok: { lijnen: string[]; start: number } | null = null;

  const verwerk = () => {
    if (!blok) return;
    const { lijnen: l, start } = blok;
    blok = null;
    const bron = `lijn ${start}`;
    const vraagLijnen: string[] = [];
    const juist: string[] = [];
    const fout: string[] = [];
    const antwoorden: string[] = [];
    const uitleg: string[] = [];
    // In een codeblok (```) is elke lijn deel van de vraag.
    let inCode = false;
    for (const [i, lijn] of l.entries()) {
      const t = lijn.trim();
      if (t.startsWith('```')) inCode = !inCode;
      const optie = !inCode && i > 0 ? OPTIE.exec(t) : null;
      if (optie) (optie[1] === '-' ? fout : juist).push(optie[2].trim());
      else if (!inCode && i > 0 && /^=\s*/.test(t)) antwoorden.push(t.replace(/^=\s*/, ''));
      else if (!inCode && i > 0 && /^>\s*/.test(t)) uitleg.push(t.replace(/^>\s*/, ''));
      else if (juist.length || fout.length || antwoorden.length) {
        items.push({ bron, fout: `Bij de vraag op ${bron} staat tekst na de antwoorden: "${t}". Zet een lege lijn tussen twee vragen.` });
        return;
      } else vraagLijnen.push(lijn.replace(/\s+$/, ''));
    }
    let vraagTekst = vraagLijnen.join('\n').trim();
    let punten = 100;
    const p = PUNTEN.exec(vraagLijnen[0] ?? '');
    if (p) {
      punten = Number(p[1]);
      vraagTekst = [vraagLijnen[0].replace(PUNTEN, ''), ...vraagLijnen.slice(1)].join('\n').trim();
    }
    const v: Vraag = {
      id: newId(),
      categorie,
      punten,
      type: 'open',
      tekst: vraagTekst,
      antwoord: '',
      opties: ['', '', '', ''],
      juisteOptie: 0,
      uitleg: uitleg.join('\n'),
    };

    if (juist.length || fout.length) {
      if (juist.length !== 1) {
        items.push({ bron, fout: `De meerkeuzevraag op ${bron} moet precies één juist antwoord hebben (een lijn met *).` });
        return;
      }
      const opties = shuffle([juist[0], ...fout]);
      items.push({ bron, vraag: { ...v, type: 'meerkeuze', opties, juisteOptie: opties.indexOf(juist[0]) } });
    } else if (antwoorden.length === 1 && /^(waar|onwaar|juist|fout)$/i.test(antwoorden[0])) {
      items.push({ bron, vraag: { ...v, type: 'waaronwaar', juisteOptie: /^(onwaar|fout)$/i.test(antwoorden[0]) ? 1 : 0 } });
    } else if (antwoorden.length === 1 && /^-?[\d.,]+\s*(±|\+-|\+\/-)\s*[\d.,]+$/.test(antwoorden[0])) {
      const [getal, marge] = antwoorden[0].split(/\s*(?:±|\+-|\+\/-)\s*/);
      items.push({ bron, vraag: { ...v, type: 'getal', antwoord: getal, tolerantie: Math.abs(Number(marge.replace(',', '.'))) || 0 } });
    } else if (antwoorden.length >= 2 && antwoorden.every((a) => /\s(->|→)\s/.test(a))) {
      const paren = antwoorden.map((a) => {
        const [links, ...rest] = a.split(/\s*(?:->|→)\s*/);
        return [links.trim(), rest.join(' -> ').trim()] as [string, string];
      });
      items.push({ bron, vraag: { ...v, type: 'koppelen', paren } });
    } else if (antwoorden.length === 0 && /\[\[.+?\]\]/.test(vraagTekst)) {
      items.push({ bron, vraag: { ...v, type: 'invullen' } });
    } else {
      const [eerste = '', ...rest] = antwoorden;
      items.push({ bron, vraag: { ...v, antwoord: eerste, ...(rest.length ? { alternatieven: rest } : {}) } });
    }
  };

  let inCode = false;
  lijnen.forEach((lijn, i) => {
    const t = lijn.trim();
    if (t.startsWith('```')) inCode = !inCode;
    if (!inCode && t === '') {
      verwerk();
      return;
    }
    if (!inCode && !blok && /^#+\s/.test(t)) {
      categorie = t.replace(/^#+\s*/, '');
      return;
    }
    if (!blok) blok = { lijnen: [], start: i + 1 };
    blok.lijnen.push(lijn);
  });
  verwerk();
  return items;
}

/** Ziet de geplakte tekst eruit als een tabel (uit Excel, Google Sheets of Word)? */
export const lijktTabel = (tekst: string) => tekst.split(/\r?\n/).filter((l) => l.includes('\t')).length >= Math.max(1, tekst.trim().split(/\r?\n/).length / 2);
