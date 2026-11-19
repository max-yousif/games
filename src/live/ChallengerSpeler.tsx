import { useEffect, useState, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { AntwoordTekst, Beantwoord } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';

/** Challenger voor de leerling: in de klas, als challenger of in de Comeback Zone. */
export function ChallengerSpeler({
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
  const cv = v?.challenger;
  const rij = sessie.stand.find((r) => r.id === spelerId);
  const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
  const ikChallenger = !!cv && cv.challengerId === spelerId;
  const rol = ikChallenger ? 'challenger' : (rij?.rol ?? 'klas');
  const mijn = antwoorden.find((a) => a.spelerId === spelerId && a.vraagNr === sessie.vraagNr);
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const kop = (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`rounded-full px-4 py-1.5 text-lg font-bold ${rol === 'challenger' ? 'bg-amber-300 text-slate-900' : rol === 'zone' ? 'bg-slate-300 text-slate-800' : 'bg-indigo-100 text-indigo-900'}`}
        data-rol={rol}
      >
        {rol === 'challenger' ? '⚔️ Challenger' : rol === 'zone' ? `🔄 Comeback Zone ${'●'.repeat(rij?.reeks ?? 0)}${'○'.repeat(Math.max(0, 2 - (rij?.reeks ?? 0)))}` : '👥 In de klas'}
      </span>
      {rol === 'challenger' && rij?.harten !== undefined && <span className="text-2xl">{'❤️'.repeat(rij.harten)}</span>}
      <span className="ml-auto rounded-2xl bg-surface px-4 py-1.5 text-xl font-bold shadow-sm">⭐ {rij?.punten ?? 0}</span>
    </div>
  );

  if (sessie.status === 'einde') {
    return (
      <div className="space-y-4">
        <Kaart>
          <div className="text-center">
            <div className="text-6xl">{plaats === 1 ? '🏆' : plaats > 0 && plaats <= 3 ? '🎉' : '👏'}</div>
            <h1 className="mt-2 text-3xl font-bold">{plaats > 0 ? `Plaats ${plaats}` : 'Einde!'}</h1>
            <p className="mt-1 text-xl">⭐ {rij?.punten ?? 0} punten</p>
            {nieuwSpel}
          </div>
        </Kaart>
      </div>
    );
  }
  if (!v || !cv) return <Kaart>Even wachten tot de challenger gekozen is…</Kaart>;

  const vraagKaart = (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      {v.categorie && <div className="mb-1 text-sm font-semibold text-slate-500">{v.categorie}</div>}
      <RichText text={v.tekst} className="text-2xl leading-snug font-medium" />
    </div>
  );
  const antwoord = (
    <Beantwoord key={sessie.vraagNr} vraag={v} zaad={`${spelerId}:${sessie.vraagNr}`} onVerstuur={(a) => be.antwoord(sessie.id, sessie.vraagNr, a)} />
  );

  if (sessie.status === 'vraag') {
    const rest = cv.fase === 'klas' && cv.tijd && sessie.vraagStart ? Math.ceil((new Date(sessie.vraagStart).getTime() + cv.tijd * 1000 - nu) / 1000) : null;
    let inhoud: ReactNode;
    if (cv.fase === 'klas') {
      if (ikChallenger) inhoud = <Kaart>🤫 De klas antwoordt eerst. Denk al mee, zo meteen ben jij aan de beurt!</Kaart>;
      else if (mijn) inhoud = <Verstuurd vraag={v} antwoord={mijn.antwoord} tekst={`Wacht op ${cv.challengerNaam}…`} />;
      else if (rest !== null && rest <= 0) inhoud = <Kaart>⏰ De tijd is om.</Kaart>;
      else inhoud = antwoord;
    } else if (ikChallenger) {
      inhoud = mijn ? (
        <Verstuurd vraag={v} antwoord={mijn.antwoord} tekst="🔒 Laatste antwoord…" />
      ) : (
        <>
          {cv.fase === 'tweede' && <div className="rounded-xl bg-amber-100 px-4 py-2 text-lg font-semibold">🎯 Je tweede kans!</div>}
          {cv.inzet && <div className="rounded-xl bg-amber-100 px-4 py-2 text-lg font-semibold">💰 Inzet ×2</div>}
          <Hulp peiling={cv.peiling} copycat={cv.copycat} />
          {antwoord}
        </>
      );
    } else {
      inhoud = (
        <Kaart>
          <div className="text-center text-xl">
            ⚔️ <strong>{cv.challengerNaam}</strong> antwoordt…
            {antwoorden.some((a) => a.spelerId === spelerId && a.vraagNr === sessie.vraagNr - (cv.fase === 'tweede' ? 2 : 1)) && <div className="mt-1 text-slate-500">Jouw antwoord is binnen.</div>}
          </div>
        </Kaart>
      );
    }
    return (
      <div className="space-y-4">
        {kop}
        <div className="flex items-center gap-3 text-slate-600">
          <span className="font-semibold">Vraag {cv.nr}</span>
          {rest !== null && !mijn && !ikChallenger && <span className={`ml-auto rounded-full px-3 py-1 font-mono text-xl font-bold ${rest <= 5 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>{Math.max(0, rest)}s</span>}
        </div>
        {vraagKaart}
        {inhoud}
      </div>
    );
  }

  // Onthulling: juist of fout, het juiste antwoord, en GET OUT of COMEBACK.
  const u = sessie.oplossing?.challenger;
  const eigen = antwoorden.filter((a) => a.spelerId === spelerId && Math.floor(a.vraagNr / 3) === Math.floor(sessie.vraagNr / 3)).sort((a, b) => b.vraagNr - a.vraagNr)[0];
  const getOut = !!u && !!spelerId && u.getOut.includes(spelerId);
  const comeback = !!u && !!spelerId && u.comeback.includes(spelerId);
  const naam = rij?.naam ?? '';
  return (
    <div className="space-y-4">
      {kop}
      {(getOut || comeback) && <GroteUitroep key={sessie.vraagNr} kop={getOut ? 'GET OUT!' : 'COMEBACK!'} naam={naam} uit={getOut} />}
      <div className={`rounded-2xl p-6 text-center text-white shadow-sm ${eigen?.juist ? 'bg-emerald-600' : 'bg-red-600'}`} data-resultaat>
        <div className="text-5xl">{eigen ? (eigen.juist ? '✓' : '✗') : '⏰'}</div>
        <div className="mt-2 text-3xl font-bold">
          {getOut ? 'Je vliegt eruit! Twee keer na elkaar juist en je bent terug.' : comeback ? 'Terug in de klas!' : eigen ? (eigen.juist ? `Juist!${eigen.punten ? ` +${eigen.punten}` : ''}` : 'Fout') : 'Geen antwoord'}
        </div>
        {eigen && (
          <div className="mt-1 text-lg opacity-90">
            Jouw antwoord: <AntwoordTekst vraag={v} antwoord={eigen.antwoord} />
          </div>
        )}
      </div>
      {u && <div className="rounded-2xl bg-surface px-5 py-3 text-lg shadow-sm">{u.tekst}</div>}
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

function Verstuurd({ vraag, antwoord, tekst }: { vraag: NonNullable<LiveSessie['vraag']>; antwoord: string; tekst: string }) {
  return (
    <Kaart>
      <div className="text-center text-xl">
        <div className="text-4xl">✉️</div>
        <p className="mt-2 text-slate-600">
          Je antwoord: <AntwoordTekst vraag={vraag} antwoord={antwoord} />
        </p>
        <p className="mt-1 font-semibold">{tekst}</p>
      </div>
    </Kaart>
  );
}

function Hulp({ peiling, copycat }: { peiling?: { tekst: string; procent: number }[]; copycat?: { naam: string; antwoord: string } | null }) {
  return (
    <>
      {peiling && (
        <div className="rounded-2xl bg-sky-50 p-4">
          <div className="mb-1 font-semibold">📊 Wat denkt de klas?</div>
          {peiling.map((p) => (
            <div key={p.tekst} className="flex items-center gap-3">
              <RichText text={p.tekst} className="w-40 truncate" />
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full bg-sky-500" style={{ width: `${p.procent}%` }} />
              </div>
              <span className="w-12 text-right font-mono">{p.procent} %</span>
            </div>
          ))}
        </div>
      )}
      {copycat !== undefined && (
        <div className="rounded-2xl bg-amber-50 p-4">
          🐱 Copycat: {copycat ? (
            <>
              <strong>{copycat.naam}</strong> koos <RichText text={copycat.antwoord} className="inline" />
            </>
          ) : (
            'niemand van de klas heeft geantwoord.'
          )}
        </div>
      )}
    </>
  );
}

/** Dikke letters met een witte rand: ook leesbaar boven de kaarten eronder. */
const RAND = [-4, 0, 4].flatMap((x) => [-4, 0, 4].map((y) => `${x}px ${y}px 0 #fff`)).join(', ') + ', 0 8px 24px rgba(0,0,0,0.35)';

function GroteUitroep({ kop, naam, uit }: { kop: string; naam: string; uit: boolean }) {
  const [zichtbaar, setZichtbaar] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setZichtbaar(false), 3000);
    return () => window.clearTimeout(t);
  }, []);
  if (!zichtbaar) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4" data-uitroep>
      <div
        className={`pop text-center leading-[0.95] tracking-wide uppercase ${uit ? 'text-red-600' : 'text-emerald-500'}`}
        style={{ fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif', fontWeight: 900, textShadow: RAND }}
      >
        <div className="text-[12vw]">{kop}</div>
        <div className="text-[9vw] break-words">{naam}</div>
      </div>
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 text-lg shadow-sm">{children}</div>;
}
