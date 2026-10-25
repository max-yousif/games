import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RichText } from '../components/RichText';
import { Button, Notice } from '../components/ui';
import { exporteerSessie } from '../lib/exportResults';
import { href } from '../lib/route';
import { beeindig, resultatenPerLeerling } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { backend } from './config';
import {
  automatischeBeoordelingen,
  berekenStand,
  groepeerAntwoorden,
  oplossingVan,
  publiekeVraag,
  puntenVoor,
  synchroniseer,
  type AntwoordGroep,
} from './logic';
import { LiveFout, type Beoordeling, type LiveAntwoord, type LiveSessie, type LiveSpeler } from './types';

const LETTERS = 'ABCDEFGH';

/** Link die leerlingen openen op hun laptop. */
export function deelnameLink(code: string, demo: boolean): string {
  return `${window.location.origin}${window.location.pathname}#/live?code=${code}${demo ? '&demo=1' : ''}`;
}

export function LiveHost({ sessie, onUpdate }: { sessie: Sessie; onUpdate: (s: Sessie) => void }) {
  const live = sessie.live!;
  if (live.afgesloten) return <LiveEinde sessie={sessie} />;
  return <LiveHostActief sessie={sessie} onUpdate={onUpdate} />;
}

function LiveHostActief({ sessie, onUpdate }: { sessie: Sessie; onUpdate: (s: Sessie) => void }) {
  const live = sessie.live!;
  const be = backend(live.backend);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  const vraagVan = useCallback((nr: number): Vraag | null => sessie.vragen.find((v) => v.id === sessie.vraagVolgorde[nr]) ?? null, [sessie]);
  const nr = server?.vraagNr ?? -1;
  const vraag = nr >= 0 ? vraagVan(nr) : null;
  const huidige = useMemo(() => antwoorden.filter((a) => a.vraagNr === nr), [antwoorden, nr]);

  // Beoordeelde antwoorden bewaren in de lokale sessie (voor Resultaten en Excel).
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const s = synchroniseer(sessieRef.current, spelers, antwoorden, sessieRef.current.vraagVolgorde);
    if (JSON.stringify(s.beurten) !== JSON.stringify(sessieRef.current.beurten) || s.teams[0].leerlingen.length !== sessieRef.current.teams[0].leerlingen.length) {
      onUpdate(s);
    }
  }, [spelers, antwoorden, onUpdate]);

  async function actie(f: () => Promise<void>) {
    setBezig(true);
    setFout(null);
    try {
      await f();
    } catch (e) {
      setFout(e instanceof LiveFout ? e.message : 'Er ging iets mis met de verbinding. Probeer opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  /** Slaat beoordelingen op en werkt de tussenstand bij. */
  async function beoordeel(items: Beoordeling[], extra: Partial<Pick<LiveSessie, 'status' | 'oplossing'>> = {}) {
    await be.beoordeel(live.sessieId, items);
    const bijgewerkt = antwoorden.map((a) => {
      const i = items.find((x) => x.id === a.id);
      return i ? { ...a, juist: i.juist, punten: i.punten } : a;
    });
    setAntwoorden(bijgewerkt);
    await be.wijzigSessie(live.sessieId, { ...extra, stand: berekenStand(spelers, bijgewerkt) });
  }

  const volgende = () =>
    actie(async () => {
      const v = vraagVan(nr + 1);
      if (!v) return einde();
      await be.startVraag(live.sessieId, nr + 1, publiekeVraag(v));
    });

  const getoond = useRef(-1);
  const toonAntwoord = () =>
    actie(async () => {
      if (!vraag || server?.status !== 'vraag' || getoond.current === nr) return;
      getoond.current = nr;
      try {
        await beoordeel(automatischeBeoordelingen(vraag, antwoorden, nr, sessie.timer, live.snelheidsbonus), { status: 'antwoord', oplossing: oplossingVan(vraag) });
      } catch (e) {
        getoond.current = -1; // opnieuw proberen mag
        throw e;
      }
    });

  const zetGroep = (groep: AntwoordGroep, juist: boolean) =>
    actie(() => beoordeel(groep.antwoorden.map((a) => ({ id: a.id, juist, punten: vraag ? puntenVoor(vraag, juist, a.tijdMs, sessie.timer, live.snelheidsbonus) : 0 }))));

  async function einde() {
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand: berekenStand(spelers, antwoorden) });
    onUpdate(beeindig(synchroniseer(sessie, spelers, antwoorden, sessie.vraagVolgorde)));
  }

  const afsluiten = () =>
    actie(async () => {
      if (!confirm('Het spel afsluiten? De resultaten blijven bewaard op deze laptop, maar de gegevens op de server (namen en antwoorden) worden gewist.')) return;
      const s = beeindig(synchroniseer(sessie, spelers, antwoorden, sessie.vraagVolgorde));
      await be.verwijderSessie(live.sessieId);
      onUpdate({ ...s, live: { ...live, afgesloten: true } });
    });

  // Automatisch het antwoord tonen als de tijd om is of iedereen geantwoord heeft.
  const [resterend, setResterend] = useState<number | null>(null);
  const startRef = useRef<{ nr: number; t: number } | null>(null);
  const autoRef = useRef(-1);
  const verbonden = spelers.filter((s) => s.verbonden);
  const iedereen = verbonden.length > 0 && verbonden.every((s) => huidige.some((a) => a.spelerId === s.id));
  useEffect(() => {
    if (server?.status !== 'vraag') {
      setResterend(null);
      return;
    }
    if (startRef.current?.nr !== nr) startRef.current = { nr, t: Date.now() };
    if (!sessie.timer) return;
    const tik = () => setResterend(Math.max(0, sessie.timer! - Math.floor((Date.now() - startRef.current!.t) / 1000)));
    tik();
    const id = window.setInterval(tik, 250);
    return () => window.clearInterval(id);
  }, [server?.status, nr, sessie.timer]);
  const toonRef = useRef(toonAntwoord);
  toonRef.current = toonAntwoord;
  const moetTonen = server?.status === 'vraag' && (iedereen || resterend === 0);
  useEffect(() => {
    if (!moetTonen || autoRef.current === nr) return;
    // Even wachten zodat antwoorden die net op tijd verstuurd werden nog binnenkomen.
    const id = window.setTimeout(
      () => {
        autoRef.current = nr;
        void toonRef.current();
      },
      iedereen ? 800 : 2500,
    );
    return () => window.clearTimeout(id);
  }, [moetTonen, nr, iedereen]);

  if (server === undefined) return <div className="p-10 text-center text-xl text-slate-500">Verbinden met de server…</div>;
  if (server === null) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <Notice tone="warn">Dit live spel bestaat niet meer op de server (gewist na 2 dagen of afgesloten). De bewaarde resultaten vind je onder Resultaten.</Notice>
        <Button className="mt-4" onClick={() => onUpdate({ ...beeindig(sessie), live: { ...live, afgesloten: true } })}>
          Toon de bewaarde resultaten
        </Button>
      </div>
    );
  }

  const link = deelnameLink(live.code, live.backend === 'lokaal');
  const stand = server.stand.length ? server.stand : berekenStand(spelers, antwoorden);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8">
      {fout && (
        <div className="mb-3">
          <Notice tone="warn">{fout}</Notice>
        </div>
      )}

      {server.status === 'lobby' && (
        <div className="flex flex-1 flex-col items-center gap-6 pt-4">
          <div className="text-center">
            <div className="text-xl text-slate-600">Ga naar</div>
            <div className="mt-1 rounded-xl bg-white px-6 py-3 font-mono text-2xl shadow-sm select-all">{link.split('?')[0]}</div>
            <div className="mt-4 text-xl text-slate-600">en geef deze code in:</div>
            <div className="mt-2 font-mono text-8xl font-bold tracking-[0.2em] text-[var(--accent)]">{live.code}</div>
            <div className="mt-2 text-sm text-slate-500">
              Of rechtstreeks:{' '}
              <a className="underline" href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </div>
          </div>
          <SpelersRaster sessie={sessie} spelers={spelers} beantwoord={null} onOntkoppel={(id) => actie(() => be.ontkoppel(id))} />
          <Button variant="primary" className="px-10 py-4 text-xl" disabled={bezig || sessie.vraagVolgorde.length === 0} onClick={volgende}>
            ▶ Start de quiz ({spelers.filter((s) => s.verbonden).length} {spelers.filter((s) => s.verbonden).length === 1 ? 'speler' : 'spelers'})
          </Button>
        </div>
      )}

      {(server.status === 'vraag' || server.status === 'antwoord') && vraag && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-4 text-lg text-slate-600">
            <span className="font-semibold">
              Vraag {nr + 1} / {sessie.vraagVolgorde.length}
            </span>
            {vraag.categorie && <span>{vraag.categorie}</span>}
            <span className="ml-auto font-mono">code {live.code}</span>
            {resterend !== null && (
              <span className={`rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend <= 5 ? 'bg-red-100 text-red-700' : 'bg-white'}`}>{resterend}s</span>
            )}
          </div>
          <RichText text={vraag.tekst} className="text-4xl leading-snug font-medium" />

          {server.status === 'vraag' ? (
            <>
              {vraag.type === 'meerkeuze' && (
                <div className="grid grid-cols-2 gap-3">
                  {vraag.opties.map((o, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-2xl">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white">{LETTERS[i]}</span>
                      <RichText text={o} />
                    </div>
                  ))}
                </div>
              )}
              <div className="text-2xl font-semibold">
                {huidige.length} / {verbonden.length} geantwoord
              </div>
              <SpelersRaster sessie={sessie} spelers={spelers} beantwoord={new Set(huidige.map((a) => a.spelerId))} onOntkoppel={(id) => actie(() => be.ontkoppel(id))} />
              <div className="mt-auto flex gap-3">
                <Button variant="primary" className="px-8 py-3 text-lg" disabled={bezig} onClick={toonAntwoord}>
                  Toon antwoord
                </Button>
              </div>
            </>
          ) : (
            <Antwoorden vraag={vraag} antwoorden={huidige} spelers={spelers} stand={stand} bezig={bezig} onZetGroep={zetGroep} />
          )}

          {server.status === 'antwoord' && (
            <div className="mt-auto flex gap-3">
              <Button variant="primary" className="px-8 py-3 text-lg" disabled={bezig} onClick={volgende}>
                {nr + 1 < sessie.vraagVolgorde.length ? 'Volgende vraag ▶' : 'Eindstand 🏆'}
              </Button>
              {nr + 1 < sessie.vraagVolgorde.length && (
                <Button className="ml-auto" disabled={bezig} onClick={() => confirm('De quiz nu beëindigen en de eindstand tonen?') && void actie(einde)}>
                  ⏹ Nu stoppen
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {server.status === 'einde' && <LiveEinde sessie={sessie} stand={stand} onAfsluiten={afsluiten} bezig={bezig} />}
    </div>
  );
}

function SpelersRaster({
  sessie,
  spelers,
  beantwoord,
  onOntkoppel,
}: {
  sessie: Sessie;
  spelers: LiveSpeler[];
  beantwoord: Set<string> | null;
  onOntkoppel: (spelerId: string) => void;
}) {
  const afwezig = sessie.teams[0].leerlingen.map((l) => l.naam).filter((n) => !spelers.some((s) => s.naam === n && s.verbonden));
  return (
    <div className="flex w-full flex-wrap justify-center gap-2">
      {spelers
        .filter((s) => s.verbonden)
        .map((s) => {
          const klaar = beantwoord?.has(s.id);
          return (
            <span
              key={s.id}
              className={`pop group inline-flex items-center gap-1 rounded-full px-4 py-2 text-lg font-medium ${klaar ? 'bg-emerald-500 text-white' : beantwoord ? 'bg-white text-slate-700 shadow-sm' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}
            >
              {klaar && '✓ '}
              {s.naam}
              <button
                type="button"
                className="ml-1 hidden rounded-full px-1 text-sm opacity-60 group-hover:inline hover:opacity-100"
                title="Loskoppelen (bv. als de leerling van laptop wisselt)"
                onClick={() => confirm(`${s.naam} loskoppelen? De leerling kan zich daarna opnieuw aanmelden (ook op een andere laptop).`) && onOntkoppel(s.id)}
              >
                ✕
              </button>
            </span>
          );
        })}
      {afwezig.map((n) => (
        <span key={n} className="rounded-full border border-dashed border-slate-300 px-4 py-2 text-lg text-slate-400">
          {n}
        </span>
      ))}
    </div>
  );
}

function Antwoorden({
  vraag,
  antwoorden,
  spelers,
  stand,
  bezig,
  onZetGroep,
}: {
  vraag: Vraag;
  antwoorden: LiveAntwoord[];
  spelers: LiveSpeler[];
  stand: { naam: string; punten: number }[];
  bezig: boolean;
  onZetGroep: (g: AntwoordGroep, juist: boolean) => void;
}) {
  const naam = (id: string) => spelers.find((s) => s.id === id)?.naam ?? '?';
  const juistAantal = antwoorden.filter((a) => a.juist).length;
  const opl = oplossingVan(vraag);

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-6 py-4">
          <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Antwoord</div>
          <RichText text={opl.antwoord} className="text-3xl font-semibold" />
          {opl.uitleg && <RichText text={opl.uitleg} className="mt-2 text-lg text-slate-700" />}
        </div>
        <div className="text-xl font-semibold">
          {juistAantal} van {antwoorden.length} juist
        </div>
        {vraag.type === 'meerkeuze' ? (
          <div className="space-y-2">
            {vraag.opties.map((o, i) => {
              const n = antwoorden.filter((a) => a.antwoord === String(i)).length;
              const juist = i === vraag.juisteOptie;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${juist ? 'bg-emerald-600' : 'bg-slate-400'}`}>{LETTERS[i]}</span>
                  <div className="relative h-12 flex-1 overflow-hidden rounded-xl bg-white">
                    <div className={`h-full transition-all ${juist ? 'bg-emerald-300' : 'bg-slate-200'}`} style={{ width: `${antwoorden.length ? (n / antwoorden.length) * 100 : 0}%` }} />
                    <div className="absolute inset-0 flex items-center px-4 text-xl">
                      <RichText text={o} />
                    </div>
                  </div>
                  <span className="w-10 text-right font-mono text-2xl font-bold">{n}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Antwoorden die automatisch als fout gemarkeerd werden, kan je met ✓ alsnog goedkeuren.</p>
            {groepeerAntwoorden(antwoorden).map((g) => (
              <div key={g.sleutel} className={`flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-2 ${g.juist ? 'border-emerald-400' : 'border-red-200'}`}>
                <span className="font-mono text-xl font-bold">{g.antwoorden.length}×</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xl">{g.tekst}</div>
                  <div className="truncate text-sm text-slate-500">{g.antwoorden.map((a) => naam(a.spelerId)).join(', ')}</div>
                </div>
                <button type="button" disabled={bezig} onClick={() => onZetGroep(g, true)} className={`rounded-lg px-3 py-1.5 text-lg ${g.juist ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-emerald-100'}`}>
                  ✓
                </button>
                <button type="button" disabled={bezig} onClick={() => onZetGroep(g, false)} className={`rounded-lg px-3 py-1.5 text-lg ${g.juist === false ? 'bg-red-600 text-white' : 'bg-slate-100 hover:bg-red-100'}`}>
                  ✗
                </button>
              </div>
            ))}
            {antwoorden.length === 0 && <p className="text-slate-500">Niemand heeft geantwoord.</p>}
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-xl font-semibold">Tussenstand</div>
        <ol className="space-y-1.5">
          {stand.slice(0, 10).map((r, i) => (
            <li key={r.naam} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2 text-lg shadow-sm">
              <span className="w-8 font-bold text-slate-400">{i + 1}.</span>
              <span className="flex-1 truncate font-medium">{r.naam}</span>
              <span className="font-mono font-bold">{r.punten}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Eindstand: podium, alle resultaten, export en afsluiten. Werkt ook zonder server (na afsluiten). */
function LiveEinde({ sessie, stand, onAfsluiten, bezig }: { sessie: Sessie; stand?: { naam: string; punten: number }[]; onAfsluiten?: () => void; bezig?: boolean }) {
  const rijen = resultatenPerLeerling(sessie);
  const ranking = stand ?? [...rijen].filter((r) => r.naam !== '(hele team)').sort((a, b) => b.punten - a.punten);
  const podium = ranking.slice(0, 3);
  return (
    <div className="mx-auto w-full max-w-5xl py-6">
      <div className="text-center text-6xl">🏆</div>
      <div className="mt-6 flex items-end justify-center gap-4">
        {[1, 0, 2].map(
          (i) =>
            podium[i] && (
              <div key={i} className="pop flex w-56 flex-col items-center" style={{ animationDelay: `${(2 - i) * 0.15}s` }}>
                <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                <div className="mt-1 text-center text-xl font-bold">{podium[i].naam}</div>
                <div className="font-mono text-2xl">{podium[i].punten}</div>
                <div className={`mt-2 w-full rounded-t-xl bg-[var(--accent)] ${['h-32', 'h-20', 'h-12'][i]}`} />
              </div>
            ),
        )}
      </div>
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-white text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">Beantwoord</th>
            <th className="px-4 py-2 text-right">Juist</th>
            <th className="px-4 py-2 text-right">Punten</th>
          </tr>
        </thead>
        <tbody>
          {[...rijen]
            .sort((a, b) => b.punten - a.punten || a.naam.localeCompare(b.naam, 'nl'))
            .map((r) => (
              <tr key={r.naam} className={`border-t border-slate-100 ${r.beurten === 0 ? 'text-slate-400' : ''}`}>
                <td className="px-4 py-2 font-medium">{r.naam}</td>
                <td className="px-4 py-2 text-right">
                  {r.beurten} / {sessie.vraagVolgorde.length}
                </td>
                <td className="px-4 py-2 text-right text-emerald-700">{r.juist}</td>
                <td className="px-4 py-2 text-right font-mono">{r.punten}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => exporteerSessie(sessie)}>
          ⬇ Resultaten exporteren (Excel)
        </Button>
        {onAfsluiten && (
          <Button variant="danger" disabled={bezig} onClick={onAfsluiten}>
            Afsluiten en gegevens op de server wissen
          </Button>
        )}
        <a href={href({ pagina: 'start' })} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Naar de startpagina
        </a>
      </div>
      <p className="mt-3 text-center text-sm text-slate-500">
        De resultaten zijn bewaard onder Resultaten.{onAfsluiten && ' Gegevens op de server worden ook automatisch gewist na 2 dagen.'}
      </p>
    </div>
  );
}
