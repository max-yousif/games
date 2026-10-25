import { useEffect, useRef, useState } from 'react';
import type { MathfieldElement } from 'mathlive';

/** Knoppen voor wat leerlingen het vaakst nodig hebben (#@ = de selectie, #? = een leeg vakje). */
const KNOPPEN: { label: string; titel: string; latex: string }[] = [
  { label: 'a⁄b', titel: 'Breuk (of typ /)', latex: '\\frac{#@}{#?}' },
  { label: 'xⁿ', titel: 'Macht (of typ ^)', latex: '#@^{#?}' },
  { label: 'x²', titel: 'Kwadraat', latex: '#@^{2}' },
  { label: '√', titel: 'Vierkantswortel', latex: '\\sqrt{#?}' },
  { label: '×', titel: 'Maal', latex: '\\times' },
  { label: '( )', titel: 'Haakjes', latex: '\\left(#?\\right)' },
];

/** LaTeX uit de editor als antwoord: tussen dollartekens, of leeg. */
const alsAntwoord = (latex: string) => (latex.trim() ? `$${latex.trim()}$` : '');

/**
 * Invoerveld met een wiskunde-editor (MathLive): breuken, machten, wortels en maal zoals op papier.
 * Geeft het antwoord door als LaTeX tussen dollartekens (bv. "$\frac{1}{2}$"), zodat het op het
 * bord als formule verschijnt en het nakijken het herkent.
 */
export function WiskundeInvoer({
  onChange,
  onEnter,
  autoFocus = false,
  label,
  kleur,
}: {
  onChange: (waarde: string) => void;
  /** Enter: krijgt de actuele waarde mee (de state kan een toetsaanslag achterlopen). */
  onEnter?: (waarde: string) => void;
  autoFocus?: boolean;
  label: string;
  kleur?: string;
}) {
  const houder = useRef<HTMLDivElement>(null);
  const veld = useRef<MathfieldElement | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [fout, setFout] = useState(false);
  const callbacks = useRef({ onChange, onEnter });
  callbacks.current = { onChange, onEnter };

  useEffect(() => {
    let weg = false;
    import('mathlive').then(
      ({ MathfieldElement }) => {
        if (weg || !houder.current) return;
        MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}mathlive-fonts`;
        MathfieldElement.soundsDirectory = null;
        const mf = new MathfieldElement();
        mf.setAttribute('aria-label', label);
        mf.smartFence = true;
        if (kleur) mf.style.borderColor = kleur;
        mf.addEventListener('input', () => callbacks.current.onChange(alsAntwoord(mf.value)));
        mf.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const waarde = alsAntwoord(mf.value);
            callbacks.current.onChange(waarde);
            callbacks.current.onEnter?.(waarde);
          }
        });
        houder.current.appendChild(mf);
        veld.current = mf;
        setGeladen(true);
        if (autoFocus) requestAnimationFrame(() => mf.focus());
      },
      () => setFout(true),
    );
    return () => {
      weg = true;
      veld.current?.remove();
      veld.current = null;
    };
    // Enkel bij het tonen opbouwen; label, kleur en autoFocus veranderen niet.
  }, []);

  function voegIn(latex: string) {
    const mf = veld.current;
    if (!mf) return;
    mf.insert(latex, { selectionMode: 'placeholder', focus: true });
    mf.focus();
    callbacks.current.onChange(alsAntwoord(mf.value));
  }

  return (
    <div className="min-w-64 flex-1">
      <div ref={houder} className="wiskunde-invoer" />
      {!geladen && !fout && <div className="rounded-xl border-2 border-slate-300 px-4 py-3 text-slate-400">Wiskunde-editor laden…</div>}
      {fout && <div className="rounded-xl border-2 border-red-300 px-4 py-3 text-red-600">De wiskunde-editor kon niet geladen worden. Zet hem uit en typ je antwoord gewoon.</div>}
      {geladen && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KNOPPEN.map((k) => (
            <button
              key={k.label}
              type="button"
              title={k.titel}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => voegIn(k.latex)}
              className="min-w-11 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-serif text-lg hover:bg-slate-50"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
