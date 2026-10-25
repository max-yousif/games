export type Stuk =
  | { soort: 'tekst'; tekst: string }
  | { soort: 'formule'; tex: string; blok: boolean }
  | { soort: 'code'; code: string; blok: boolean };

/**
 * Splitst vraagtekst in stukken: ```codeblokken```, `code`, $$formule$$ en $formule$.
 * Een \$ blijft een gewoon dollarteken. Een niet-afgesloten $ of ` blijft gewone tekst.
 */
export function splitsTekst(input: string): Stuk[] {
  const stukken: Stuk[] = [];
  let tekst = '';
  const flush = () => {
    if (tekst) stukken.push({ soort: 'tekst', tekst });
    tekst = '';
  };

  let i = 0;
  while (i < input.length) {
    if (input.startsWith('\\$', i)) {
      tekst += '$';
      i += 2;
      continue;
    }
    const match =
      blok(input, i, '```', (inhoud) => ({ soort: 'code', code: inhoud.replace(/^[a-zA-Z]*\n/, '').replace(/\n$/, ''), blok: true })) ??
      blok(input, i, '`', (inhoud) => ({ soort: 'code', code: inhoud, blok: false })) ??
      blok(input, i, '$$', (inhoud) => ({ soort: 'formule', tex: inhoud.trim(), blok: true })) ??
      blok(input, i, '$', (inhoud) => ({ soort: 'formule', tex: inhoud.trim(), blok: false }));
    if (match) {
      flush();
      stukken.push(match.stuk);
      i = match.einde;
    } else {
      tekst += input[i];
      i++;
    }
  }
  flush();
  return stukken;
}

function blok(input: string, i: number, teken: string, maak: (inhoud: string) => Stuk): { stuk: Stuk; einde: number } | null {
  if (!input.startsWith(teken, i)) return null;
  let j = i + teken.length;
  for (;;) {
    j = input.indexOf(teken, j);
    if (j === -1) return null;
    // Een \$ binnen een formule hoort bij de formule.
    if (teken.startsWith('$') && input[j - 1] === '\\') {
      j += 1;
      continue;
    }
    break;
  }
  const inhoud = input.slice(i + teken.length, j);
  if (!inhoud.trim()) return null;
  return { stuk: maak(inhoud), einde: j + teken.length };
}
