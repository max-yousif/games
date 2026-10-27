import { useEffect, useState } from 'react';
import { speelEigen } from './eigenMuziek';
import { Muziekspeler, STIJL_NAMEN, type StijlNaam } from './muziek';

/**
 * Muziek en geluidseffecten, gemaakt met de Web Audio API (geen geluidsbestanden nodig).
 * De keuzes worden per browser onthouden.
 */

/** Een stijl van de muziekgenerator, "mix" (telkens een andere stijl), of eigen nummers ("eigen" = alle, "eigen:<id>" = één). */
export type MuziekStijl = 'uit' | 'mix' | StijlNaam | 'eigen' | `eigen:${string}`;
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

/** De ingebouwde keuzes (de eigen nummers komen er in het menu bij). */
export const MUZIEK_NAMEN: Partial<Record<MuziekStijl, string>> = {
  uit: 'Geen muziek',
  mix: '🎲 Mix (telkens een andere stijl)',
  ...STIJL_NAMEN,
};

const SLEUTEL = 'games.v3.geluid';
const STANDAARD: GeluidInstellingen = { wacht: 'mix', spel: 'uit', effecten: true, volume: 0.6 };

function lees(): GeluidInstellingen {
  try {
    const nieuw = localStorage.getItem(SLEUTEL);
    if (nieuw) return { ...STANDAARD, ...(JSON.parse(nieuw) as Partial<GeluidInstellingen>) };
    // Oude instellingen overnemen, behalve de wachtmuziek (de nieuwe standaard is de mix).
    const { wacht: _, ...oud } = JSON.parse(localStorage.getItem('games.v2.geluid') ?? localStorage.getItem('games.v1.geluid') ?? '{}') as Partial<GeluidInstellingen>;
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
  if (muziekGain && ctx) muziekGain.gain.setTargetAtTime(instellingen.volume * MUZIEK_NIVEAU, ctx.currentTime, 0.1);
  speler?.zetVolume?.(instellingen.volume * EIGEN_NIVEAU);
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
    // Muziek via een compressor: geen pieken, een vollere klank.
    muziekGain = ctx.createGain();
    muziekGain.gain.value = instellingen.volume * MUZIEK_NIVEAU;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    muziekGain.connect(comp).connect(ctx.destination);
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

/** Volume van de gegenereerde muziek en van eigen nummers t.o.v. de volumeschuif. */
const MUZIEK_NIVEAU = 0.5;
const EIGEN_NIVEAU = 0.6;

let speler: { stijl: MuziekStijl; stop: () => void; zetVolume?: (v: number) => void } | null = null;

function startMuziek(stijl: MuziekStijl) {
  if (speler?.stijl === stijl) return;
  speler?.stop();
  speler = null;
  if (stijl === 'uit') return;
  if (stijl === 'eigen' || stijl.startsWith('eigen:')) {
    const eigen = speelEigen(stijl === 'eigen' ? null : stijl.slice(6), instellingen.volume * EIGEN_NIVEAU);
    speler = { stijl, stop: eigen.stop, zetVolume: eigen.zetVolume };
    return;
  }
  const c = audio();
  if (!c || !muziekGain) return;
  const m = new Muziekspeler(c, muziekGain, stijl as StijlNaam | 'mix');
  // Vooruit plannen; in een verborgen tabblad tikt de klok trager, dus dan verder vooruit.
  const id = window.setInterval(() => {
    if (c.state === 'running') m.plan(c.currentTime + (document.hidden ? 1.6 : 0.35));
  }, 100);
  speler = { stijl, stop: () => window.clearInterval(id) };
}

function stopMuziek() {
  speler?.stop();
  speler = null;
}

/** Muziek even beluisteren (in het geluidsmenu, als er nog geen spelmuziek speelt); null = stoppen. */
export function beluister(stijl: MuziekStijl | null) {
  if (stijl) startMuziek(stijl);
  else stopMuziek();
}

/** Speelt er nu muziek (van een spel of om te beluisteren)? */
export const speeltMuziek = () => speler !== null;

/** Speelt wacht- of spelmuziek zolang de component zichtbaar is (volgens de instellingen). */
export function useMuziek(soort: 'wacht' | 'spel' | null) {
  const [inst] = useGeluid();
  const stijl = soort ? inst[soort] : 'uit';
  useEffect(() => {
    startMuziek(stijl);
    return () => stopMuziek();
  }, [stijl]);
}
