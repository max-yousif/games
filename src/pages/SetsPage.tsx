import { useState } from 'react';
import { Button, FileButton, Notice, PageHeader } from '../components/ui';
import { BackupError, bestandsnaam, downloadJson, leesBestand, setBestand, voegSamen } from '../lib/backup';
import { nu } from '../lib/ids';
import { downloadQuestionTemplate, QuestionImportError, readSpreadsheet, rowsToQuestions, UnsupportedFileError } from '../lib/importFile';
import { dupliceerSet, nieuweSet, speelbareVragen } from '../lib/questions';
import { ga, href } from '../lib/route';
import { ontbrekendeVoorbeelden, type Store } from '../lib/store';
import type { Vak, Vragenset } from '../lib/types';

export const VAK_LABELS: Record<Vak, string> = { wiskunde: 'Wiskunde', python: 'Python', andere: 'Andere' };

export function SetsPage({ store }: { store: Store }) {
  const [melding, setMelding] = useState<{ tone: 'ok' | 'warn'; tekst: string } | null>(null);
  const sets = [...store.sets].sort((a, b) => b.gewijzigd.localeCompare(a.gewijzigd));
  const ontbrekend = ontbrekendeVoorbeelden(store.sets);

  function nieuw() {
    const s = nieuweSet();
    store.setSets((all) => [...all, s]);
    ga({ pagina: 'set', id: s.id });
  }

  async function importeerExcel(file: File) {
    try {
      const vragen = rowsToQuestions(await readSpreadsheet(file));
      if (vragen.length === 0) throw new QuestionImportError('Er werden geen vragen gevonden in dit bestand.');
      const s: Vragenset = { ...nieuweSet(), titel: file.name.replace(/\.[^.]+$/, ''), vragen };
      store.setSets((all) => [...all, s]);
      ga({ pagina: 'set', id: s.id });
    } catch (e) {
      const bekend = e instanceof QuestionImportError || e instanceof UnsupportedFileError;
      setMelding({ tone: 'warn', tekst: bekend ? e.message : 'Het bestand kon niet gelezen worden.' });
    }
  }

  async function importeerJson(file: File) {
    try {
      const data = leesBestand(await file.text());
      const nieuwe = data.soort === 'set' ? [data.set] : data.backup.sets;
      store.setSets((all) => voegSamen(all, nieuwe));
      setMelding({ tone: 'ok', tekst: `${nieuwe.length} vragenset(s) toegevoegd.` });
    } catch (e) {
      setMelding({ tone: 'warn', tekst: e instanceof BackupError ? e.message : 'Het bestand kon niet gelezen worden.' });
    }
  }

  function verwijder(s: Vragenset) {
    if (confirm(`Vragenset "${s.titel}" verwijderen? Gespeelde resultaten blijven bewaard.`)) {
      store.setSets((all) => all.filter((x) => x.id !== s.id));
    }
  }

  return (
    <div>
      <PageHeader title="Vragensets">
        <Button variant="primary" onClick={nieuw}>
          + Nieuwe vragenset
        </Button>
        <FileButton accept=".xlsx,.csv" onFile={importeerExcel}>
          Importeren uit Excel…
        </FileButton>
        <FileButton accept=".json,application/json" onFile={importeerJson}>
          Openen uit bestand…
        </FileButton>
      </PageHeader>

      {melding && (
        <div className="mb-4">
          <Notice tone={melding.tone}>{melding.tekst}</Notice>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sets.map((s) => {
          const categorieen = [...new Set(s.vragen.map((v) => v.categorie.trim()).filter(Boolean))];
          const klaar = speelbareVragen(s).length;
          return (
            <div key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">{VAK_LABELS[s.vak]}</span>
                {s.leerjaar && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{s.leerjaar}</span>}
                {s.voorbeeld && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">voorbeeld</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{s.titel}</h2>
              {s.beschrijving && <p className="mt-1 text-sm text-slate-600">{s.beschrijving}</p>}
              <p className="mt-2 text-sm text-slate-500">
                {s.vragen.length} vragen{klaar < s.vragen.length && ` (${s.vragen.length - klaar} onvolledig)`}
                {categorieen.length > 0 && ` · ${categorieen.join(', ')}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <a href={href({ pagina: 'spelen', setId: s.id })} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
                  Spelen
                </a>
                <a href={href({ pagina: 'set', id: s.id })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  Bewerken
                </a>
                <Button onClick={() => store.setSets((all) => [...all, dupliceerSet(s)])}>Dupliceren</Button>
                <Button onClick={() => downloadJson(bestandsnaam(s.titel, 'json'), setBestand(s))}>Als bestand</Button>
                <Button variant="ghost" className="ml-auto text-red-600" onClick={() => verwijder(s)} title="Verwijderen" aria-label={`${s.titel} verwijderen`}>
                  🗑
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {sets.length === 0 && <Notice>Nog geen vragensets. Maak een nieuwe set of importeer er een uit Excel.</Notice>}

      <div className="mt-8 space-y-2 text-sm text-slate-600">
        <p>
          <strong>Excel-import:</strong> de eerste rij bevat de kolomtitels <em>Type, Categorie, Punten, Vraag, Antwoord</em>, en optioneel{' '}
          <em>Ook juist</em> (andere juiste antwoorden bij een open vraag), <em>Fout antwoord 1–3</em> (meerkeuze), <em>Tolerantie</em> (getal) en <em>Uitleg</em>. Types: open, meerkeuze, waar/onwaar, getal, invullen,
          ordenen en koppelen; het sjabloon bevat van elk een voorbeeld.{' '}
          <button type="button" className="text-[var(--accent)] underline" onClick={() => downloadQuestionTemplate()}>
            Download het sjabloon
          </button>
          .
        </p>
        {ontbrekend.length > 0 && (
          <p>
            <button
              type="button"
              className="text-[var(--accent)] underline"
              onClick={() => store.setSets((all) => [...all, ...ontbrekend.map((v) => ({ ...v, gewijzigd: nu() }))])}
            >
              Voorbeeldsets opnieuw toevoegen
            </button>{' '}
            ({ontbrekend.map((v) => v.titel).join(', ')})
          </p>
        )}
      </div>
    </div>
  );
}
