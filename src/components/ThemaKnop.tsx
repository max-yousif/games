import { useThema, type Thema } from '../lib/thema';

const VOLGENDE: Record<Thema, Thema> = { systeem: 'donker', donker: 'licht', licht: 'systeem' };
const LABEL: Record<Thema, { icoon: string; tekst: string }> = {
  systeem: { icoon: '🖥️', tekst: 'Thema: zoals de computer' },
  donker: { icoon: '🌙', tekst: 'Thema: donker' },
  licht: { icoon: '☀️', tekst: 'Thema: licht' },
};

/** Wisselt tussen donker, licht en de instelling van de computer. */
export function ThemaKnop({ className = '' }: { className?: string }) {
  const [thema, zet] = useThema();
  const l = LABEL[thema];
  return (
    <button
      type="button"
      onClick={() => zet(VOLGENDE[thema])}
      className={`rounded-lg px-2 py-2 text-lg leading-none hover:bg-slate-100 ${className}`}
      title={`${l.tekst} (klik om te wisselen)`}
      aria-label={l.tekst}
    >
      {l.icoon}
    </button>
  );
}
