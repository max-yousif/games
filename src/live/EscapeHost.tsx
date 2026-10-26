import { useEffect, useMemo, useRef, useState } from 'react';
import { AfsluitKnoppen } from '../components/AfsluitKnoppen';
import { Button, Notice } from '../components/ui';
import { exporteerSessie, tijdTekst } from '../lib/exportResults';
import { beeindig, korteNaamVan, resultatenPerLeerling } from '../lib/session';
import type { Sessie, Vraag } from '../lib/types';
import { backend } from './config';
import { escapeBeoordelingen, escapeStand, escapeVoortgang, type EscapeVoortgang } from './escape';
import { whodunitBeoordelingen } from './whodunit';
import { OplossingTabel } from './Whodunit';
import { Wachtruimte } from './LiveHost';
import { leerlingenVan, schermNaam, synchroniseer } from './logic';
import { LiveFout, type LiveAntwoord, type LiveSessie, type LiveSpeler } from './types';

/** Escape room en whodunit: elke leerling werkt in eigen tempo; de leerkracht volgt de voortgang. */
export function EscapeHost({ sessie, onUpdate, onVerwijder }: { sessie: Sessie; onUpdate: (s: Sessie) => void; onVerwijder: () => void }) {
  if (sessie.live!.afgesloten) return <EscapeEinde sessie={sessie} onVerwijder={onVerwijder} />;
  return <EscapeHostActief sessie={sessie} onUpdate={onUpdate} onVerwijder={onVerwijder} />;
}

/** Tijd tot ontsnappen per leerlingnaam (bij een groepje voor elke leerling), voor de resultaten en de Excel-export. */
function ontsnaptPerNaam(sessie: Sessie, voortgang: readonly EscapeVoortgang[]): Record<string, number> {
  return Object.fromEntries(voortgang.filter((v) => v.ontsnaptMs !== null).flatMap((v) => leerlingenVan(sessie, v.speler.naam).map((n) => [n, v.ontsnaptMs!])));
}

