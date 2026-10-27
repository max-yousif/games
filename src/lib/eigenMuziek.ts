import { useEffect, useState } from 'react';

/**
 * Eigen nummers van de leerkracht (mp3, m4a, wav ...), bewaard in deze browser (IndexedDB): ze gaan
 * niet naar de server of de cloud. Afspelen gebeurt met een gewoon audio-element.
 */

export interface EigenNummer {
  id: string;
  naam: string;
  grootte: number;
}

interface Opgeslagen extends EigenNummer {
  data: Blob;
}

/** Maximale grootte per nummer (bytes). */
export const MAX_GROOTTE = 40 * 1024 * 1024;

const DB = 'klasspelen-muziek';
const STORE = 'nummers';

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fout) => {
    if (typeof indexedDB === 'undefined') return fout(new Error('Geen opslag in deze browser.'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fout(r.error);
  });
}

async function doe<T>(modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((ok, fout) => {
    const tx = db.transaction(STORE, modus);
    const r = f(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      ok(r.result);
    };
    tx.onerror = () => fout(tx.error);
    tx.onabort = () => fout(tx.error ?? new Error('Opslaan mislukt (te weinig ruimte?).'));
  });
}

const luisteraars = new Set<() => void>();
const meld = () => luisteraars.forEach((l) => l());

export async function eigenNummers(): Promise<EigenNummer[]> {
  const alles = await doe<Opgeslagen[]>('readonly', (s) => s.getAll() as IDBRequest<Opgeslagen[]>);
  return alles.map(({ id, naam, grootte }) => ({ id, naam, grootte })).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

export async function voegNummerToe(bestand: File): Promise<void> {
  if (!bestand.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(bestand.name)) throw new Error(`${bestand.name} is geen muziekbestand.`);
  if (bestand.size > MAX_GROOTTE) throw new Error(`${bestand.name} is te groot (maximaal 40 MB).`);
  const nummer: Opgeslagen = { id: crypto.randomUUID(), naam: bestand.name.replace(/\.[^.]+$/, ''), grootte: bestand.size, data: bestand };
  await doe('readwrite', (s) => s.put(nummer));
  meld();
}

export async function verwijderNummer(id: string): Promise<void> {
  await doe('readwrite', (s) => s.delete(id));
  meld();
}

async function haalNummer(id: string): Promise<Blob | null> {
  const n = await doe<Opgeslagen | undefined>('readonly', (s) => s.get(id) as IDBRequest<Opgeslagen | undefined>);
  return n?.data ?? null;
}

/** De eigen nummers, bijgewerkt na toevoegen of verwijderen. */
export function useEigenNummers(): EigenNummer[] {
  const [lijst, setLijst] = useState<EigenNummer[]>([]);
  useEffect(() => {
    let actief = true;
    const laad = () => void eigenNummers().then((l) => actief && setLijst(l), () => {});
    laad();
    luisteraars.add(laad);
    return () => {
      actief = false;
      luisteraars.delete(laad);
    };
  }, []);
  return lijst;
}

// ---------- Afspelen ----------

/**
 * Speelt één eigen nummer (id) in een lus, of alle eigen nummers na elkaar in willekeurige
 * volgorde (id = null). Geeft een functie terug om te stoppen en een om het volume te zetten.
 */
export function speelEigen(id: string | null, volume: number): { stop: () => void; zetVolume: (v: number) => void } {
  const audio = new Audio();
  audio.volume = volume;
  let url: string | null = null;
  let gestopt = false;
  let rij: string[] = [];

  const ruimOp = () => {
    if (url) URL.revokeObjectURL(url);
    url = null;
  };
  const probeer = () => void audio.play().catch(() => {});
  // Browsers spelen pas af na een klik: dan opnieuw proberen.
  const naKlik = () => {
    if (!gestopt && audio.paused && audio.src) probeer();
  };
  window.addEventListener('pointerdown', naKlik);
  window.addEventListener('keydown', naKlik);

  const volgende = async () => {
    if (gestopt) return;
    if (rij.length === 0) {
      const alle = id ? [id] : (await eigenNummers().catch(() => [])).map((n) => n.id);
      rij = alle.sort(() => Math.random() - 0.5);
      if (rij.length === 0) return;
    }
    const blob = await haalNummer(rij.shift()!).catch(() => null);
    if (gestopt || !blob) return;
    ruimOp();
    url = URL.createObjectURL(blob);
    audio.src = url;
    probeer();
  };
  audio.addEventListener('ended', () => void volgende());
  void volgende();

  return {
    stop: () => {
      gestopt = true;
      audio.pause();
      audio.removeAttribute('src');
      ruimOp();
      window.removeEventListener('pointerdown', naKlik);
      window.removeEventListener('keydown', naKlik);
    },
    zetVolume: (v) => {
      audio.volume = Math.max(0, Math.min(1, v));
    },
  };
}
