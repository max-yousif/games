import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { tijdTekst } from '../lib/exportResults';
import { functieVan } from '../lib/wiskunde';
import { afgewerkt, BASISFUNCTIES, OVERSLAAN, POGINGEN_VOOR_OVERSLAAN, type GrafiekBeloning } from './grafiekjacht';
import { Grafiek, padVan } from './Grafiek';
import { EditorSchakelaar, foutTekst, invoerKlasse, useWiskundeEditor } from './Invoer';
import type { LiveAntwoord, LiveBackend, LiveSessie } from './types';
import { WiskundeInvoer, type Knop } from './WiskundeInvoer';

const EXTRA: Knop[] = [
  { label: '|x|', titel: 'Absolute waarde', latex: '\\left|#?\\right|' },
  { label: 'sin', titel: 'Sinus', latex: '\\sin\\left(#?\\right)' },
];

/** Grafiekjacht voor de leerling: per ronde een voorschrift zoeken dat precies op de doelgrafiek past. */
export function GrafiekjachtSpeler({
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
  const doelen = sessie.grafiekjacht?.doelen ?? [];
  const [nu, setNu] = useState(() => Date.now());
  const [fout, setFout] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNu(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const eigen = antwoorden.filter((a) => a.spelerId === spelerId);
  const af = spelerId ? afgewerkt(eigen, spelerId) : new Map<number, LiveAntwoord>();
  const ronde = doelen.findIndex((_, i) => !af.has(i));
  const rij = sessie.stand.find((r) => r.id === spelerId);
  const plaats = sessie.stand.findIndex((r) => r.id === spelerId) + 1;
  const verstreken = sessie.vraagStart ? Math.max(0, nu - new Date(sessie.vraagStart).getTime()) : 0;
  const resterend = sessie.timer ? sessie.timer * 1000 - verstreken : null;

  async function stuur(nr: number, tekst: string) {
    setFout(null);
    try {
      await be.antwoord(sessie.id, nr, tekst);
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  const kop = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-2xl bg-surface px-4 py-2 text-2xl font-bold shadow-sm">{rij?.punten ?? 0} punten</span>
      <span className="text-lg text-slate-600">
        grafiek {Math.min(af.size + 1, doelen.length)} / {doelen.length}
        {plaats > 0 && ` · plaats ${plaats}`}
      </span>
      <span className={`ml-auto rounded-full px-4 py-1 font-mono text-2xl font-bold ${resterend !== null && resterend < 60000 ? 'bg-red-100 text-red-700' : 'bg-surface'}`}>
        ⏱ {tijdTekst(resterend !== null ? Math.max(0, resterend) : verstreken)}
      </span>
    </div>
  );

  if (sessie.status === 'einde' || (resterend !== null && resterend <= 0) || (ronde === -1 && doelen.length > 0)) {
    const gedaan = sessie.status === 'einde';
    return (
      <div className="breed space-y-4">
        {kop}
        <div className="rounded-2xl bg-surface p-6 text-center shadow-sm">
          <div className="text-5xl">{ronde === -1 ? '🎉' : '📈'}</div>
          <h1 className="mt-2 text-3xl font-bold">{ronde === -1 ? 'Alle grafieken gevonden!' : gedaan ? 'Het spel is gedaan!' : 'De tijd is om!'}</h1>
          <p className="mt-2 text-xl text-slate-600">
            {rij?.punten ?? 0} punten · {rij?.juist ?? 0} van {doelen.length} zelf gevonden
            {plaats > 0 && ` · plaats ${plaats}`}
          </p>
          {gedaan && nieuwSpel}
        </div>
        <Oplossingen antwoorden={af} doelen={doelen} />
      </div>
    );
  }

  if (!spelerId || ronde === -1) return <Kaart>Verbinden…</Kaart>;

  const pogingen = eigen.filter((a) => a.vraagNr === ronde).sort((a, b) => a.poging - b.poging);
  const wacht = pogingen.some((a) => a.juist === null);
  const fouten = pogingen.filter((a) => a.juist === false).length;
  // De vorige ronde: juist (met punten) of overgeslagen (met het voorschrift).
  const vorige = ronde > 0 ? af.get(ronde - 1) : undefined;
  const vorigeBeloning = vorige?.beloning ? (JSON.parse(vorige.beloning) as GrafiekBeloning) : null;

  return (
    <div className="breed space-y-3">
      {kop}
      {fout && <p className="rounded-lg bg-red-50 px-4 py-2 text-red-700">{fout}</p>}
      {vorige && pogingen.length === 0 && (
        <div className={`rounded-xl px-4 py-2 text-lg ${vorige.punten > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`} data-vorige>
          {vorige.punten > 0 ? `✓ Juist! +${vorige.punten}` : 'De oplossing was:'}
          {vorigeBeloning && (
            <span className="ml-2 inline-block">
              <RichText text={`$y = ${vorigeBeloning.oplossing}$`} />
            </span>
          )}
        </div>
      )}
      <Ronde
        key={ronde}
        doel={doelen[ronde].y}
        basis={BASISFUNCTIES[doelen[ronde].basis]?.naam ?? ''}
        wacht={wacht}
        fouten={fouten}
        onVerstuur={(tekst) => void stuur(ronde, tekst)}
        onOverslaan={() => void stuur(ronde, OVERSLAAN)}
      />
    </div>
  );
}

function Ronde({
  doel,
  basis,
  wacht,
  fouten,
  onVerstuur,
  onOverslaan,
}: {
  doel: (number | null)[];
  basis: string;
  wacht: boolean;
  fouten: number;
  onVerstuur: (tekst: string) => void;
  onOverslaan: () => void;
}) {
  const [tekst, setTekst] = useState('');
  const [editor, setEditor] = useWiskundeEditor();
  const f = useMemo(() => functieVan(tekst), [tekst]);
  const eigen = useMemo(() => (f ? padVan(f) : null), [f]);
  const verstuur = (waarde = tekst) => {
    if (waarde.trim() && functieVan(waarde) && !wacht) onVerstuur(waarde.trim());
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
      <Grafiek doel={doel} eigen={eigen} />
      <div className="space-y-3 rounded-2xl bg-surface p-5 shadow-sm">
        <p className="text-lg">
          Zoek het voorschrift van de <span className="font-semibold text-blue-600">blauwe grafiek</span>. Basisfunctie: <span className="font-semibold">{basis}</span>
        </p>
        <div className="flex justify-end">
          <EditorSchakelaar
            aan={editor}
            onWissel={(aan) => {
              setTekst('');
              setEditor(aan);
            }}
          />
        </div>
        <form
          className="flex flex-wrap items-start gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            verstuur();
          }}
        >
          <span className="pt-3 font-serif text-2xl">y =</span>
          {editor ? (
            <WiskundeInvoer autoFocus label="Voorschrift" onChange={setTekst} onEnter={verstuur} extra={EXTRA} />
          ) : (
            <input
              autoFocus
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              maxLength={200}
              placeholder="bv. 2(x-3)^2+1"
              aria-label="Voorschrift"
              className={`min-w-48 flex-1 ${invoerKlasse}`}
            />
          )}
          <button
            type="submit"
            disabled={!f || wacht}
            className="rounded-xl bg-[var(--accent)] px-6 py-3 text-lg font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {wacht ? '⏳' : 'Indienen'}
          </button>
        </form>
        <p className="text-sm text-slate-500">
          {tekst.trim() && !f
            ? 'Dit voorschrift kan ik nog niet lezen.'
            : 'Je eigen grafiek verschijnt oranje. Tip: |x| voor absolute waarde, sqrt(x) of √ voor een wortel, 2^x voor een macht.'}
        </p>
        {fouten > 0 && !wacht && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700" data-nog-niet>
            ✗ Nog niet juist{fouten > 1 ? ` (${fouten}×)` : ''}. Vergelijk je grafiek met de blauwe.
          </p>
        )}
        {fouten >= POGINGEN_VOOR_OVERSLAAN && !wacht && (
          <button type="button" onClick={onOverslaan} className="text-sm text-slate-600 underline">
            Oplossing tonen en verder (0 punten)
          </button>
        )}
      </div>
    </div>
  );
}

/** Na afloop: elke grafiek met het voorschrift (bij de leerling: enkel wat die gevonden of overgeslagen heeft). */
export function Oplossingen({
  doelen,
  antwoorden,
  voorschriften,
}: {
  doelen: { basis: string; y: (number | null)[] }[];
  antwoorden?: Map<number, LiveAntwoord>;
  /** Bij de leerkracht: alle voorschriften. */
  voorschriften?: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {doelen.map((d, i) => {
        const a = antwoorden?.get(i);
        const oplossing = voorschriften?.[i] ?? (a?.beloning ? (JSON.parse(a.beloning) as GrafiekBeloning).oplossing : null);
        return (
          <div key={i} className="rounded-xl bg-surface p-2 shadow-sm">
            <Grafiek doel={d.y} juist={!!a && a.punten > 0} klein />
            <div className="mt-1 flex items-center gap-2 px-1 text-sm">
              <span className="font-semibold text-slate-500">{i + 1}.</span>
              {oplossing ? <RichText text={`$y = ${oplossing}$`} /> : <span className="text-slate-400">niet gevonden</span>}
              {a && <span className="ml-auto">{a.punten > 0 ? `✓ +${a.punten}` : '⏭'}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 text-lg shadow-sm">{children}</div>;
}
