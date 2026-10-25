import { useVerbinding } from './verbinding';

const STIJL = {
  verbonden: { kleur: 'bg-emerald-500', tekst: 'verbonden' },
  verbinden: { kleur: 'bg-amber-400 animate-pulse', tekst: 'opnieuw verbinden…' },
  offline: { kleur: 'bg-red-500 animate-pulse', tekst: 'geen internet' },
};

/** Klein bolletje dat toont of de verbinding met de live server werkt. */
export function VerbindingsBolletje() {
  const v = useVerbinding();
  const { kleur, tekst } = STIJL[v];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={`Verbinding met de server: ${tekst}`} role="status">
      <span className={`h-2.5 w-2.5 rounded-full ${kleur}`} />
      {v !== 'verbonden' && tekst}
    </span>
  );
}
