import { useState, type FormEvent } from 'react';
import { GatSymbool, RichText } from '../components/RichText';
import { gatKleur, LETTERS } from '../lib/vraagtypes';
import { antwoordWeergave } from './logic';
import { LiveFout, type PubliekeVraag } from './types';
import { WiskundeInvoer } from './WiskundeInvoer';

const OPTIE_KLEUREN = ['bg-red-500', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-600'];

export const foutTekst = (e: unknown) => (e instanceof LiveFout ? e.message : 'Er ging iets mis. Controleer de internetverbinding en probeer opnieuw.');

export function AntwoordTekst({ vraag, antwoord }: { vraag: PubliekeVraag; antwoord: string }) {
  return <RichText text={antwoordWeergave(vraag, antwoord)} className="inline font-semibold" />;
}

/** Invoer voor het antwoord, afhankelijk van het type vraag. */
export function Beantwoord({ vraag: v, onVerstuur }: { vraag: PubliekeVraag; onVerstuur: (antwoord: string) => Promise<void> }) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verstuur(antwoord: string) {
    if (bezig) return;
    setBezig(true);
    setFout(null);
    try {
      await onVerstuur(antwoord);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div>
      {v.type === 'meerkeuze' || v.type === 'waaronwaar' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {v.opties.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={bezig}
              onClick={() => void verstuur(String(i))}
              className={`flex min-h-24 items-center gap-4 rounded-2xl px-5 py-4 text-left text-2xl font-medium text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${
                v.type === 'waaronwaar' ? (i === 0 ? 'bg-emerald-600' : 'bg-red-600') : OPTIE_KLEUREN[i % OPTIE_KLEUREN.length]
              }`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/25 text-xl font-bold">{LETTERS[i]}</span>
              <RichText text={o} className="[&_code]:bg-white/20 [&_code]:text-white" />
            </button>
          ))}
        </div>
      ) : v.type === 'invullen' ? (
        <Invullen aantal={v.gaten} bezig={bezig} onVerstuur={verstuur} />
      ) : v.type === 'ordenen' ? (
        <Ordenen items={v.opties} code={v.alsCode} bezig={bezig} onVerstuur={verstuur} />
      ) : v.type === 'koppelen' ? (
        <Koppelen links={v.links} rechts={v.rechts} bezig={bezig} onVerstuur={verstuur} />
      ) : (
        <TekstInvoer getal={v.type === 'getal'} bezig={bezig} onVerstuur={verstuur} />
      )}
      {fout && <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-red-700">{fout}</p>}
    </div>
  );
}

const invoerKlasse = 'rounded-xl border-2 border-slate-300 px-4 py-3 font-mono text-2xl outline-none focus:border-[var(--accent)]';

function VerstuurKnop({ disabled }: { disabled: boolean }) {
  return (
    <button type="submit" disabled={disabled} className="rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white disabled:opacity-50">
      Versturen
    </button>
  );
}

const EDITOR_SLEUTEL = 'klasspelen.wiskunde-editor';

/** Wiskunde-editor aan of uit; de keuze van de leerling wordt onthouden op deze laptop. */
function useWiskundeEditor(): [boolean, (aan: boolean) => void] {
  const [aan, setAan] = useState(() => {
    try {
      return localStorage.getItem(EDITOR_SLEUTEL) === '1';
    } catch {
      return false;
    }
  });
  const zet = (waarde: boolean) => {
    setAan(waarde);
    try {
      localStorage.setItem(EDITOR_SLEUTEL, waarde ? '1' : '0');
    } catch {
      // geen opslag: enkel voor deze vraag
    }
  };
  return [aan, zet];
}

