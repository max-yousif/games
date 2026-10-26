import { useEffect, useState } from 'react';

/**
 * Muziek en geluidseffecten, gemaakt met de Web Audio API (geen geluidsbestanden nodig).
 * De keuzes worden per browser onthouden.
 */

export type MuziekStijl = 'uit' | 'dance' | 'beat' | 'arcade' | 'rustig' | 'vrolijk' | 'spannend';
export type Effect = 'klik' | 'onthul' | 'juist' | 'fout' | 'tik' | 'schijf' | 'fanfare' | 'start' | 'binnen' | 'rol' | 'boem' | 'lont';

export interface GeluidInstellingen {
  /** Muziek in de wachtruimte. */
  wacht: MuziekStijl;
  /** Muziek tijdens het spel. */
  spel: MuziekStijl;
  effecten: boolean;
  /** 0 tot 1. */
  volume: number;
}

export const MUZIEK_NAMEN: Record<MuziekStijl, string> = {
  uit: 'Geen muziek',
  dance: 'Dance',
  beat: 'Hiphop-beat',
  arcade: 'Arcade',
  rustig: 'Rustig',
  vrolijk: 'Vrolijk',
  spannend: 'Spannend',
};

const SLEUTEL = 'games.v2.geluid';
const STANDAARD: GeluidInstellingen = { wacht: 'dance', spel: 'uit', effecten: true, volume: 0.6 };

function lees(): GeluidInstellingen {
  try {
    const nieuw = localStorage.getItem(SLEUTEL);
    if (nieuw) return { ...STANDAARD, ...(JSON.parse(nieuw) as Partial<GeluidInstellingen>) };
    // Oude instellingen overnemen, behalve de wachtmuziek (de nieuwe standaard heeft een beat).
    const { wacht: _, ...oud } = JSON.parse(localStorage.getItem('games.v1.geluid') ?? '{}') as Partial<GeluidInstellingen>;
    return { ...STANDAARD, ...oud };
  } catch {
    return STANDAARD;
  }
}

let instellingen = lees();
const luisteraars = new Set<() => void>();

export function zetGeluid(patch: Partial<GeluidInstellingen>) {
  instellingen = { ...instellingen, ...patch };
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(instellingen));
  } catch {
    // niet bewaard: geldt tot de pagina sluit
  }
  for (const l of luisteraars) l();
  if (muziekGain && ctx) muziekGain.gain.setTargetAtTime(instellingen.volume * 0.22, ctx.currentTime, 0.1);
}

export function useGeluid(): [GeluidInstellingen, (patch: Partial<GeluidInstellingen>) => void] {
  const [, ververs] = useState(0);
  useEffect(() => {
    const l = () => ververs((n) => n + 1);
    luisteraars.add(l);
    return () => void luisteraars.delete(l);
  }, []);
  return [instellingen, zetGeluid];
}

// ---------- Audio ----------

let ctx: AudioContext | null = null;
let muziekGain: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    muziekGain = ctx.createGain();
    muziekGain.gain.value = instellingen.volume * 0.22;
    muziekGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

// Browsers laten pas geluid toe na een klik of toets: dan meteen ontgrendelen.
if (typeof window !== 'undefined') {
  const ontgrendel = () => {
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', ontgrendel);
  window.addEventListener('keydown', ontgrendel);
}

interface Noot {
  freq: number;
  start: number;
  duur: number;
  type?: OscillatorType;
  gain?: number;
  /** Eindfrequentie (glijden). */
  naar?: number;
}

function noot(c: AudioContext, doel: AudioNode, n: Noot) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = n.type ?? 'sine';
  osc.frequency.setValueAtTime(n.freq, n.start);
  if (n.naar) osc.frequency.exponentialRampToValueAtTime(n.naar, n.start + n.duur);
  const piek = n.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, n.start);
  g.gain.exponentialRampToValueAtTime(piek, n.start + Math.min(0.02, n.duur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, n.start + n.duur);
  osc.connect(g).connect(doel);
  osc.start(n.start);
  osc.stop(n.start + n.duur + 0.05);
}

