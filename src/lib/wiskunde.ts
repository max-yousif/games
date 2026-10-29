/**
 * Wiskundige uitdrukkingen vergelijken door ze uit te rekenen: zo is $\frac{1}{12}\operatorname{Bgtan}(\sin^2 4x)+C$
 * gelijk aan "Bgtan(sin(4x)^2)/12", hoe de leerling het ook schrijft. Gebruikt voor open vragen
 * waarbij "elke gelijkwaardige uitdrukking" juist is (bv. integralen bij Cluedo).
 *
 * Werkt met LaTeX (zoals de wiskunde-editor het geeft) en met gewone tekst. Eén veranderlijke x;
 * constanten e, π en de integratieconstante C. Lukt het niet om te lezen, dan geeft het null.
 */

type Knoop =
  | { t: 'getal'; w: number }
  | { t: 'x' }
  | { t: 'C' }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^'; a: Knoop; b: Knoop }
  | { t: 'min'; a: Knoop }
  | { t: 'f'; f: string; a: Knoop }
  | { t: 'wortel'; n: Knoop; a: Knoop };

const FUNCTIES: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => 1 / Math.tan(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  acot: (x) => Math.PI / 2 - Math.atan(x),
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
};

/** Namen zoals leerlingen en leerkrachten ze schrijven, naar de namen hierboven. */
const SYNONIEMEN: [string, string][] = [
  ['bgsin', 'asin'],
  ['bgcos', 'acos'],
  ['bgtan', 'atan'],
  ['bgcot', 'acot'],
  ['arcsin', 'asin'],
  ['arccos', 'acos'],
  ['arctan', 'atan'],
  ['arccot', 'acot'],
  ['elog', 'ln'],
  ['cotg', 'cot'],
  ['tg', 'tan'],
];

/** Haalt de inhoud tussen accolades vanaf positie i (op '{'); geeft [inhoud, positie na '}']. */
function accolades(t: string, i: number): [string, number] | null {
  if (t[i] !== '{') return null;
  let diepte = 0;
  for (let j = i; j < t.length; j++) {
    if (t[j] === '{') diepte++;
    else if (t[j] === '}' && --diepte === 0) return [t.slice(i + 1, j), j + 1];
  }
  return null;
}

/** LaTeX naar gewone tekst: \frac{a}{b} → ((a)/(b)), \sqrt[3]{a} → root(3;a), \sin → sin ... */
export function latexNaarTekst(invoer: string): string {
  let t = invoer
    .replace(/\$/g, '')
    .replace(/\\left|\\right|\\displaystyle|\\limits/g, '')
    .replace(/\\[,;:! ]|~|\\quad|\\qquad/g, ' ')
    .replace(/\\(mathrm|operatorname|text|textrm|mathit)\s*\{([^{}]*)\}/g, '$2')
    .replace(/\\(dfrac|tfrac)/g, '\\frac')
    .replace(/\\(cdot|times)|[×·⋅]/g, '*')
    .replace(/\\pi(?![a-z])|π/gi, 'pi')
    .replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp)(?![a-z])/g, '$1')
    .replace(/\\vert|\\lvert|\\rvert|\\mid/g, '|')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/∛/g, 'cbrt')
    // ᵉlog en {}^e\log: de natuurlijke logaritme.
    .replace(/(\{\})?\^\{?e\}?\s*log|ᵉ\s*log/g, 'ln');
  // \frac en \sqrt van binnen naar buiten (geneste accolades).
  for (let ronde = 0; ronde < 30; ronde++) {
    const i = Math.max(t.lastIndexOf('\\frac'), t.lastIndexOf('\\sqrt'));
    if (i < 0) break;
    if (t.startsWith('\\frac', i)) {
      const teller = accolades(t, i + 5);
      const noemer = teller && accolades(t, teller[1]);
      if (!teller || !noemer) return invoer;
      t = `${t.slice(0, i)}((${teller[0]})/(${noemer[0]}))${t.slice(noemer[1])}`;
    } else {
      let j = i + 5;
      let n = '';
      if (t[j] === '[') {
        const k = t.indexOf(']', j);
        if (k < 0) return invoer;
        n = t.slice(j + 1, k);
        j = k + 1;
      }
      const a = accolades(t, j);
      if (!a) return invoer;
      t = `${t.slice(0, i)}${n ? `root(${n};${a[0]})` : `sqrt(${a[0]})`}${t.slice(a[1])}`;
    }
  }
  return t.replace(/[{]/g, '(').replace(/[}]/g, ')').replace(/(\d),(\d)/g, '$1.$2');
}

