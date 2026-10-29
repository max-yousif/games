import { describe, expect, it } from 'vitest';
import { latexNaarTekst, leesUitdrukking, uitdrukkingGelijk } from '../src/lib/wiskunde';

/** Uitkomsten zoals bij een Cluedo met integralen, met schrijfwijzen van leerlingen. */
const GEVALLEN: [string, string[], string[]][] = [
  ['\\operatorname{Bgsin}(e^x)+C', ['arcsin(e^x)', 'Bgsin(e^x)+c', '\\arcsin\\left(e^{x}\\right)+C', 'bgsin e^x + 5'], ['arcsin(x)', 'Bgsin(e^x)^2']],
  ['\\frac{1}{12}\\operatorname{Bgtan}(\\sin^2 4x)+C', ['Bgtan(sin(4x)^2)/12', '1/12 bgtan(sin^2(4x))', '\\frac{\\arctan\\left(\\sin^{2}\\left(4x\\right)\\right)}{12}+C'], ['1/12 Bgtan(sin^2 4x /3)', 'Bgtan(sin^2 4x)']],
  ['\\operatorname{Bgtan}(\\ln x)+C', ['arctan(ln(x))', 'Bgtan ln x'], ['Bgtan(x)']],
  ['\\frac{1}{12}\\operatorname{Bgtan}\\left(\\frac{\\sin^2 4x}{3}\\right)+C', ['1/12 arctan(sin(4x)^2/3)', '\\frac{1}{12}\\arctan\\left(\\frac{\\sin^{2}4x}{3}\\right)'], ['1/12 arctan(sin(4x)^2)']],
  ['\\frac{9}{4}\\sqrt[3]{(x^2+3)^2}+C', ['9/4 (x^2+3)^(2/3)', '\\frac{9}{4}\\sqrt[3]{\\left(x^{2}+3\\right)^{2}}', '2.25*cbrt((x^2+3)^2)'], ['9/4 sqrt((x^2+3)^2)']],
  ['\\ln|x^2+x+2|+C', ['ln(x^2+x+2)', '\\ln\\left|x^{2}+x+2\\right|+C'], ['ln(x^2+x)']],
  ['\\frac{-\\ln(3^{-x}+4)}{\\ln 3}+C', ['-ln(3^(-x)+4)/ln(3)', '-\\frac{\\ln\\left(3^{-x}+4\\right)}{\\ln3}'], ['ln(3^(-x)+4)/ln 3']],
  ['\\frac{\\sin^2 x}{2}+C', ['sin(x)^2/2', '-cos(2x)/4', '\\frac{1}{2}\\sin^{2}x'], ['cos(2x)/4']],
  ['\\frac{2}{3}\\ln\\left|\\sqrt{9x^2-7}+3x\\right|+C', ['2/3 ln(sqrt(9x^2-7)+3x)', '\\frac{2}{3}\\ln\\left|\\sqrt{9x^{2}-7}+3x\\right|'], ['2/3 ln(sqrt(9x^2-7))']],
  ['\\frac{\\pi}{4}', ['pi/4', '\\frac{\\pi}{4}', 'π/4', '0.25π'], ['-pi/4', '0.785']],
  ['-\\frac{7^{2-3x}}{3\\ln 7}+C', ['-7^(2-3x)/(3ln7)', '-\\frac{7^{2-3x}}{3\\ln\\left(7\\right)}'], ['7^(2-3x)/(3ln7)']],
  ['\\frac{\\cos 2x}{4}+C', ['cos(2x)/4', '-sin(x)^2/2', '\\frac{1}{4}\\cos\\left(2x\\right)'], ['sin(x)^2/2']],
  ['-\\frac{2}{5}\\ln|5x+3|+C', ['-2/5 ln|5x+3|', '-0,4 ln(5x+3)', '-\\frac{2}{5}\\ln\\left|5x+3\\right|'], ['2/5 ln|5x+3|']],
  ['\\frac{\\operatorname{Bgtan}^2 x}{2}+C', ['arctan(x)^2/2', 'Bgtan^2 x / 2', '\\frac{\\arctan^{2}x}{2}'], ['arctan(x^2)/2']],
  ['\\ln|\\ln x|+C', ['ln(ln(x))', 'ln|ln x|', '\\ln\\left|\\ln x\\right|'], ['ln x']],
  ['\\frac{\\sqrt{(2x^2+1)^3}}{6}+C', ['(2x^2+1)^(3/2)/6', 'sqrt((2x^2+1)^3)/6', '\\frac{1}{6}\\sqrt{\\left(2x^{2}+1\\right)^{3}}'], ['(2x^2+1)^(3/2)/3']],
  ['-\\frac{\\pi}{4}', ['-pi/4', '-\\frac{\\pi}{4}'], ['pi/4']],
  ['\\frac{\\ln 3}{2}', ['ln(3)/2', '\\frac{1}{2}\\ln3', '0.5 ln 3', 'ln(sqrt(3))'], ['ln(3)']],
];

describe('wiskundige uitdrukkingen vergelijken', () => {
  it('leest LaTeX van de wiskunde-editor', () => {
    expect(latexNaarTekst('\\frac{1}{\\sqrt[3]{x}}')).toBe('((1)/(root(3;x)))');
    expect(leesUitdrukking('\\frac{1}{12}\\operatorname{Bgtan}(\\sin^2 4x)+C')).not.toBeNull();
    expect(leesUitdrukking('Parijs')).toBeNull();
    expect(leesUitdrukking('a^2+2ab')).toBeNull();
  });

  for (const [verwacht, juist, fout] of GEVALLEN) {
    it(verwacht, () => {
      for (const a of juist) expect(uitdrukkingGelijk(a, verwacht), a).toBe(true);
      for (const a of fout) expect(uitdrukkingGelijk(a, verwacht), a).toBe(false);
    });
  }

  it('zonder C moet het precies gelijk zijn; met C mag een constante verschillen', () => {
    expect(uitdrukkingGelijk('x^2+1', 'x^2')).toBe(false);
    expect(uitdrukkingGelijk('x^2+1', 'x^2+C')).toBe(true);
    expect(uitdrukkingGelijk('C', 'x^2+C')).toBe(false);
  });
});
