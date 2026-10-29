/** Eén of meer leerjaren aanduiden (of geen). */
export function JaarKeuze({ jaren, onChange }: { jaren: number[]; onChange: (j: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Leerjaren">
      {[1, 2, 3, 4, 5, 6].map((j) => {
        const aan = jaren.includes(j);
        return (
          <button
            key={j}
            type="button"
            aria-pressed={aan}
            onClick={() => onChange(aan ? jaren.filter((x) => x !== j) : [...jaren, j].sort((a, b) => a - b))}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${aan ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-slate-300 bg-surface text-slate-700 hover:bg-slate-50'}`}
          >
            {j}e
          </button>
        );
      })}
    </div>
  );
}
