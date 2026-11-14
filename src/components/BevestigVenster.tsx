import { useEffect, useRef, useSyncExternalStore } from 'react';
import { beantwoord, huidigeVraag, luisterNaarVragen } from '../lib/bevestig';
import { Button } from './ui';

/** Toont de vragen van `bevestig()`. Esc of een klik ernaast = annuleren, Enter = de knop met de focus. */
export function BevestigVenster() {
  const vraag = useSyncExternalStore(luisterNaarVragen, huidigeVraag);
  const jaRef = useRef<HTMLButtonElement>(null);
  const neeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!vraag) return;
    const vorige = document.activeElement as HTMLElement | null;
    (vraag.gevaarlijk ? neeRef : jaRef).current?.focus();
    return () => vorige?.focus?.();
  }, [vraag]);

  if (!vraag) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      // Niets laten doorlopen naar menu's of sneltoetsen eronder.
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) beantwoord(false);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') beantwoord(false);
        // Tab blijft binnen het venster.
        if (e.key === 'Tab') {
          e.preventDefault();
          (document.activeElement === jaRef.current ? neeRef : jaRef).current?.focus();
        }
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby={`bevestig-${vraag.id}`} className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <p id={`bevestig-${vraag.id}`} className="text-base whitespace-pre-line">
          {vraag.tekst}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={neeRef} onClick={() => beantwoord(false)}>
            Annuleren
          </Button>
          <Button
            ref={jaRef}
            variant={vraag.gevaarlijk ? 'rood' : 'primary'}
            onClick={() => beantwoord(true)}
          >
            {vraag.ja}
          </Button>
        </div>
      </div>
    </div>
  );
}
