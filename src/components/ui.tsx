import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * Uitklapmenu: sluit bij een klik ernaast of met Esc. Zet de ref op het element met de knop én
 * het menu.
 */
export function useUitklap<T extends HTMLElement = HTMLDivElement>(open: boolean, sluit: () => void) {
  const ref = useRef<T>(null);
  const sluitRef = useRef(sluit);
  sluitRef.current = sluit;
  useEffect(() => {
    if (!open) return;
    const klik = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) sluitRef.current();
    };
    const toets = (e: KeyboardEvent) => e.key === 'Escape' && sluitRef.current();
    document.addEventListener('pointerdown', klik);
    document.addEventListener('keydown', toets);
    return () => {
      document.removeEventListener('pointerdown', klik);
      document.removeEventListener('keydown', toets);
    };
  }, [open]);
  return ref;
}

export function Section({ step, title, children, aside }: { step?: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {step !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
            {step}
          </span>
        )}
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside && <div className="ml-auto text-sm text-slate-500">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:brightness-110',
  secondary: 'border border-slate-300 bg-surface text-slate-800 hover:bg-slate-50',
  danger: 'border border-red-200 bg-surface text-red-700 hover:bg-red-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const styles = {
    info: 'border-slate-200 bg-slate-50 text-slate-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-surface p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label="Sluiten">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

/** Kiest een bestand en geeft het door; de invoer wordt daarna leeggemaakt zodat hetzelfde bestand opnieuw kan. */
export function FileButton({ accept, onFile, children, variant = 'secondary' }: { accept: string; onFile: (f: File) => void; children: ReactNode; variant?: Variant }) {
  return (
    <label className={`inline-flex cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-medium transition ${variants[variant]}`}>
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

export function PageHeader({ title, children, back }: { title: string; children?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <a href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </a>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="ml-auto flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