function EditorSchakelaar({ aan, onWissel }: { aan: boolean; onWissel: (aan: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onWissel(!aan)}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${aan ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
      title="Typ breuken, machten, wortels en maal zoals op papier"
    >
      <span className="font-serif">√x</span> Wiskunde-editor {aan ? 'aan' : 'uit'}
    </button>
  );
}

function TekstInvoer({ getal, bezig, onVerstuur }: { getal: boolean; bezig: boolean; onVerstuur: (a: string) => void }) {
  const [tekst, setTekst] = useState('');
  const [editor, setEditor] = useWiskundeEditor();
  const verstuur = () => {
    if (tekst.trim()) onVerstuur(tekst.trim());
  };
  return (
    <>
      <div className="mb-2 flex justify-end">
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
        {editor ? (
          <WiskundeInvoer autoFocus label="Je antwoord" onChange={setTekst} onEnter={verstuur} />
        ) : (
          <input
            autoFocus
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            maxLength={500}
            inputMode={getal ? 'decimal' : undefined}
            placeholder={getal ? 'Typ een getal' : 'Typ je antwoord'}
            aria-label="Je antwoord"
            className={`min-w-64 flex-1 ${invoerKlasse}`}
          />
        )}
        <VerstuurKnop disabled={!tekst.trim() || bezig} />
      </form>
      <p className="mt-2 text-sm text-slate-500">
        {editor
          ? 'Typ / voor een breuk en ^ voor een macht, of gebruik de knoppen. Enter = versturen.'
          : getal
            ? 'Een kommagetal (12,5) of breuk (3/4) mag.'
            : 'Tip: schrijf machten als x^2, breuken als 1/2 en decimalen met een komma, of zet de wiskunde-editor aan.'}
      </p>
    </>
  );
}

function Invullen({ aantal, bezig, onVerstuur }: { aantal: number; bezig: boolean; onVerstuur: (a: string) => void }) {
  const [waarden, setWaarden] = useState<string[]>(() => Array<string>(aantal).fill(''));
  const [editor, setEditor] = useWiskundeEditor();
  const klaar = waarden.every((w) => w.trim());
  const zet = (i: number, waarde: string) => setWaarden((ws) => ws.map((x, j) => (j === i ? waarde : x)));
  const verstuur = () => {
    if (klaar) onVerstuur(JSON.stringify(waarden.map((w) => w.trim())));
  };
  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        verstuur();
      }}
    >
      <div className="flex justify-end">
        <EditorSchakelaar
          aan={editor}
          onWissel={(aan) => {
            setWaarden(Array<string>(aantal).fill(''));
            setEditor(aan);
          }}
        />
      </div>
      {waarden.map((w, i) => (
        <div key={`${editor}-${i}`} className="flex items-start gap-3">
          <span className="pt-2">
            <GatSymbool nr={i} groot />
          </span>
          {editor ? (
            <WiskundeInvoer autoFocus={i === 0} label={`Gat ${i + 1}`} kleur={gatKleur(i)} onChange={(waarde) => zet(i, waarde)} onEnter={verstuur} />
          ) : (
            <input
              autoFocus={i === 0}
              value={w}
              maxLength={200}
              aria-label={`Gat ${i + 1}`}
              onChange={(e) => zet(i, e.target.value)}
              className={`flex-1 ${invoerKlasse}`}
              style={{ borderColor: gatKleur(i) }}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end">
        <VerstuurKnop disabled={!klaar || bezig} />
      </div>
    </form>
  );
}

function Ordenen({ items, code, bezig, onVerstuur }: { items: string[]; code: boolean; bezig: boolean; onVerstuur: (a: string) => void }) {
  const [volgorde, setVolgorde] = useState(items);
  const wissel = (i: number, j: number) =>
    setVolgorde((v) => {
      if (j < 0 || j >= v.length) return v;
      const n = [...v];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <div>
      <p className="mb-2 text-slate-600">Zet in de juiste volgorde met de pijltjes.</p>
      <ol className="space-y-2">
        {volgorde.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2">
            <span className="w-6 font-bold text-slate-400">{i + 1}.</span>
            <div className="min-w-0 flex-1">{code ? <pre className="overflow-x-auto font-mono text-lg whitespace-pre">{item}</pre> : <RichText text={item} className="text-xl" />}</div>
            <button type="button" aria-label="Omhoog" disabled={i === 0} onClick={() => wissel(i, i - 1)} className="rounded-lg bg-slate-100 px-3 py-2 text-xl hover:bg-slate-200 disabled:opacity-30">
              ↑
            </button>
            <button
              type="button"
              aria-label="Omlaag"
              disabled={i === volgorde.length - 1}
              onClick={() => wissel(i, i + 1)}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xl hover:bg-slate-200 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={bezig}
          onClick={() => onVerstuur(JSON.stringify(volgorde))}
          className="rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white disabled:opacity-50"
        >
          Versturen
        </button>
      </div>
    </div>
  );
}

function Koppelen({ links, rechts, bezig, onVerstuur }: { links: string[]; rechts: string[]; bezig: boolean; onVerstuur: (a: string) => void }) {
  const [keuze, setKeuze] = useState<string[]>(() => links.map(() => ''));
  const klaar = keuze.every(Boolean);
  return (
    <div>
      <div className="mb-4 grid gap-2 rounded-xl bg-white p-4 sm:grid-cols-2">
        {rechts.map((r, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white">{LETTERS[i]}</span>
            <RichText text={r} className="text-lg" />
          </div>
        ))}
      </div>
      <p className="mb-2 text-slate-600">Kies bij elk item de juiste letter.</p>
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-white">{i + 1}</span>
            <RichText text={l} className="flex-1 text-xl" />
            <div className="flex flex-wrap gap-1">
              {rechts.map((r, j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setKeuze((k) => k.map((x, n) => (n === i ? r : x)))}
                  className={`h-10 w-10 rounded-lg text-lg font-bold ${keuze[i] === r ? 'bg-[var(--accent)] text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                  aria-label={`${i + 1} koppelen aan ${LETTERS[j]}`}
                >
                  {LETTERS[j]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!klaar || bezig}
          onClick={() => onVerstuur(JSON.stringify(keuze))}
          className="rounded-xl bg-[var(--accent)] px-8 py-3 text-xl font-semibold text-white disabled:opacity-50"
        >
          Versturen
        </button>
      </div>
    </div>
  );
}
