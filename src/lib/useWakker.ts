import { useEffect } from 'react';

/**
 * Houdt de laptop van de leerkracht wakker zolang een live spel loopt (die kijkt alles na) en
 * waarschuwt bij sluiten of herladen van het tabblad.
 */
export function useWakker(actief: boolean) {
  useEffect(() => {
    if (!actief) return;
    let slot: WakeLockSentinel | null = null;
    let weg = false;
    const vraag = () => {
      if (weg || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock.request('screen').then(
        (s) => {
          if (weg) void s.release();
          else slot = s;
        },
        () => undefined, // bv. batterijbesparing: dan maar zonder
      );
    };
    // Na terugkeer naar het tabblad vervalt het slot: opnieuw aanvragen.
    const zichtbaar = () => vraag();
    const sluiten = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    vraag();
    document.addEventListener('visibilitychange', zichtbaar);
    window.addEventListener('beforeunload', sluiten);
    return () => {
      weg = true;
      void slot?.release();
      document.removeEventListener('visibilitychange', zichtbaar);
      window.removeEventListener('beforeunload', sluiten);
    };
  }, [actief]);
}