function ruis(c: AudioContext, doel: AudioNode, start: number, duur: number, gain: number, filter: { van: number; naar?: number; type?: BiquadFilterType }) {
  const lengte = Math.max(1, Math.floor(c.sampleRate * duur));
  const buf = c.createBuffer(1, lengte, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < lengte; i++) data[i] = Math.random() * 2 - 1;
  const bron = c.createBufferSource();
  bron.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter.type ?? 'bandpass';
  f.frequency.setValueAtTime(filter.van, start);
  if (filter.naar) f.frequency.exponentialRampToValueAtTime(filter.naar, start + duur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duur);
  bron.connect(f).connect(g).connect(doel);
  bron.start(start);
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Een geluidseffect afspelen (als effecten aan staan). */
export function speel(effect: Effect) {
  if (!instellingen.effecten || instellingen.volume <= 0) return;
  const c = audio();
  if (!c) return;
  const uit = c.createGain();
  uit.gain.value = instellingen.volume * 0.7;
  uit.connect(c.destination);
  const t = c.currentTime + 0.01;
  switch (effect) {
    case 'klik':
      noot(c, uit, { freq: 1200, start: t, duur: 0.05, type: 'triangle', gain: 0.25 });
      break;
    case 'rol':
      noot(c, uit, { freq: 1500, start: t, duur: 0.03, type: 'square', gain: 0.06 });
      break;
    case 'tik':
      noot(c, uit, { freq: 1000, start: t, duur: 0.04, type: 'square', gain: 0.08 });
      break;
    case 'binnen':
      noot(c, uit, { freq: 880, start: t, duur: 0.08, type: 'sine', gain: 0.2 });
      noot(c, uit, { freq: 1320, start: t + 0.07, duur: 0.12, type: 'sine', gain: 0.2 });
      break;
    case 'start':
      ruis(c, uit, t, 0.45, 0.35, { van: 300, naar: 4000 });
      noot(c, uit, { freq: 440, start: t + 0.3, duur: 0.25, type: 'triangle', gain: 0.2, naar: 880 });
      break;
    case 'onthul':
      // Het juiste antwoord verschijnt: een heldere klokjesklank.
      [76, 83, 88].forEach((m, i) => noot(c, uit, { freq: hz(m), start: t + i * 0.09, duur: 0.9 - i * 0.15, type: 'sine', gain: 0.28 }));
      noot(c, uit, { freq: hz(100), start: t + 0.18, duur: 0.5, type: 'sine', gain: 0.06 });
      break;
    case 'juist':
      [72, 76, 79, 84].forEach((m, i) => noot(c, uit, { freq: hz(m), start: t + i * 0.07, duur: 0.35, type: 'triangle', gain: 0.3 }));
      noot(c, uit, { freq: hz(96), start: t + 0.28, duur: 0.4, type: 'sine', gain: 0.08 });
      break;
    case 'fout':
      noot(c, uit, { freq: 180, start: t, duur: 0.22, type: 'sawtooth', gain: 0.18, naar: 140 });
      noot(c, uit, { freq: 140, start: t + 0.22, duur: 0.35, type: 'sawtooth', gain: 0.18, naar: 90 });
      break;
    case 'schijf':
      noot(c, uit, { freq: 900, start: t, duur: 0.25, type: 'sine', gain: 0.2, naar: 250 });
      noot(c, uit, { freq: 90, start: t + 0.25, duur: 0.15, type: 'sine', gain: 0.5, naar: 50 });
      ruis(c, uit, t + 0.25, 0.08, 0.2, { van: 600, type: 'lowpass' });
      break;
    case 'lont':
      // Tik van de bom: hoog en kort.
      noot(c, uit, { freq: 1800, start: t, duur: 0.03, type: 'square', gain: 0.07 });
      noot(c, uit, { freq: 900, start: t + 0.01, duur: 0.04, type: 'sine', gain: 0.1 });
      break;
    case 'boem':
      ruis(c, uit, t, 1.6, 0.9, { van: 2500, naar: 80, type: 'lowpass' });
      noot(c, uit, { freq: 120, start: t, duur: 1.2, type: 'sine', gain: 0.9, naar: 30 });
      noot(c, uit, { freq: 60, start: t + 0.05, duur: 1.4, type: 'triangle', gain: 0.6, naar: 25 });
      break;
    case 'fanfare': {
      const melodie: [number, number, number][] = [
        [67, 0, 0.12],
        [72, 0.12, 0.12],
        [76, 0.24, 0.12],
        [79, 0.36, 0.3],
        [76, 0.7, 0.12],
        [79, 0.82, 0.7],
      ];
      for (const [m, s, d] of melodie) {
        noot(c, uit, { freq: hz(m), start: t + s, duur: d + 0.1, type: 'square', gain: 0.1 });
        noot(c, uit, { freq: hz(m), start: t + s, duur: d + 0.1, type: 'triangle', gain: 0.2 });
      }
      [60, 64, 67, 72].forEach((m) => noot(c, uit, { freq: hz(m), start: t + 0.82, duur: 1.2, type: 'triangle', gain: 0.12 }));
      break;
    }
  }
}

// ---------- Muziek ----------

/** Drums: basdrum, snare, hi-hat en handklap. */
function kick(c: AudioContext, doel: AudioNode, t: number, gain = 0.9) {
  noot(c, doel, { freq: 160, naar: 42, start: t, duur: 0.28, type: 'sine', gain });
}
function snare(c: AudioContext, doel: AudioNode, t: number, gain = 0.35) {
  ruis(c, doel, t, 0.16, gain, { van: 1800 });
  noot(c, doel, { freq: 200, naar: 150, start: t, duur: 0.08, type: 'triangle', gain: gain * 0.6 });
}
function hihat(c: AudioContext, doel: AudioNode, t: number, gain = 0.09, open = false) {
  ruis(c, doel, t, open ? 0.16 : 0.035, gain, { van: 8000, type: 'highpass' });
}
function klap(c: AudioContext, doel: AudioNode, t: number, gain = 0.3) {
  for (const d of [0, 0.012, 0.024]) ruis(c, doel, t + d, 0.05, gain * 0.6, { van: 1300 });
  ruis(c, doel, t + 0.036, 0.14, gain, { van: 1200 });
}

interface Stijl {
  bpm: number;
  /** Noten voor tel i (achtste noten), in maten van 8. */
  tel: (c: AudioContext, doel: AudioNode, i: number, t: number, achtste: number) => void;
}

const AKKOORDEN: Record<Exclude<MuziekStijl, 'uit'>, number[][]> = {
  dance: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  beat: [
    [57, 60, 64, 67],
    [50, 53, 57, 60],
    [55, 59, 62, 65],
    [48, 52, 55, 59],
  ],
  arcade: [
    [60, 64, 67],
    [57, 60, 64],
    [53, 57, 60],
    [55, 59, 62],
  ],
  rustig: [
    [60, 64, 67, 71],
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 62, 67],
  ],
  vrolijk: [
    [60, 64, 67],
    [55, 59, 62],
    [57, 60, 64],
    [53, 57, 60],
  ],
  spannend: [
    [57, 60, 64],
    [57, 60, 64],
    [53, 57, 60],
    [52, 56, 59],
  ],
};

