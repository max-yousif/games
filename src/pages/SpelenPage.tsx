import { useState } from 'react';
import { Button, inputClass, labelClass, Notice, PageHeader, Section } from '../components/ui';
import { speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { maakTeams, nieuweSessie } from '../lib/session';
import type { Store } from '../lib/store';
import type { Leerling, SpelType, Team } from '../lib/types';

const SPELLEN: { type: SpelType; icoon: string; naam: string; tekst: string }[] = [
  { type: 'quizbord', icoon: '🟦', naam: 'Quizbord', tekst: 'Categorieën × punten. Teams kiezen om beurt een vak. 2 tot 6 teams.' },
  { type: 'vieropeenrij', icoon: '🔴', naam: 'Vier op een rij', tekst: 'Juist antwoord = een schijf laten vallen. Precies 2 teams.' },
];

const TIMERS = [null, 30, 60, 90, 120, 180];

export function SpelenPage({ setId, store }: { setId?: string; store: Store }) {
  const [gekozenSet, setGekozenSet] = useState(setId ?? store.sets[0]?.id ?? '');
  const [spel, setSpel] = useState<SpelType>('quizbord');
  const [klasId, setKlasId] = useState(store.klassen[0]?.id ?? '');
  const [aantal, setAantal] = useState(2);
  const [timer, setTimer] = useState<number | null>(null);
  const klas = store.klassen.find((k) => k.id === klasId) ?? null;
  const set = store.sets.find((s) => s.id === gekozenSet) ?? null;
  const vragen = set ? speelbareVragen(set) : [];
  const aantalTeams = spel === 'vieropeenrij' ? 2 : aantal;

  const [teams, setTeams] = useState<Team[]>(() => maakTeams(klas?.leerlingen ?? [], aantalTeams));
  const [afwezig, setAfwezig] = useState<Leerling[]>([]);
  const verdeel = (leerlingen = klas?.leerlingen ?? [], n = aantalTeams, zonder = afwezig) =>
    setTeams(maakTeams(leerlingen.filter((l) => !zonder.some((a) => a.id === l.id)), n));

  function markeerAfwezig(ti: number, l: Leerling) {
    setTeams((ts) => ts.map((t, i) => (i === ti ? { ...t, leerlingen: t.leerlingen.filter((x) => x.id !== l.id) } : t)));
    setAfwezig((a) => [...a, l]);
  }

  function terugAanwezig(l: Leerling) {
    setAfwezig((a) => a.filter((x) => x.id !== l.id));
    // Bij het kleinste team zetten.
    setTeams((ts) => {
      const kleinste = ts.reduce((best, t, i) => (t.leerlingen.length < ts[best].leerlingen.length ? i : best), 0);
      return ts.map((t, i) => (i === kleinste ? { ...t, leerlingen: [...t.leerlingen, l] } : t));
    });
  }

  /** Klik op een naam: de leerling schuift door naar het volgende team. */
  function verplaats(ti: number, leerlingId: string) {
    setTeams((ts) => {
      const l = ts[ti].leerlingen.find((x) => x.id === leerlingId)!;
      const doel = (ti + 1) % ts.length;
      return ts.map((t, i) =>
        i === ti ? { ...t, leerlingen: t.leerlingen.filter((x) => x.id !== leerlingId) } : i === doel ? { ...t, leerlingen: [...t.leerlingen, l] } : t,
      );
    });
  }

  function start() {
    if (!set) return;
    const sessie = nieuweSessie({ spelType: spel, set, vragen, klasNaam: klas?.naam ?? 'zonder klas', teams, timer });
    store.bewaarSessie(sessie);
    ga({ pagina: 'sessie', id: sessie.id });
  }

  if (store.sets.length === 0) {
    return (
      <div>
        <PageHeader title="Spelen" />
        <Notice>
          Maak eerst een <a className="underline" href={href({ pagina: 'sets' })}>vragenset</a>.
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Spelen" />

      <Section step={1} title="Vragenset">
        <select className={`${inputClass} max-w-xl`} value={gekozenSet} onChange={(e) => setGekozenSet(e.target.value)}>
          {store.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.titel}
              {s.leerjaar ? ` (${s.leerjaar})` : ''}
            </option>
          ))}
        </select>
        {set && (
          <p className="mt-2 text-sm text-slate-500">
            {vragen.length} speelbare vragen
            {vragen.length < set.vragen.length && ` (${set.vragen.length - vragen.length} onvolledige vragen worden overgeslagen)`}.{' '}
            <a className="text-[var(--accent)] underline" href={href({ pagina: 'set', id: set.id })}>
              Bewerken
            </a>
          </p>
        )}
      </Section>

      <Section step={2} title="Spel">
        <div className="grid gap-3 sm:grid-cols-2">
          {SPELLEN.map((s) => (
            <button
              key={s.type}
              type="button"
              onClick={() => {
                setSpel(s.type);
                verdeel(klas?.leerlingen, s.type === 'vieropeenrij' ? 2 : aantal);
              }}
              className={`rounded-xl border-2 p-4 text-left transition ${spel === s.type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <div className="text-2xl">{s.icoon}</div>
              <div className="mt-1 font-semibold">{s.naam}</div>
              <div className="text-sm text-slate-600">{s.tekst}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section step={3} title="Klas en teams">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="w-60">
            <label className={labelClass}>Klas</label>
            <select
              className={inputClass}
              value={klasId}
              onChange={(e) => {
                setKlasId(e.target.value);
                setAfwezig([]);
                verdeel(store.klassen.find((k) => k.id === e.target.value)?.leerlingen ?? [], aantalTeams, []);
              }}
            >
              <option value="">Zonder namen (enkel teams)</option>
              {store.klassen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.naam} ({k.leerlingen.length})
                </option>
              ))}
            </select>
          </div>
          {spel === 'quizbord' && (
            <div className="w-36">
              <label className={labelClass}>Aantal teams</label>
              <select
                className={inputClass}
                value={aantal}
                onChange={(e) => {
                  setAantal(Number(e.target.value));
                  verdeel(klas?.leerlingen, Number(e.target.value));
                }}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="w-44">
            <label className={labelClass}>Timer per vraag</label>
            <select className={inputClass} value={timer ?? ''} onChange={(e) => setTimer(e.target.value ? Number(e.target.value) : null)}>
              {TIMERS.map((t) => (
                <option key={t ?? 0} value={t ?? ''}>
                  {t ? `${t} seconden` : 'geen timer'}
                </option>
              ))}
            </select>
          </div>
          {klas && <Button onClick={() => verdeel()}>🔀 Opnieuw verdelen</Button>}
        </div>

        {store.klassen.length === 0 && (
          <div className="mb-4">
            <Notice>
              Tip: maak een <a className="underline" href={href({ pagina: 'klassen' })}>klas</a> aan om namen van leerlingen te zien en resultaten per leerling bij te houden.
            </Notice>
          </div>
        )}

        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 3)}, minmax(0, 1fr))` }}>
          {teams.map((t, ti) => (
            <div key={ti} className="rounded-xl border-2 p-3" style={{ borderColor: t.kleur }}>
              <input
                className="mb-2 w-full rounded border-0 bg-transparent px-1 font-semibold outline-none focus:ring-2"
                style={{ color: t.kleur }}
                value={t.naam}
                onChange={(e) => setTeams((ts) => ts.map((x, i) => (i === ti ? { ...x, naam: e.target.value } : x)))}
                aria-label="Teamnaam"
              />
              <div className="flex flex-wrap gap-1">
                {t.leerlingen.map((l) => (
                  <span key={l.id} className="inline-flex items-center rounded-full bg-slate-100 text-sm">
                    <button
                      type="button"
                      onClick={() => verplaats(ti, l.id)}
                      title="Klik om naar het volgende team te verplaatsen"
                      className="rounded-l-full py-1 pr-1 pl-2.5 hover:bg-slate-200"
                    >
                      {l.naam}
                    </button>
                    <button
                      type="button"
                      onClick={() => markeerAfwezig(ti, l)}
                      title="Afwezig"
                      aria-label={`${l.naam} afwezig`}
                      className="rounded-r-full py-1 pr-2 pl-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {t.leerlingen.length === 0 && <span className="text-sm text-slate-400">{klas ? 'leeg team' : 'geen namen'}</span>}
              </div>
            </div>
          ))}
        </div>
        {afwezig.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-slate-500">Afwezig:</span>
            {afwezig.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => terugAanwezig(l)}
                title="Toch aanwezig"
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-slate-500 line-through hover:bg-slate-50"
              >
                {l.naam}
              </button>
            ))}
          </div>
        )}
        {klas && (
          <p className="mt-2 text-xs text-slate-500">
            Klik op een naam om die leerling naar het volgende team te verplaatsen, of op ✕ als de leerling afwezig is.
          </p>
        )}
      </Section>

      <div className="flex justify-end">
        <Button variant="primary" className="px-8 py-3 text-base" disabled={!set || vragen.length === 0} onClick={start}>
          ▶ Start het spel
        </Button>
      </div>
    </div>
  );
}
