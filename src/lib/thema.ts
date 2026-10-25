import { useEffect, useState } from 'react';

export type Thema = 'licht' | 'donker' | 'systeem';

const SLEUTEL = 'games.v1.thema';

export function leesThema(): Thema {
  try {
    const t = localStorage.getItem(SLEUTEL);
    return t === 'licht' || t === 'donker' ? t : 'systeem';
  } catch {
    return 'systeem';
  }
}

const systeemDonker = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Zet data-theme op <html>; "systeem" volgt de instelling van de computer. */
export function pasThemaToe(t: Thema) {
  const donker = t === 'donker' || (t === 'systeem' && systeemDonker());
  document.documentElement.dataset.theme = donker ? 'dark' : 'light';
}

/** Gekozen thema, bewaard per browser; volgt live de computer als "systeem" gekozen is. */
export function useThema(): [Thema, (t: Thema) => void] {
  const [thema, setThema] = useState(leesThema);
  useEffect(() => {
    pasThemaToe(thema);
    if (thema !== 'systeem') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const bij = () => pasThemaToe('systeem');
    mq?.addEventListener('change', bij);
    return () => mq?.removeEventListener('change', bij);
  }, [thema]);
  const zet = (t: Thema) => {
    try {
      if (t === 'systeem') localStorage.removeItem(SLEUTEL);
      else localStorage.setItem(SLEUTEL, t);
    } catch {
      // niet bewaard: geldt tot de pagina sluit
    }
    setThema(t);
  };
  return [thema, zet];
}