const STIJLEN: Record<Exclude<MuziekStijl, 'uit'>, Stijl> = {
  // Four-on-the-floor: basdrum op elke tel, klap op 2 en 4, open hi-hat en bas op de tussentel.
  dance: {
    bpm: 124,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.dance[Math.floor(i / 8) % 4];
      const opTel = i % 2 === 0;
      if (opTel) kick(c, doel, t);
      else {
        hihat(c, doel, t, 0.1, true);
        noot(c, doel, { freq: hz(akk[0] - 24), start: t, duur: a * 0.9, type: 'sawtooth', gain: 0.16 });
        // Akkoordstoot.
        for (const m of akk) noot(c, doel, { freq: hz(m + 12), start: t, duur: a * 0.6, type: 'square', gain: 0.035 });
      }
      if (i % 4 === 2) klap(c, doel, t);
      hihat(c, doel, t + a / 2, 0.05);
      // Een kort melodietje in de tweede helft van elke 2 maten.
      const melodie = [-1, -1, -1, -1, -1, -1, -1, -1, 2, -1, 1, -1, 2, 0, -1, 1];
      const m = melodie[i % 16];
      if (m >= 0) noot(c, doel, { freq: hz(akk[m] + 24), start: t, duur: a * 0.8, type: 'triangle', gain: 0.12 });
    },
  },
  // Hiphop: basdrum op 1 en "en" van 3, snare op 2 en 4, hi-hats met swing, elektrische piano.
  beat: {
    bpm: 90,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.beat[Math.floor(i / 8) % 4];
      const swing = i % 2 === 1 ? a * 0.18 : 0;
      if ([0, 5, 7].includes(i % 8) || (i % 16 === 10)) kick(c, doel, t + swing, 0.85);
      if (i % 4 === 2) snare(c, doel, t, 0.32);
      hihat(c, doel, t + swing, i % 2 === 0 ? 0.08 : 0.05);
      if (i % 8 === 0) for (const m of akk) noot(c, doel, { freq: hz(m), start: t, duur: a * 7, type: 'sine', gain: 0.09 });
      if (i % 8 === 0 || i % 8 === 3) noot(c, doel, { freq: hz(akk[0] - 24), start: t + swing, duur: a * 1.6, type: 'triangle', gain: 0.35 });
    },
  },
  // Chiptune: snelle arpeggio's, blokgolf-melodie en een stevige beat.
  arcade: {
    bpm: 140,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.arcade[Math.floor(i / 8) % 4];
      noot(c, doel, { freq: hz(akk[i % 3] + 12), start: t, duur: a * 0.45, type: 'square', gain: 0.04 });
      noot(c, doel, { freq: hz(akk[(i + 1) % 3] + 12), start: t + a / 2, duur: a * 0.45, type: 'square', gain: 0.03 });
      const melodie = [2, -1, 1, 2, -1, 0, 1, -1];
      const m = melodie[i % 8];
      if (m >= 0 && Math.floor(i / 8) % 2 === 1) noot(c, doel, { freq: hz(akk[m] + 24), start: t, duur: a * 0.9, type: 'square', gain: 0.05 });
      if (i % 2 === 0) noot(c, doel, { freq: hz(akk[0] - 12), start: t, duur: a * 0.8, type: 'triangle', gain: 0.3 });
      if (i % 4 === 0) kick(c, doel, t, 0.7);
      if (i % 4 === 2) snare(c, doel, t, 0.25);
      hihat(c, doel, t, 0.04);
    },
  },
  rustig: {
    bpm: 76,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.rustig[Math.floor(i / 8) % 4];
      const patroon = [0, 1, 2, 3, 2, 1, 2, 3];
      noot(c, doel, { freq: hz(akk[patroon[i % 8]] + 12), start: t, duur: a * 1.8, type: 'sine', gain: 0.22 });
      if (i % 8 === 0) noot(c, doel, { freq: hz(akk[0] - 12), start: t, duur: a * 7.5, type: 'triangle', gain: 0.25 });
    },
  },
  vrolijk: {
    bpm: 118,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.vrolijk[Math.floor(i / 8) % 4];
      const melodie = [2, 1, 0, 1, 2, 2, 1, -1];
      const m = melodie[i % 8];
      if (m >= 0) noot(c, doel, { freq: hz(akk[m] + 12), start: t, duur: a * 0.8, type: 'square', gain: 0.07 });
      if (i % 4 === 0) noot(c, doel, { freq: hz(akk[0] - 12), start: t, duur: a * 1.5, type: 'triangle', gain: 0.3 });
      if (i % 2 === 1) ruis(c, doel, t, 0.04, 0.08, { van: 8000, type: 'highpass' });
      if (i % 4 === 0) kick(c, doel, t, 0.6);
      if (i % 4 === 2) snare(c, doel, t, 0.22);
    },
  },
  spannend: {
    bpm: 104,
    tel: (c, doel, i, t, a) => {
      const akk = AKKOORDEN.spannend[Math.floor(i / 8) % 4];
      noot(c, doel, { freq: hz(akk[0] - 24), start: t, duur: a * 0.9, type: 'sawtooth', gain: 0.12 });
      noot(c, doel, { freq: hz(akk[0] - 12), start: t + a / 2, duur: a * 0.4, type: 'triangle', gain: 0.1 });
      ruis(c, doel, t, 0.03, 0.06, { van: 9000, type: 'highpass' });
      if (i % 8 === 6) noot(c, doel, { freq: hz(akk[2] + 12), start: t, duur: a * 1.5, type: 'sine', gain: 0.12 });
      if (i % 8 === 0 || i % 8 === 3) kick(c, doel, t, 0.7);
      if (i % 8 === 4) snare(c, doel, t, 0.25);
    },
  },
};

