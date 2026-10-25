import { lazy, Suspense } from 'react';
import { StartPage } from './pages/StartPage';
import { href, useRoute, type Route } from './lib/route';
import { useStore } from './lib/store';

// Pagina's worden pas geladen wanneer ze nodig zijn, zodat de startpagina snel opent.
const KlassenPage = lazy(() => import('./pages/KlassenPage').then((m) => ({ default: m.KlassenPage })));
const ResultatenPage = lazy(() => import('./pages/ResultatenPage').then((m) => ({ default: m.ResultatenPage })));
const SessiePage = lazy(() => import('./pages/SessiePage').then((m) => ({ default: m.SessiePage })));
const SetEditorPage = lazy(() => import('./pages/SetEditorPage').then((m) => ({ default: m.SetEditorPage })));
const SetsPage = lazy(() => import('./pages/SetsPage').then((m) => ({ default: m.SetsPage })));
const SpelenPage = lazy(() => import('./pages/SpelenPage').then((m) => ({ default: m.SpelenPage })));
const LiveSpelerPage = lazy(() => import('./live/LiveSpelerPage').then((m) => ({ default: m.LiveSpelerPage })));

const laden = <div className="p-10 text-center text-slate-400">Laden…</div>;

const MENU: { route: Route; label: string }[] = [
  { route: { pagina: 'spelen' }, label: 'Spelen' },
  { route: { pagina: 'sets' }, label: 'Vragensets' },
  { route: { pagina: 'klassen' }, label: 'Klassen' },
  { route: { pagina: 'resultaten' }, label: 'Resultaten' },
];

export default function App() {
  const route = useRoute();
  const store = useStore();

  // Een lopend spel gebruikt het volledige scherm, zonder menu.
  if (route.pagina === 'sessie')
    return (
      <Suspense fallback={laden}>
        <SessiePage key={route.id} id={route.id} store={store} />
      </Suspense>
    );
  // Leerlingen zien enkel het live-scherm, niet het menu van de leerkracht.
  if (route.pagina === 'live')
    return (
      <Suspense fallback={laden}>
        <LiveSpelerPage code={route.code} demo={route.demo} apart={route.apart} />
      </Suspense>
    );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3">
          <a href={href({ pagina: 'start' })} className="mr-4 text-lg font-bold">
            🎲 Klasspelen
          </a>
          {MENU.map((m) => (
            <a
              key={m.label}
              href={href(m.route)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                route.pagina === m.route.pagina || (m.route.pagina === 'sets' && route.pagina === 'set')
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Suspense fallback={laden}>
        {route.pagina === 'start' && <StartPage store={store} />}
        {route.pagina === 'sets' && <SetsPage store={store} />}
        {route.pagina === 'set' && <SetEditorPage key={route.id} id={route.id} store={store} />}
        {route.pagina === 'klassen' && <KlassenPage store={store} />}
        {route.pagina === 'spelen' && <SpelenPage key={route.setId ?? ''} setId={route.setId} store={store} />}
        {route.pagina === 'resultaten' && <ResultatenPage store={store} />}
        </Suspense>
      </main>
    </div>
  );
}
