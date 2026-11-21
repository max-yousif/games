import { useEffect, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { AntwoordTekst, Beantwoord } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';

/** Quizbord, vier op een rij en bom op de laptop van de leerling: kiezen, antwoorden en de uitslag van het team. */
export function TeambordSpeler({
  be,
  sessie,
  antwoorden,
  spelerId,
  nieuwSpel,
}: {
  be: LiveBackend;
  sessie: LiveSessie;
  antwoorden: LiveAntwoord[];
  spelerId: string | null;
  nieuwSpel: ReactNode;
}) {
  const v = sessie.vraag;
  const tv = v?.teambord;
  const rij = sessie.stand.find((r) => r.id === spelerId);
  const mijnTeam = rij?.team;
  const teams = tv?.teams ?? [];
  const team = mijnTeam !== undefined ? teams[mijnTeam] : undefined;
  const mijn = antwoorden.find((a) => a.spelerId === spelerId && a.vraagNr === sessie.vraagNr);
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const stuur = (antwoord: string) => be.antwoord(sessie.id, sessie.vraagNr, antwoord);

  const kop = (
    <div className="flex flex-wrap items-center gap-3">
      {team ? (
        <span className="rounded-full px-4 py-1.5 text-lg font-bold text-white" style={{ background: team.kleur }} data-mijn-team>
          {team.naam}
        </span>
      ) : (
        <span className="rounded-full bg-slate-200 px-4 py-1.5 text-lg font-semibold">Even wachten op je team…</span>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        {teams.map((t, i) => {
          const r = sessie.stand.find((x) => x.team === i);
          return (
            <span key={i} className="rounded-xl bg-surface px-3 py-1 font-semibold shadow-sm" style={{ color: t.kleur }}>
              {r?.ontploffingen !== undefined ? `💥 ${r.ontploffingen}` : `⭐ ${r?.punten ?? 0}`}
            </span>
          );
        })}
      </div>
    </div>
  );

  if (sessie.status === 'einde') {
    const tekst = sessie.oplossing?.teambord?.tekst;
    const gewonnen = sessie.oplossing?.teambord && tekst !== 'Gelijkspel!' && sessie.oplossing.teambord.team === mijnTeam;
    return (
      <div className="space-y-4">
        {kop}
        <Kaart>
          <div className="text-center">
            <div className="text-6xl">{gewonnen ? '🏆' : '👏'}</div>
            <h1 className="mt-2 text-3xl font-bold">{tekst ?? 'Einde!'}</h1>
            {nieuwSpel}
          </div>
        </Kaart>
      </div>
    );
  }
  if (!v || !tv) return <Kaart>Even wachten…</Kaart>;

  const aanDeBeurt = tv.team === mijnTeam;
  const beurtTeam = teams[tv.team];

  if (sessie.status === 'vraag' && (tv.fase === 'kiezen' || tv.fase === 'zet')) {
    const ikKies = tv.kiezerId === spelerId;
    let inhoud: ReactNode;
    if (!ikKies) {
      inhoud = (
        <Kaart>
          <div className="text-center text-xl">
            <span className="font-semibold" style={{ color: beurtTeam?.kleur }}>
              {tv.kiezerNaam ?? beurtTeam?.naam}
            </span>{' '}
            {tv.fase === 'kiezen' ? 'kiest een vak…' : 'kiest een kolom…'}
          </div>
        </Kaart>
      );
    } else if (mijn) {
      inhoud = <Kaart>✓ Gekozen. Kijk naar het bord!</Kaart>;
    } else if (tv.fase === 'kiezen') {
      const categorieen = [...new Set((tv.vakken ?? []).map((x) => x.categorie))];
      inhoud = (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-100 px-4 py-2 text-xl font-semibold">🎯 Jij kiest een vak voor je team!</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${categorieen.length}, minmax(0, 1fr))` }}>
            {categorieen.map((c) => (
              <div key={c} className="space-y-2">
                <div className="rounded-lg bg-gray-800 px-2 py-2 text-center text-sm font-bold text-white">{c}</div>
                {(tv.vakken ?? [])
                  .filter((x) => x.categorie === c)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      disabled={!x.vrij}
                      onClick={() => void stuur(x.id)}
                      className="w-full rounded-lg bg-indigo-600 py-3 font-mono text-2xl font-bold text-amber-300 shadow-sm hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400"
                      data-vak={x.id}
                    >
                      {x.vrij ? x.punten : '–'}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      inhoud = (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-100 px-4 py-2 text-xl font-semibold">🎯 Jij laat de schijf vallen! Kies een kolom.</div>
          <div className="grid grid-cols-7 gap-2">
            {(tv.kolommen ?? []).map((vrij, k) => (
              <button
                key={k}
                type="button"
                disabled={!vrij}
                onClick={() => void stuur(String(k))}
                className="rounded-xl py-4 text-3xl font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-30"
                style={{ background: beurtTeam?.kleur }}
                aria-label={`Kolom ${k + 1}`}
              >
                {k + 1}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {kop}
        {inhoud}
      </div>
    );
  }

  const vraagKaart = (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
      <RichText text={v.tekst} className="text-2xl leading-snug font-medium" />
    </div>
  );

  if (sessie.status === 'vraag') {
    const rest = tv.tijd && sessie.vraagStart ? Math.ceil((new Date(sessie.vraagStart).getTime() + tv.tijd * 1000 - nu) / 1000) : null;
    return (
      <div className="space-y-4">
        {kop}
        <div className={`flex items-center gap-3 rounded-xl px-4 py-2 text-lg font-semibold ${aanDeBeurt ? 'bg-amber-100' : 'bg-slate-100 text-slate-600'}`} data-beurt>
          {aanDeBeurt ? '🔥 Jouw team is aan de beurt!' : `Oefen mee: ${beurtTeam?.naam ?? 'een ander team'} is aan de beurt.`}
          {rest !== null && !mijn && <span className={`ml-auto font-mono text-xl ${rest <= 5 ? 'text-red-600' : ''}`}>{Math.max(0, rest)}s</span>}
        </div>
        {vraagKaart}
        {mijn ? (
          <Kaart>
            <div className="text-center text-xl">
              <div className="text-4xl">✉️</div>
              <p className="mt-2 text-slate-600">
                Je antwoord: <AntwoordTekst vraag={v} antwoord={mijn.antwoord} />
              </p>
            </div>
          </Kaart>
        ) : rest !== null && rest <= 0 ? (
          <Kaart>⏰ De tijd is om.</Kaart>
        ) : (
          <Beantwoord key={sessie.vraagNr} vraag={v} zaad={`${spelerId}:${sessie.vraagNr}`} onVerstuur={stuur} />
        )}
      </div>
    );
  }

  // Uitslag van de vraag (of de bom ontplofte).
  const u = sessie.oplossing?.teambord;
  if (u?.boem) {
    return (
      <div className="space-y-4">
        {kop}
        <div className="pop rounded-2xl bg-red-600 p-8 text-center text-white shadow-sm" data-boem>
          <div className="text-7xl">💥</div>
          <div className="mt-2 text-3xl font-black">{u.tekst}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {kop}
      <div className={`rounded-2xl p-6 text-center text-white shadow-sm ${mijn?.juist ? 'bg-emerald-600' : 'bg-red-600'}`} data-resultaat>
        <div className="text-5xl">{mijn ? (mijn.juist ? '✓' : '✗') : '⏰'}</div>
        <div className="mt-2 text-3xl font-bold">{mijn ? (mijn.juist ? 'Juist!' : 'Fout') : 'Geen antwoord'}</div>
        {mijn && (
          <div className="mt-1 text-lg opacity-90">
            Jouw antwoord: <AntwoordTekst vraag={v} antwoord={mijn.antwoord} />
          </div>
        )}
      </div>
      {u && (
        <div className="rounded-2xl bg-surface px-5 py-3 text-xl font-semibold shadow-sm" style={{ color: teams[u.team]?.kleur }} data-team-uitslag>
          {u.tekst}
        </div>
      )}
      {sessie.oplossing && (
        <div className="rounded-2xl border-2 border-emerald-400 bg-surface p-5">
          <div className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">Juiste antwoord</div>
          <RichText text={sessie.oplossing.antwoord} className="mt-1 text-2xl font-semibold" />
          {sessie.oplossing.uitleg && <RichText text={sessie.oplossing.uitleg} className="mt-2 text-slate-700" />}
        </div>
      )}
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 text-lg shadow-sm">{children}</div>;
}