type Token = { s: 'getal'; w: number } | { s: 'naam'; w: string } | { s: 'teken'; w: string };

function tokens(tekst: string): Token[] | null {
  const uit: Token[] = [];
  let t = tekst.toLowerCase();
  for (const [a, b] of SYNONIEMEN) t = t.replaceAll(a, b);
  const namen = [...Object.keys(FUNCTIES), 'root', 'pi'].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const getal = /^\d+(\.\d+)?|^\.\d+/.exec(t.slice(i));
    if (getal) {
      uit.push({ s: 'getal', w: Number(getal[0]) });
      i += getal[0].length;
      continue;
    }
    if (/[a-z]/.test(c)) {
      const naam = namen.find((n) => t.startsWith(n, i));
      if (naam) {
        uit.push({ s: 'naam', w: naam });
        i += naam.length;
      } else if (c === 'x' || c === 'e' || c === 'c') {
        uit.push({ s: 'naam', w: c });
        i++;
      } else return null;
      continue;
    }
    if ('+-*/^()|;'.includes(c)) {
      uit.push({ s: 'teken', w: c });
      i++;
      continue;
    }
    if (c === '−' || c === '–') {
      uit.push({ s: 'teken', w: '-' });
      i++;
      continue;
    }
    if (c === ':') {
      uit.push({ s: 'teken', w: '/' });
      i++;
      continue;
    }
    return null;
  }
  return uit;
}

class Lezer {
  private i = 0;
  /** Hoeveel absolute-waardestrepen open staan: een '|' sluit dan eerst. */
  private abs = 0;
  constructor(private readonly t: Token[]) {}

  lees(): Knoop | null {
    try {
      const k = this.som();
      return this.i === this.t.length ? k : null;
    } catch {
      return null;
    }
  }

  private kijk(): Token | undefined {
    return this.t[this.i];
  }
  private is(w: string) {
    const k = this.kijk();
    return k?.s === 'teken' && k.w === w;
  }
  private neem(w: string) {
    if (!this.is(w)) throw new Error(`verwacht ${w}`);
    this.i++;
  }

  private som(): Knoop {
    let k = this.product();
    while (this.is('+') || this.is('-')) {
      const op = (this.t[this.i++] as { w: '+' | '-' }).w;
      k = { t: 'op', op, a: k, b: this.product() };
    }
    return k;
  }

  /** Begint hier een factor (voor vermenigvuldigen zonder maalteken)? */
  private begintFactor(): boolean {
    const k = this.kijk();
    if (!k) return false;
    if (k.s !== 'teken') return true;
    return k.w === '(' || (k.w === '|' && this.abs === 0);
  }

  private product(): Knoop {
    let k = this.teken();
    for (;;) {
      if (this.is('*') || this.is('/')) {
        const op = (this.t[this.i++] as { w: '*' | '/' }).w;
        k = { t: 'op', op, a: k, b: this.teken() };
      } else if (this.begintFactor()) k = { t: 'op', op: '*', a: k, b: this.macht() };
      else return k;
    }
  }

  private teken(): Knoop {
    if (this.is('-')) {
      this.i++;
      return { t: 'min', a: this.teken() };
    }
    if (this.is('+')) {
      this.i++;
      return this.teken();
    }
    return this.macht();
  }

  private macht(): Knoop {
    const grond = this.basis();
    if (this.is('^')) {
      this.i++;
      return { t: 'op', op: '^', a: grond, b: this.teken() };
    }
    return grond;
  }

  private basis(): Knoop {
    const k = this.kijk();
    if (!k) throw new Error('einde');
    if (k.s === 'getal') {
      this.i++;
      return { t: 'getal', w: k.w };
    }
    if (k.s === 'teken') {
      if (k.w === '(') {
        this.i++;
        const a = this.som();
        this.neem(')');
        return a;
      }
      if (k.w === '|') {
        this.i++;
        this.abs++;
        const a = this.som();
        this.abs--;
        this.neem('|');
        return { t: 'f', f: 'abs', a };
      }
      throw new Error(`onverwacht ${k.w}`);
    }
    this.i++;
    if (k.w === 'x') return { t: 'x' };
    if (k.w === 'c') return { t: 'C' };
    if (k.w === 'e') return { t: 'getal', w: Math.E };
    if (k.w === 'pi') return { t: 'getal', w: Math.PI };
    if (k.w === 'root') {
      this.neem('(');
      const n = this.som();
      this.neem(';');
      const a = this.som();
      this.neem(')');
      return { t: 'wortel', n, a };
    }
    // Functie, eventueel met een macht: sin^2 x = (sin x)^2, sin^{-1} x = Bgsin x.
    let macht: Knoop | null = null;
    if (this.is('^')) {
      this.i++;
      macht = this.teken();
    }
    const arg = this.argument();
    const inverse = macht?.t === 'min' && macht.a.t === 'getal' && macht.a.w === 1 && ['sin', 'cos', 'tan', 'cot'].includes(k.w);
    if (inverse) return { t: 'f', f: `a${k.w}`, a: arg };
    const f: Knoop = { t: 'f', f: k.w, a: arg };
    return macht ? { t: 'op', op: '^', a: f, b: macht } : f;
  }

