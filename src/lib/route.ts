import { useEffect, useState } from 'react';

export type Route =
  | { pagina: 'start' }
  | { pagina: 'sets' }
  | { pagina: 'set'; id: string }
  | { pagina: 'klassen' }
  | { pagina: 'spelen'; setId?: string }
  | { pagina: 'sessie'; id: string }
  | { pagina: 'resultaten' }
  | { pagina: 'aanmelden' }
  | { pagina: 'importeren'; setId?: string }
  | { pagina: 'live'; code?: string; demo: boolean };

export function parseHash(hash: string): Route {
  const [pad, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const delen = pad.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  switch (delen[0]) {
    case 'sets':
      return { pagina: 'sets' };
    case 'set':
      return delen[1] ? { pagina: 'set', id: delen[1] } : { pagina: 'sets' };
    case 'klassen':
      return { pagina: 'klassen' };
    case 'spelen':
      return { pagina: 'spelen', setId: params.get('set') ?? undefined };
    case 'sessie':
      return delen[1] ? { pagina: 'sessie', id: delen[1] } : { pagina: 'start' };
    case 'resultaten':
      return { pagina: 'resultaten' };
    case 'aanmelden':
      return { pagina: 'aanmelden' };
    case 'importeren':
      return { pagina: 'importeren', setId: params.get('set') ?? undefined };
    case 'live':
      return { pagina: 'live', code: params.get('code') ?? undefined, demo: params.get('demo') === '1' };
    default:
      return { pagina: 'start' };
  }
}

export function href(r: Route): string {
  switch (r.pagina) {
    case 'start':
      return '#/';
    case 'set':
      return `#/set/${r.id}`;
    case 'spelen':
      return r.setId ? `#/spelen?set=${r.setId}` : '#/spelen';
    case 'importeren':
      return r.setId ? `#/importeren?set=${r.setId}` : '#/importeren';
    case 'sessie':
      return `#/sessie/${r.id}`;
    case 'live': {
      const q = new URLSearchParams();
      if (r.code) q.set('code', r.code);
      if (r.demo) q.set('demo', '1');
      return `#/live${q.size ? `?${q}` : ''}`;
    }
    default:
      return `#/${r.pagina}`;
  }
}

export function ga(r: Route): void {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