let speler: { stijl: MuziekStijl; stop: () => void } | null = null;

function startMuziek(stijl: MuziekStijl) {
  if (speler?.stijl === stijl) return;
  speler?.stop();
  speler = null;
  if (stijl === 'uit') return;
  const c = audio();
  if (!c || !muziekGain) return;
  const s = STIJLEN[stijl];
  const achtste = 60 / s.bpm / 2;
  let volgende = c.currentTime + 0.1;
  let i = 0;
  // Vooruit plannen: elke 100 ms de noten van de volgende 0,4 s klaarzetten.
  const id = window.setInterval(() => {
    while (volgende < c.currentTime + 0.4) {
      if (c.state === 'running') s.tel(c, muziekGain!, i, volgende, achtste);
      volgende += achtste;
      i++;
    }
  }, 100);
  speler = { stijl, stop: () => window.clearInterval(id) };
}

function stopMuziek() {
  speler?.stop();
  speler = null;
}

/** Speelt wacht- of spelmuziek zolang de component zichtbaar is (volgens de instellingen). */
export function useMuziek(soort: 'wacht' | 'spel' | null) {
  const [inst] = useGeluid();
  const stijl = soort ? inst[soort] : 'uit';
  useEffect(() => {
    startMuziek(stijl);
    return () => stopMuziek();
  }, [stijl]);
}
