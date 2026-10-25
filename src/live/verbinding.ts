import { useSyncExternalStore } from 'react';

/** Status van de verbinding met de live server, voor het bolletje in de hoek. */
export type Verbinding = 'verbonden' | 'verbinden' | 'offline';

let huidig: Verbinding = 'verbinden';
const luisteraars = new Set<() => void>();

export function zetVerbinding(v: Verbinding): void {
  const nieuw = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : v;
  if (nieuw === huidig) return;
  huidig = nieuw;
  luisteraars.forEach((l) => l());
}

function abonneer(l: () => void): () => void {
  luisteraars.add(l);
  return () => luisteraars.delete(l);
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => zetVerbinding('offline'));
  window.addEventListener('online', () => zetVerbinding('verbinden'));
}

export function useVerbinding(): Verbinding {
  return useSyncExternalStore(abonneer, () => huidig);
}