  /** Argument van een functie: tussen haakjes, of zonder haakjes "4x", "x^2" (tot + of - of een andere functie). */
  private argument(): Knoop {
    // sin(4x)^2 = (sin 4x)^2: de macht hoort bij de functie, niet bij het argument.
    if (this.is('(') || this.is('|')) return this.basis();
    let a = this.enkel();
    for (;;) {
      const k = this.kijk();
      if (k && (k.s === 'getal' || (k.s === 'naam' && ['x', 'c', 'e', 'pi'].includes(k.w)))) a = { t: 'op', op: '*', a, b: this.enkel() };
      else return a;
    }
  }

  private enkel(): Knoop {
    const k = this.kijk();
    if (!k || k.s === 'teken') throw new Error('argument');
    const b = this.basis();
    if (this.is('^')) {
      this.i++;
      return { t: 'op', op: '^', a: b, b: this.teken() };
    }
    return b;
  }
}

function reken(k: Knoop, x: number): number {
  switch (k.t) {
    case 'getal':
      return k.w;
    case 'x':
      return x;
    case 'C':
      return 0;
    case 'min':
      return -reken(k.a, x);
    case 'f':
      return FUNCTIES[k.f](reken(k.a, x));
    case 'wortel': {
      const n = reken(k.n, x);
      const a = reken(k.a, x);
      // Oneven wortels van negatieve getallen bestaan.
      return a < 0 && Number.isInteger(n) && n % 2 === 1 ? -Math.pow(-a, 1 / n) : Math.pow(a, 1 / n);
    }
    case 'op': {
      const a = reken(k.a, x);
      const b = reken(k.b, x);
      switch (k.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return Math.pow(a, b);
      }
    }
  }
}

const bevat = (k: Knoop, soort: 'x' | 'C'): boolean =>
  k.t === soort || (k.t === 'op' ? bevat(k.a, soort) || bevat(k.b, soort) : k.t === 'min' || k.t === 'f' ? bevat(k.a, soort) : k.t === 'wortel' ? bevat(k.n, soort) || bevat(k.a, soort) : false);

/** Leest een uitdrukking (LaTeX of tekst); "F(x) = ..." en "y = ..." vooraan mogen. */
export function leesUitdrukking(invoer: string): Knoop | null {
  const tekst = latexNaarTekst(invoer)
    .trim()
    .replace(/^[a-z](\(x\))?\s*=/i, '');
  if (!tekst.trim() || tekst.includes('=')) return null;
  const t = tokens(tekst);
  return t && t.length ? new Lezer(t).lees() : null;
}

const PUNTEN = [-4.3, -3.1, -2.2, -1.7, -1.1, -0.73, -0.41, -0.17, 0.09, 0.23, 0.38, 0.57, 0.81, 1.13, 1.42, 1.9, 2.4, 3.3, 4.6, 6.2];
const dichtbij = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Zijn de twee uitdrukkingen gelijk? Met een integratieconstante C in het verwachte antwoord mag
 * het antwoord er een constante naast zitten (en mag de C ontbreken). null = niet te lezen.
 */
export function uitdrukkingGelijk(antwoord: string, verwacht: string): boolean | null {
  const a = leesUitdrukking(antwoord);
  const v = leesUitdrukking(verwacht);
  if (!a || !v) return null;
  const metC = bevat(v, 'C');
  const waarden = PUNTEN.map((p) => [reken(a, p), reken(v, p)] as const);
  const geldigV = waarden.filter(([, y]) => Number.isFinite(y)).length;
  const samen = waarden.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  // Genoeg punten waar beide bestaan (ln x tegenover ln|x| mag: dan de helft).
  if (samen.length < Math.min(4, geldigV) || samen.length < geldigV * 0.4) return false;
  if (!metC) return samen.every(([x, y]) => dichtbij(x, y));
  // Op een constante na: de verschillen met het eerste punt vergelijken. Het antwoord moet wel van x afhangen.
  if (bevat(v, 'x') && !bevat(a, 'x')) return false;
  const [x0, y0] = samen[0];
  return samen.every(([x, y]) => dichtbij(x - x0, y - y0));
}