function EscapeHostActief({ sessie, onUpdate, onVerwijder }: { sessie: Sessie; onUpdate: (s: Sessie) => void; onVerwijder: () => void }) {
  const live = sessie.live!;
  const code = live.escapeCode ?? '';
  const be = backend(live.backend);
  const [server, setServer] = useState<LiveSessie | null | undefined>(undefined);
  const [spelers, setSpelers] = useState<LiveSpeler[]>([]);
  const [antwoorden, setAntwoorden] = useState<LiveAntwoord[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [toonCode, setToonCode] = useState(false);
  const whodunit = sessie.spelType === 'whodunit';
  const spelNaam = whodunit ? 'De whodunit' : 'De escape room';

  useEffect(() => be.volgSessie(live.sessieId, setServer), [be, live.sessieId]);
  useEffect(() => be.volgSpelers(live.sessieId, setSpelers), [be, live.sessieId]);
  useEffect(() => be.volgAntwoorden(live.sessieId, setAntwoorden), [be, live.sessieId]);

  const vragen = useMemo(() => sessie.vraagVolgorde.map((id) => sessie.vragen.find((v) => v.id === id)).filter((v): v is Vraag => !!v), [sessie]);
  const voortgang = useMemo(() => escapeVoortgang(spelers, antwoorden), [spelers, antwoorden]);

  // Nieuwe pogingen meteen nakijken (de leerling wacht op het resultaat).
  const nakijken = useRef(false);
  // Na elke ronde opnieuw kijken: pogingen die binnenkwamen tijdens het nakijken.
  const [ronde, setRonde] = useState(0);
  useEffect(() => {
    const items = whodunit && sessie.raadsel ? whodunitBeoordelingen(vragen, sessie.raadsel, antwoorden) : escapeBeoordelingen(vragen, code, antwoorden);
    if (items.length === 0 || nakijken.current) return;
    nakijken.current = true;
    void (async () => {
      try {
        await be.beoordeel(live.sessieId, items);
        const bijgewerkt = antwoorden.map((a) => {
          const i = items.find((x) => x.id === a.id);
          return i ? { ...a, juist: i.juist, punten: i.punten, beloning: i.beloning ?? null } : a;
        });
        await be.wijzigSessie(live.sessieId, { stand: escapeStand(escapeVoortgang(spelers, bijgewerkt)) });
        setFout(null);
      } catch (e) {
        setFout(e instanceof LiveFout ? e.message : 'Nakijken mislukt; nieuwe poging binnen enkele seconden.');
        await new Promise((r) => window.setTimeout(r, 3000));
      } finally {
        nakijken.current = false;
        setRonde((r) => r + 1);
      }
    })();
  }, [antwoorden, vragen, code, be, live.sessieId, spelers, ronde, whodunit, sessie.raadsel]);

  // Resultaten bewaren in de lokale sessie.
  const sessieRef = useRef(sessie);
  sessieRef.current = sessie;
  useEffect(() => {
    const huidig = sessieRef.current;
    const s = synchroniseer(huidig, spelers, antwoorden, huidig.vraagVolgorde);
    const ontsnapt = ontsnaptPerNaam(huidig, voortgang);
    if (
      JSON.stringify(s.beurten) !== JSON.stringify(huidig.beurten) ||
      s.teams[0].leerlingen.length !== huidig.teams[0].leerlingen.length ||
      JSON.stringify(ontsnapt) !== JSON.stringify(huidig.live?.ontsnapt ?? {}) ||
      JSON.stringify(s.live?.bijnamen ?? {}) !== JSON.stringify(huidig.live?.bijnamen ?? {})
    ) {
      onUpdate({ ...s, live: { ...s.live!, ontsnapt } });
    }
  }, [spelers, antwoorden, voortgang, onUpdate]);

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

  async function einde() {
    await be.wijzigSessie(live.sessieId, { status: 'einde', stand: escapeStand(voortgang) });
    const s = synchroniseer(sessie, spelers, antwoorden, sessie.vraagVolgorde);
    onUpdate(beeindig({ ...s, live: { ...s.live!, ontsnapt: ontsnaptPerNaam(sessie, voortgang) } }));
  }

  // Gegevens op de server wissen; de resultaten blijven in de lokale sessie.
  const afsluiten = async () => {
    onUpdate({ ...sessie, live: { ...live, afgesloten: true } });
    await be.verwijderSessie(live.sessieId);
  };

  // Klok: verstreken (of resterende) tijd sinds de start.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const verstreken = server?.vraagStart ? Math.max(0, nu - new Date(server.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  // Automatisch stoppen als de tijd om is (met wat speling voor late antwoorden).
  const gestopt = useRef(false);
  useEffect(() => {
    if (server?.status === 'bezig' && resterend !== null && resterend < -3000 && !gestopt.current) {
      gestopt.current = true;
      void actie(einde);
    }
  });

  if (server === undefined) return <div className="p-10 text-center text-xl text-slate-500">Verbinden met de server…</div>;
  if (server === null) {
    return (
      <div className="mx-auto max-w-xl p-10">
        <Notice tone="warn">{whodunit ? 'Deze whodunit' : 'Deze escape room'} bestaat niet meer op de server (gewist na 2 dagen of afgesloten). De bewaarde resultaten vind je onder Resultaten.</Notice>
        <Button className="mt-4" onClick={() => onUpdate({ ...beeindig(sessie), live: { ...live, afgesloten: true } })}>
          Toon de bewaarde resultaten
        </Button>
      </div>
    );
  }

  const verbonden = voortgang.filter((v) => v.speler.verbonden);
  const ontsnapt = verbonden.filter((v) => v.ontsnaptMs !== null).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-8">
      {fout && (
        <div className="mb-3">
          <Notice tone="warn">{fout}</Notice>
        </div>
      )}

      {server.status === 'lobby' && (
        <Wachtruimte
          sessie={sessie}
          spelers={spelers}
          bezig={bezig}
          startTekst={whodunit ? 'Start de whodunit' : 'Start de escape room'}
          onStart={() => actie(() => be.startEscape(live.sessieId))}
          onOntkoppel={(id) => actie(() => be.ontkoppel(id))}
          onWisBijnaam={(id) => actie(() => be.wisBijnaam(id))}
        />
      )}

      {server.status === 'bezig' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <span className={`rounded-2xl px-5 py-2 font-mono text-5xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
              ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
            </span>
            <span className="text-3xl font-semibold">
              {whodunit ? `🕵️ ${ontsnapt} / ${verbonden.length} opgelost` : `🚪 ${ontsnapt} / ${verbonden.length} ontsnapt`}
            </span>
            <span className="ml-auto font-mono text-slate-500">code {live.code}</span>
            {whodunit ? (
              <Button onClick={() => setToonCode((t) => !t)}>{toonCode ? 'Verberg oplossing' : 'Toon oplossing'}</Button>
            ) : (
              <Button onClick={() => setToonCode((t) => !t)}>{toonCode ? `Geheime code: ${code}` : 'Toon geheime code'}</Button>
            )}
            <Button variant="primary" disabled={bezig} onClick={() => confirm(`${spelNaam} nu beëindigen?`) && void actie(einde)}>
              ⏹ Beëindigen
            </Button>
          </div>
          {whodunit && toonCode && sessie.raadsel && <OplossingTabel raadsel={sessie.raadsel} />}
          <VoortgangTabel voortgang={voortgang} vragen={vragen} whodunit={whodunit} />
          <p className="text-sm text-slate-500">
            {whodunit
              ? '🔒 nog niet opgelost · ⏳ wordt nagekeken · ✗ aantal foute pogingen · ✅ juist (hint verdiend). 🕵️ = tijd tot de tabel klopt. Nieuwe leerlingen kunnen nog aansluiten met de code. Beweeg over een oefening om de vraag te zien.'
              : '🔒 nog dicht · ⏳ wordt nagekeken · ✗ aantal foute pogingen · ✅ open. Nieuwe leerlingen kunnen nog aansluiten met de code. Beweeg over een slotnummer om de vraag te zien.'}
          </p>
        </div>
      )}

      {server.status === 'einde' && <EscapeEinde sessie={sessie} voortgang={voortgang} onAfsluiten={afsluiten} onVerwijder={onVerwijder} />}
    </div>
  );
}

function VoortgangTabel({ voortgang, vragen, whodunit }: { voortgang: EscapeVoortgang[]; vragen: Vraag[]; whodunit: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            {vragen.map((v, i) => (
              <th key={v.id} className="px-2 py-2 text-center" title={`${v.categorie ? `${v.categorie}: ` : ''}${v.tekst}`}>
                {whodunit ? `Oef ${i + 1}` : `Slot ${i + 1}`}
              </th>
            ))}
            <th className="px-4 py-2 text-center">{whodunit ? '🕵️' : '🚪'}</th>
          </tr>
        </thead>
        <tbody>
          {voortgang.map((v, i) => (
            <tr key={v.speler.id} className={`border-t border-slate-100 text-lg ${v.speler.verbonden ? '' : 'opacity-40'}`}>
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium" title={v.speler.bijnaam ? v.speler.naam : undefined}>
                {schermNaam(v.speler)}
              </td>
              {vragen.map((vraag, nr) => {
                const fouten = v.fout.get(nr) ?? 0;
                return (
                  <td key={vraag.id} className="px-2 py-2 text-center">
                    {v.opgelost.has(nr) ? (
                      <span title={fouten ? `${fouten} foute poging(en)` : undefined}>✅</span>
                    ) : v.bezig.has(nr) ? (
                      '⏳'
                    ) : fouten ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-700">✗{fouten}</span>
                    ) : (
                      <span className="opacity-40">🔒</span>
                    )}
                  </td>
                );
              })}
              <td className="px-4 py-2 text-center font-mono font-bold">
                {v.ontsnaptMs !== null ? <span className="text-emerald-700">{tijdTekst(v.ontsnaptMs)}</span> : !whodunit && v.opgelost.size === vragen.length ? '🔑' : '—'}
              </td>
            </tr>
          ))}
          {voortgang.length === 0 && (
            <tr>
              <td colSpan={vragen.length + 3} className="px-4 py-6 text-center text-slate-500">
                Nog niemand aangemeld.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EscapeEinde({ sessie, voortgang, onAfsluiten, onVerwijder }: { sessie: Sessie; voortgang?: EscapeVoortgang[]; onAfsluiten?: () => Promise<void>; onVerwijder: () => void }) {
  const ontsnapt = sessie.live?.ontsnapt ?? {};
  const aantalSloten = sessie.vraagVolgorde.length;
  const whodunit = sessie.spelType === 'whodunit';
  // Zonder server: rangschikking uit de bewaarde resultaten.
  const rijen = resultatenPerLeerling(sessie).filter((r) => r.naam !== '(hele team)');
  const ranking = voortgang
    ? voortgang.map((v) => ({ naam: schermNaam(v.speler), sloten: v.opgelost.size, tijd: v.ontsnaptMs }))
    : rijen
        .map((r) => ({ naam: sessie.live?.bijnamen?.[r.naam] ?? korteNaamVan(sessie)(r.naam), sloten: r.juist, tijd: ontsnapt[r.naam] ?? null }))
        .sort((a, b) => (a.tijd ?? Infinity) - (b.tijd ?? Infinity) || b.sloten - a.sloten);
  const podium = ranking.filter((r) => r.tijd !== null).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-4xl py-6">
      <div className="text-center text-6xl">{whodunit ? '🕵️' : '🗝️'}</div>
      <h2 className="mt-2 text-center text-3xl font-bold">
        {podium.length > 0
          ? `${podium.length === ranking.length ? 'Iedereen' : `${ranking.filter((r) => r.tijd !== null).length} van de ${ranking.length}`} ${whodunit ? 'loste het raadsel op' : 'ontsnapt'}!`
          : whodunit
            ? 'Niemand loste het raadsel op…'
            : 'Niemand is ontsnapt…'}
      </h2>
      {podium.length > 0 && (
        <div className="mt-6 flex items-end justify-center gap-4">
          {[1, 0, 2].map(
            (i) =>
              podium[i] && (
                <div key={i} className="pop flex w-56 flex-col items-center" style={{ animationDelay: `${(2 - i) * 0.15}s` }}>
                  <div className="text-4xl">{['🥇', '🥈', '🥉'][i]}</div>
                  <div className="mt-1 text-center text-xl font-bold">{podium[i].naam}</div>
                  <div className="font-mono text-2xl">{tijdTekst(podium[i].tijd!)}</div>
                  <div className={`mt-2 w-full rounded-t-xl bg-[var(--accent)] ${['h-32', 'h-20', 'h-12'][i]}`} />
                </div>
              ),
          )}
        </div>
      )}
      <table className="mt-8 w-full overflow-hidden rounded-xl bg-surface text-left shadow-sm">
        <thead className="bg-slate-100 text-sm text-slate-600">
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Leerling</th>
            <th className="px-4 py-2 text-right">{whodunit ? 'Oefeningen juist' : 'Sloten open'}</th>
            <th className="px-4 py-2 text-right">{whodunit ? 'Opgelost na' : 'Ontsnapt na'}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.naam} className="border-t border-slate-100">
              <td className="px-4 py-2 font-bold text-slate-400">{i + 1}</td>
              <td className="px-4 py-2 font-medium">{r.naam}</td>
              <td className="px-4 py-2 text-right">
                {r.sloten} / {aantalSloten}
              </td>
              <td className="px-4 py-2 text-right font-mono">{r.tijd !== null ? tijdTekst(r.tijd) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {whodunit && sessie.raadsel && (
        <div className="mt-8">
          <h3 className="mb-2 text-xl font-semibold">De oplossing</h3>
          <OplossingTabel raadsel={sessie.raadsel} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => exporteerSessie(sessie)}>
          ⬇ Resultaten exporteren (Excel)
        </Button>
        <AfsluitKnoppen serverWissen={onAfsluiten} onVerwijder={onVerwijder} />
      </div>
    </div>
  );
}
