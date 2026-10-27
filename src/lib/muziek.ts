/**
 * Muziekgenerator: elke stijl schrijft al spelend een nieuw nummer, met een intro, couplet,
 * refrein, break met opbouw en solo. Akkoorden, melodieën (motieven die variëren), basloopjes en
 * drumfills worden telkens opnieuw gekozen; na elke ronde verandert de toonsoort (en bij "Mix"
 * de stijl). Alles wordt gemaakt met de Web Audio API: geen geluidsbestanden nodig.
 */

export type StijlNaam = 'dance' | 'beat' | 'arcade' | 'funk' | 'latin' | 'dnb' | 'synthwave' | 'rock' | 'disco' | 'rustig' | 'vrolijk' | 'spannend';

export const STIJL_NAMEN: Record<StijlNaam, string> = {
  dance: 'Dance',
  beat: 'Hiphop-beat',
  arcade: 'Arcade (8-bit)',
  funk: 'Funk',
  latin: 'Latin / reggaeton',
  dnb: 'Drum & bass',
  synthwave: 'Synthwave (jaren 80)',
  rock: 'Rock',
  disco: 'Disco',
  rustig: 'Rustig (lo-fi)',
  vrolijk: 'Vrolijk (pop)',
  spannend: 'Spannend',
};

export type Rand = () => number;

const SCHALEN = {
  majeur: [0, 2, 4, 5, 7, 9, 11],
  mineur: [0, 2, 3, 5, 7, 8, 10],
  dorisch: [0, 2, 3, 5, 7, 9, 10],
  mixolydisch: [0, 2, 4, 5, 7, 9, 10],
  harmonisch: [0, 2, 3, 5, 7, 8, 11],
} as const;

type AkkoordSpel = 'pad' | 'stoot' | 'arp' | 'piano' | 'power' | 'pluk';

interface Stijl {
  bpm: [number, number];
  schalen: (keyof typeof SCHALEN)[];
  /** Akkoordenschema's in trappen van de toonladder (0 = I), één akkoord per maat. */
  progressies: number[][];
  /** Ritmes per maat van 16 zestienden: x = slag, o = zachte slag, . = rust. */
  kick: string[];
  snare: string[];
  hihat: string[];
  open?: string[];
  klap?: string[];
  /** Basritmes: r = grondtoon, o = octaaf, 5 = kwint, 3 = terts, . = rust. */
  bas: string[];
  basGolf: OscillatorType;
  basFilter: number;
  akkoord: AkkoordSpel;
  akkoordRitme?: string[];
  akkoordGolf: OscillatorType;
  septiemen?: boolean;
  lead: OscillatorType;
  leadOctaaf: number;
  /** Hoeveel noten de melodie heeft (0-1). */
  dichtheid: number;
  swing?: number;
  vervorming?: boolean;
  /** Toonhoogte van de grondtoon (midi), er wordt telkens wat rond gevarieerd. */
  grond: number;
  volume?: number;
}

const STIJLEN: Record<StijlNaam, Stijl> = {
  dance: {
    bpm: [122, 126],
    schalen: ['mineur', 'dorisch'],
    progressies: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 6, 0, 0], [0, 6, 5, 6]],
    kick: ['x...x...x...x...', 'x...x...x...x..o'],
    snare: ['................'],
    klap: ['....x.......x...', '....x.......x..o'],
    hihat: ['x.x.x.x.x.x.x.x.', 'xoxoxoxoxoxoxoxx'],
    open: ['..x...x...x...x.'],
    bas: ['..r...r...r...r.', '..r.o.r...r.o.r.', 'r.or..r.o.r..r.o'],
    basGolf: 'sawtooth',
    basFilter: 600,
    akkoord: 'stoot',
    akkoordRitme: ['..x..x....x..x..', 'x..x..x...x.x...', '...x..x...x...x.'],
    akkoordGolf: 'sawtooth',
    lead: 'square',
    leadOctaaf: 5,
    dichtheid: 0.55,
    grond: 45,
  },
  beat: {
    bpm: [86, 94],
    schalen: ['dorisch', 'mineur'],
    progressies: [[0, 3, 0, 3], [0, 5, 3, 4], [1, 4, 0, 0], [0, 2, 3, 4]],
    kick: ['x......xx.x.....', 'x.....x..xx.....', 'x......x..x..x..'],
    snare: ['....x.......x...', '....x..o....x...'],
    hihat: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.'],
    bas: ['r......r.r.o....', 'r.....r..r......', 'r......5..r..o..'],
    basGolf: 'triangle',
    basFilter: 900,
    akkoord: 'piano',
    akkoordGolf: 'sine',
    septiemen: true,
    lead: 'triangle',
    leadOctaaf: 5,
    dichtheid: 0.35,
    swing: 0.2,
    grond: 41,
  },
  arcade: {
    bpm: [146, 158],
    schalen: ['majeur', 'mineur'],
    progressies: [[0, 5, 3, 4], [0, 4, 5, 3], [3, 4, 0, 0], [0, 3, 4, 4]],
    kick: ['x...x...x...x...', 'x.....x.x...x...'],
    snare: ['....x.......x...', '....x.......x.x.'],
    hihat: ['x.x.x.x.x.x.x.x.'],
    bas: ['r.o.r.o.r.o.r.o.', 'r.r.o.r.r.r.o.5.'],
    basGolf: 'triangle',
    basFilter: 3000,
    akkoord: 'arp',
    akkoordGolf: 'square',
    lead: 'square',
    leadOctaaf: 5,
    dichtheid: 0.7,
    grond: 48,
    volume: 0.8,
  },
  funk: {
    bpm: [102, 112],
    schalen: ['dorisch', 'mixolydisch'],
    progressies: [[0, 0, 3, 3], [0, 3, 0, 4], [0, 6, 3, 4]],
    kick: ['x..x..x...x..x..', 'x.x...x..x....x.'],
    snare: ['....x..o.o..x..o', '....x.......x.o.'],
    hihat: ['xxxxxxxxxxxxxxxx', 'xoxxxoxxxoxxxoxx'],
    bas: ['r..o.r.5r..r.o.5', 'r.r..o.r..5.r.o.', 'r...o.rr..r.3.5.'],
    basGolf: 'sawtooth',
    basFilter: 1100,
    akkoord: 'stoot',
    akkoordRitme: ['.x..x.x..x..x.x.', 'x..x.x...x.x..x.'],
    akkoordGolf: 'square',
    septiemen: true,
    lead: 'square',
    leadOctaaf: 5,
    dichtheid: 0.5,
    swing: 0.08,
    grond: 40,
  },
  latin: {
    bpm: [90, 98],
    schalen: ['mineur', 'harmonisch'],
    progressies: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 3, 4, 0]],
    kick: ['x...x...x...x...'],
    snare: ['...x..x....x..x.', '...x..x....x..xx'],
    hihat: ['x.x.x.x.x.x.x.x.', '..x...x...x...x.'],
    bas: ['r..r..r.r..r..r.', 'r..o..r.r..5..r.'],
    basGolf: 'sine',
    basFilter: 800,
    akkoord: 'pluk',
    akkoordRitme: ['x..x..x...x..x..', '.x.x.x..x..x.x..'],
    akkoordGolf: 'triangle',
    lead: 'triangle',
    leadOctaaf: 5,
    dichtheid: 0.55,
    grond: 43,
  },
  dnb: {
    bpm: [170, 176],
    schalen: ['mineur', 'dorisch'],
    progressies: [[0, 5, 6, 4], [0, 3, 5, 6], [0, 0, 5, 6]],
    kick: ['x.........x.....', 'x.........x..x..', 'x.x.......x.....'],
    snare: ['....x.......x...', '....x..o....x.o.'],
    hihat: ['x.xxx.x.x.xxx.x.', 'x.x.x.x.x.x.x.xx'],
    bas: ['r.......r.....r.', 'r.......r..o....', 'r.....r.....r...'],
    basGolf: 'sawtooth',
    basFilter: 400,
    akkoord: 'pad',
    akkoordGolf: 'sawtooth',
    lead: 'sawtooth',
    leadOctaaf: 5,
    dichtheid: 0.3,
    grond: 38,
  },
  synthwave: {
    bpm: [96, 106],
    schalen: ['mineur'],
    progressies: [[0, 5, 2, 6], [0, 6, 5, 6], [5, 3, 0, 4], [0, 3, 5, 4]],
    kick: ['x...x...x...x...'],
    snare: ['....x.......x...'],
    hihat: ['x.x.x.x.x.x.x.x.', 'xxx.xxx.xxx.xxx.'],
    bas: ['r.r.r.r.r.r.r.r.', 'r.ror.r.r.ror.r.', 'rrrrrrrrrrrrrrrr'],
    basGolf: 'sawtooth',
    basFilter: 700,
    akkoord: 'pad',
    akkoordGolf: 'sawtooth',
    lead: 'sawtooth',
    leadOctaaf: 5,
    dichtheid: 0.45,
    grond: 45,
  },
  rock: {
    bpm: [126, 138],
    schalen: ['mineur', 'mixolydisch'],
    progressies: [[0, 5, 6, 0], [0, 3, 4, 3], [0, 6, 5, 6], [0, 3, 0, 4]],
    kick: ['x.x...x.x.x.....', 'x.....x.x.x...x.'],
    snare: ['....x.......x...', '....x.......x.xx'],
    hihat: ['x.x.x.x.x.x.x.x.'],
    bas: ['r.r.r.r.r.r.r.r.', 'r.r.r.r.r.r.5.o.'],
    basGolf: 'sawtooth',
    basFilter: 900,
    akkoord: 'power',
    akkoordRitme: ['x.x.x.x.x.x.x.x.', 'x..x..x.x.x.x...', 'x...x...x.x.x.x.'],
    akkoordGolf: 'sawtooth',
    lead: 'sawtooth',
    leadOctaaf: 5,
    dichtheid: 0.5,
    vervorming: true,
    grond: 40,
    volume: 0.85,
  },
  disco: {
    bpm: [114, 120],
    schalen: ['dorisch', 'majeur'],
    progressies: [[0, 3, 1, 4], [1, 4, 0, 5], [0, 5, 1, 4]],
    kick: ['x...x...x...x...'],
    snare: ['....x.......x...'],
    hihat: ['xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.'],
    open: ['..x...x...x...x.'],
    bas: ['r.o.r.o.r.o.r.o.', 'ror.ror.ror.ror.'],
    basGolf: 'sawtooth',
    basFilter: 1200,
    akkoord: 'stoot',
    akkoordRitme: ['x.....x...x.....', '..x...x...x...x.'],
    akkoordGolf: 'sawtooth',
    septiemen: true,
    lead: 'sawtooth',
    leadOctaaf: 5,
    dichtheid: 0.5,
    grond: 41,
  },
  rustig: {
    bpm: [74, 82],
    schalen: ['majeur', 'dorisch'],
    progressies: [[0, 5, 3, 4], [3, 2, 1, 4], [0, 3, 0, 4], [5, 3, 0, 4]],
    kick: ['x......x..x.....', 'x.........x.....'],
    snare: ['....o.......o...'],
    hihat: ['o.o.o.o.o.o.o.o.'],
    bas: ['r.......r.....5.', 'r.........r.....'],
    basGolf: 'sine',
    basFilter: 600,
    akkoord: 'piano',
    akkoordGolf: 'sine',
    septiemen: true,
    lead: 'sine',
    leadOctaaf: 5,
    dichtheid: 0.25,
    swing: 0.2,
    grond: 43,
  },
  vrolijk: {
    bpm: [112, 122],
    schalen: ['majeur'],
    progressies: [[0, 4, 5, 3], [3, 4, 0, 0], [0, 5, 3, 4], [0, 3, 4, 3]],
    kick: ['x...x...x...x...', 'x...x...x.x.x...'],
    snare: ['................'],
    klap: ['....x.......x...'],
    hihat: ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.x.'],
    bas: ['r..r..r.r..r..r.', 'r.r.o.r.r.r.5.r.'],
    basGolf: 'triangle',
    basFilter: 1500,
    akkoord: 'pluk',
    akkoordRitme: ['x.x..x.x..x.x..x', 'x..x..x.x..x..x.'],
    akkoordGolf: 'triangle',
    lead: 'square',
    leadOctaaf: 5,
    dichtheid: 0.6,
    grond: 48,
  },
  spannend: {
    bpm: [100, 110],
    schalen: ['harmonisch', 'mineur'],
    progressies: [[0, 0, 5, 4], [0, 3, 0, 4], [0, 5, 3, 4]],
    kick: ['x..x..x...x..x..', 'x...x...x...x...'],
    snare: ['....x.......x...'],
    hihat: ['xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.'],
    bas: ['r.r.r.r.r.r.r.r.', 'rrrrrrrrrrrrrrrr'],
    basGolf: 'sawtooth',
    basFilter: 500,
    akkoord: 'pad',
    akkoordGolf: 'sawtooth',
    lead: 'sawtooth',
    leadOctaaf: 5,
    dichtheid: 0.35,
    grond: 45,
  },
};

const kies = <T,>(rand: Rand, l: readonly T[]): T => l[Math.floor(rand() * l.length)];

// ---------- Opbouw van een nummer (zuiver, testbaar) ----------

export type DeelSoort = 'intro' | 'couplet' | 'refrein' | 'pauze' | 'opbouw' | 'solo';

export interface Deel {
  soort: DeelSoort;
  maten: number;
}

/** De delen van één ronde: altijd een intro, daarna couplet, refrein, break en solo in wisselende volgorde. */
export function maakArrangement(rand: Rand): Deel[] {
  const delen: Deel[] = [{ soort: 'intro', maten: 4 }];
  const blokken: Deel[][] = [
    [
      { soort: 'couplet', maten: 8 },
      { soort: 'refrein', maten: 8 },
    ],
    [
      { soort: 'pauze', maten: 4 },
      { soort: 'opbouw', maten: 2 },
      { soort: 'refrein', maten: 8 },
    ],
    [
      { soort: 'solo', maten: 8 },
      { soort: 'refrein', maten: 8 },
    ],
  ];
  delen.push(...blokken[0]);
  // De andere blokken in willekeurige volgorde, soms een extra couplet.
  const rest = rand() < 0.5 ? [blokken[1], blokken[2]] : [blokken[2], blokken[1]];
  for (const b of rest) {
    if (rand() < 0.35) delen.push({ soort: 'couplet', maten: 8 });
    delen.push(...b);
  }
  return delen;
}

/** Een noot van een motief: start (zestiende), duur (zestienden) en trap t.o.v. de grondtoon van het akkoord. */
export interface MotiefNoot {
  start: number;
  duur: number;
  trap: number;
}

/**
 * Een melodie van 2 maten (32 zestienden): eerst een vraag, dan een antwoord dat de vraag
 * herhaalt met een ander einde. Op sterke tellen valt de melodie op een akkoordtoon.
 */
export function maakMotief(rand: Rand, dichtheid: number): MotiefNoot[] {
  const vraag: number[] = [];
  for (let s = 0; s < 16; s++) {
    const kans = s % 4 === 0 ? dichtheid + 0.25 : s % 2 === 0 ? dichtheid : dichtheid * 0.35;
    if (s === 0 || rand() < kans) vraag.push(s);
  }
  const noten: MotiefNoot[] = [];
  let trap = kies(rand, [0, 2, 4]);
  const voegToe = (starts: number[], offset: number, vrijVanaf: number) => {
    starts.forEach((s, i) => {
      const volgende = i + 1 < starts.length ? starts[i + 1] : 16;
      if (i >= vrijVanaf || offset === 0) {
        trap += kies(rand, [-2, -1, -1, 0, 1, 1, 2, 3, -3]);
        trap = Math.max(-3, Math.min(9, trap));
        // Sterke tel: naar de dichtste akkoordtoon (0, 2, 4 of een octaaf hoger).
        if (s % 4 === 0) trap = [0, 2, 4, 7, 9].reduce((best, t) => (Math.abs(t - trap) < Math.abs(best - trap) ? t : best), 0);
      } else trap = noten[i].trap;
      noten.push({ start: offset + s, duur: Math.max(1, Math.min(4, volgende - s)), trap });
    });
  };
  voegToe(vraag, 0, 0);
  // Antwoord: zelfde ritme, de laatste noten anders, eindigt op de grondtoon.
  voegToe(vraag, 16, Math.max(1, vraag.length - 3));
  noten[noten.length - 1].trap = kies(rand, [0, 7]);
  return noten;
}

/** Een kleine variatie op een motief: een paar noten een trap hoger of lager. */
export function varieer(rand: Rand, motief: MotiefNoot[]): MotiefNoot[] {
  return motief.map((n) => (rand() < 0.2 ? { ...n, trap: n.trap + kies(rand, [-1, 1, 2]) } : n));
}

// ---------- Klanken ----------

interface Klank {
  freq: number;
  start: number;
  duur: number;
  golf: OscillatorType;
  gain: number;
  filter?: number;
  /** Filter dat opengaat en weer sluit (bas, akkoordstoten). */
  filterEnv?: number;
  attack?: number;
  release?: number;
  detune?: number;
  vibrato?: boolean;
  naar?: number;
}

export class Muziekspeler {
  private ctx: BaseAudioContext;
  private uit: AudioNode;
  private stijlKeuze: StijlNaam | 'mix';
  private rand: Rand;
  private stijl!: Stijl;
  private bpm = 120;
  private grond = 45;
  private schaal: readonly number[] = SCHALEN.mineur;
  private delen: Deel[] = [];
  private deel = 0;
  private maatInDeel = 0;
  private stap = 0;
  private volgende: number;
  private progressies: Record<string, number[]> = {};
  private motieven: Record<string, MotiefNoot[]> = {};
  private patronen: Record<string, string> = {};
  private vervorming: WaveShaperNode | null = null;
  private ruisBuffer: AudioBuffer;
  /** Welke stijl nu speelt (handig bij "Mix"). */
  huidigeStijl: StijlNaam = 'dance';

  constructor(ctx: BaseAudioContext, doel: AudioNode, stijl: StijlNaam | 'mix', rand: Rand = Math.random) {
    this.ctx = ctx;
    this.uit = doel;
    this.stijlKeuze = stijl;
    this.rand = rand;
    this.volgende = ctx.currentTime + 0.1;
    const lengte = ctx.sampleRate;
    this.ruisBuffer = ctx.createBuffer(1, lengte, ctx.sampleRate);
    const data = this.ruisBuffer.getChannelData(0);
    for (let i = 0; i < lengte; i++) data[i] = Math.random() * 2 - 1;
    this.nieuweRonde(true);
  }

  /** Nieuwe ronde: nieuwe opbouw, akkoorden, melodieën en (meestal) een andere toonsoort. */
  private nieuweRonde(eerste = false) {
    const r = this.rand;
    if (this.stijlKeuze === 'mix') {
      const andere = (Object.keys(STIJLEN) as StijlNaam[]).filter((s) => s !== this.huidigeStijl || eerste);
      this.huidigeStijl = kies(r, andere);
    } else this.huidigeStijl = this.stijlKeuze;
    this.stijl = STIJLEN[this.huidigeStijl];
    const [lo, hi] = this.stijl.bpm;
    this.bpm = Math.round(lo + r() * (hi - lo));
    this.grond = this.stijl.grond + kies(r, [-2, -1, 0, 0, 1, 2, 3]);
    this.schaal = SCHALEN[kies(r, this.stijl.schalen)];
    this.delen = maakArrangement(r);
    this.deel = 0;
    this.maatInDeel = 0;
    this.stap = 0;
    const progs = this.stijl.progressies;
    const a = kies(r, progs);
    const b = kies(r, progs.length > 1 ? progs.filter((p) => p !== a) : progs);
    this.progressies = { intro: a, couplet: a, pauze: b, opbouw: [b[0], b[0]], refrein: b, solo: kies(r, progs) };
    this.motieven = {
      couplet: maakMotief(r, this.stijl.dichtheid * 0.8),
      refrein: maakMotief(r, Math.min(0.9, this.stijl.dichtheid + 0.15)),
      solo: maakMotief(r, Math.min(0.95, this.stijl.dichtheid + 0.3)),
    };
    this.motieven.pauze = varieer(r, this.motieven.refrein);
    this.kiesPatronen();
    if (this.stijl.vervorming && !this.vervorming) {
      this.vervorming = this.ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 4);
      }
      this.vervorming.curve = curve;
      this.vervorming.connect(this.uit);
    }
  }

  private kiesPatronen() {
    const r = this.rand;
    const s = this.stijl;
    this.patronen = {
      kick: kies(r, s.kick),
      snare: kies(r, s.snare),
      hihat: kies(r, s.hihat),
      open: s.open ? kies(r, s.open) : '',
      klap: s.klap ? kies(r, s.klap) : '',
      bas: kies(r, s.bas),
      akkoord: s.akkoordRitme ? kies(r, s.akkoordRitme) : '',
    };
  }

  private get stapDuur() {
    return 60 / this.bpm / 4;
  }

  /** Zet alle noten klaar tot tijdstip `tot` (seconden in de AudioContext). */
  plan(tot: number) {
    // Was de klok even stil (tabblad in slaap, geluid nog niet toegelaten)? Niet alles inhalen.
    if (this.volgende < this.ctx.currentTime - 0.05) this.volgende = this.ctx.currentTime + 0.05;
    while (this.volgende < tot) {
      this.speelStap(this.volgende);
      this.volgende += this.stapDuur;
      this.stap++;
      if (this.stap === 16) {
        this.stap = 0;
        this.maatInDeel++;
        if (this.maatInDeel >= this.delen[this.deel].maten) {
          this.maatInDeel = 0;
          this.deel++;
          if (this.deel >= this.delen.length) this.nieuweRonde();
          // Elk nieuw deel: soms andere drum- en basritmes.
          else if (this.rand() < 0.6) this.kiesPatronen();
        }
      }
    }
  }

  private speelStap(t0: number) {
    const s = this.stijl;
    const d = this.delen[this.deel];
    const maat = this.maatInDeel;
    const st = this.stap;
    const swing = st % 2 === 1 ? (s.swing ?? 0) * this.stapDuur * 2 : 0;
    const t = t0 + swing;
    const vol = s.volume ?? 1;
    const laatsteMaat = maat === d.maten - 1;
    const fill = laatsteMaat && st >= 12 && d.soort !== 'pauze' && d.soort !== 'intro';
    const prog = this.progressies[d.soort] ?? this.progressies.couplet;
    const akkTrap = prog[maat % prog.length];

    // Drums
    const drums = d.soort === 'couplet' || d.soort === 'refrein' || d.soort === 'solo' || (d.soort === 'intro' && maat >= 2);
    const p = this.patronen;
    if (d.soort === 'refrein' && maat === 0 && st === 0) this.crash(t, 0.25 * vol);
    if (fill) {
      // Fill: snare/toms op de laatste tel.
      if (this.rand() < 0.85) this.tom(t, 1 - (st - 12) * 0.15, 0.35 * vol);
      if (st === 12) this.kick(t, 0.8 * vol);
    } else if (drums) {
      const hit = (pat: string) => pat[st];
      if (hit(p.kick) === 'x') this.kick(t, 0.95 * vol);
      else if (hit(p.kick) === 'o') this.kick(t, 0.5 * vol);
      if (hit(p.snare) === 'x') this.snare(t, 0.4 * vol);
      else if (hit(p.snare) === 'o') this.snare(t, 0.13 * vol);
      if (p.klap && hit(p.klap) === 'x') this.klap(t, 0.32 * vol);
      if (d.soort !== 'intro' || maat >= 1) {
        if (hit(p.hihat) === 'x') this.hihat(t, 0.08 * vol, false);
        else if (hit(p.hihat) === 'o') this.hihat(t, 0.035 * vol, false);
      }
      if (p.open && hit(p.open) === 'x' && d.soort !== 'couplet') this.hihat(t, 0.08 * vol, true);
    } else if (d.soort === 'intro' && st % 4 === 2) this.hihat(t, 0.05 * vol, false);

    // Opbouw: snare die steeds sneller gaat en een stijgende ruis.
    if (d.soort === 'opbouw') {
      const interval = maat === 0 ? 4 : st < 8 ? 2 : 1;
      if (st % interval === 0) this.snare(t, (0.15 + (maat * 16 + st) / 32 * 0.3) * vol);
      if (maat === 0 && st === 0) this.riser(t, this.stapDuur * 32, 0.12 * vol);
    }

    // Bas
    const basAan = d.soort !== 'pauze' && d.soort !== 'opbouw' && !(d.soort === 'intro' && maat < 2);
    const b = p.bas[st];
    if (basAan && b !== '.') {
      const toon = this.toon(akkTrap + (b === '5' ? 4 : b === '3' ? 2 : 0)) - 24 + (b === 'o' ? 12 : 0);
      let duur = 1;
      while (st + duur < 16 && p.bas[st + duur] === '.' && duur < 4) duur++;
      this.noot({ freq: hz(toon), start: t, duur: duur * this.stapDuur * 0.9, golf: s.basGolf, gain: 0.32 * vol, filter: s.basFilter, filterEnv: s.basFilter * 2.5, release: 0.05 });
    }

    // Akkoorden
    const akk = this.akkoordTonen(akkTrap);
    const akkoordAan = d.soort !== 'opbouw' || maat === 0;
    if (akkoordAan) this.speelAkkoord(akk, t, st, d.soort, vol);

    // Melodie
    const motief = this.motieven[d.soort];
    const melodieAan = motief && (d.soort !== 'couplet' || maat >= 4);
    if (melodieAan) {
      const pos = (maat % 2) * 16 + st;
      for (const n of motief) {
        if (n.start !== pos) continue;
        const octaaf = d.soort === 'solo' ? 1 : 0;
        const toon = this.toon(akkTrap + n.trap) + 12 * (s.leadOctaaf - 4 + octaaf) - 12;
        const gain = (d.soort === 'pauze' ? 0.09 : 0.13) * vol * (s.lead === 'sine' || s.lead === 'triangle' ? 1.6 : 1);
        this.noot(
          { freq: hz(toon), start: t, duur: n.duur * this.stapDuur * 0.92, golf: s.lead, gain, filter: 4000, attack: 0.01, release: 0.08, detune: s.lead === 'sawtooth' ? 8 : 0, vibrato: n.duur >= 3 },
          s.vervorming ? 'vervormd' : undefined,
        );
      }
    }
  }

  /** Midi-toon van een trap van de toonladder (trappen boven 6 = hogere octaven). */
  private toon(trap: number) {
    const o = Math.floor(trap / 7);
    const i = ((trap % 7) + 7) % 7;
    return this.grond + 12 + o * 12 + this.schaal[i];
  }

  private akkoordTonen(trap: number) {
    const tonen = [trap, trap + 2, trap + 4].map((x) => this.toon(x));
    if (this.stijl.septiemen) tonen.push(this.toon(trap + 6));
    return tonen;
  }

  private speelAkkoord(tonen: number[], t: number, st: number, soort: DeelSoort, vol: number) {
    const s = this.stijl;
    const dk = this.stapDuur;
    const zacht = soort === 'intro' ? 0.7 : 1;
    // In de break: aangehouden akkoorden (een zachte "pad"), met een lichte hi-hat.
    if (soort === 'pauze') {
      if (st === 0) for (const m of tonen) this.noot({ freq: hz(m), start: t, duur: dk * 16, golf: 'triangle', gain: 0.07 * vol, attack: 0.3, release: 0.4, detune: 6 });
      if (st % 4 === 2) this.hihat(t, 0.04 * vol, false);
      return;
    }
    switch (s.akkoord) {
      case 'pad':
        if (st === 0) for (const m of tonen) this.noot({ freq: hz(m), start: t, duur: dk * 16, golf: s.akkoordGolf, gain: 0.035 * vol * zacht, filter: 1400, attack: 0.4, release: 0.5, detune: 7 });
        break;
      case 'piano':
        if (st === 0 || (st === 10 && this.rand() < 0.5))
          for (const [i, m] of tonen.entries()) this.noot({ freq: hz(m), start: t + i * 0.012, duur: dk * (st === 0 ? 10 : 6), golf: 'sine', gain: 0.07 * vol * zacht, release: 0.4 });
        break;
      case 'arp': {
        const reeks = [...tonen, tonen[1] + 12, tonen[0] + 12, tonen[2]];
        this.noot({ freq: hz(reeks[st % reeks.length] + 12), start: t, duur: dk * 0.8, golf: s.akkoordGolf, gain: 0.035 * vol * zacht, filter: 3500 });
        break;
      }
      case 'power':
        if (s.akkoordRitme && this.patronen.akkoord[st] === 'x' && soort !== 'intro')
          for (const m of [tonen[0] - 12, tonen[0] - 5, tonen[0]]) this.noot({ freq: hz(m), start: t, duur: dk * 1.6, golf: 'sawtooth', gain: 0.05 * vol, filter: 2500 }, 'vervormd');
        else if (st === 0 && soort === 'intro') for (const m of [tonen[0] - 12, tonen[0] - 5]) this.noot({ freq: hz(m), start: t, duur: dk * 14, golf: 'sawtooth', gain: 0.04 * vol, filter: 1800 }, 'vervormd');
        break;
      case 'stoot':
      case 'pluk':
        if (this.patronen.akkoord[st] === 'x')
          for (const m of tonen)
            this.noot({
              freq: hz(m + (s.akkoord === 'pluk' ? 12 : 0)),
              start: t,
              duur: dk * (s.akkoord === 'pluk' ? 1.5 : 1.2),
              golf: s.akkoordGolf,
              gain: (s.akkoord === 'pluk' ? 0.06 : 0.03) * vol * zacht,
              filter: 2600,
              filterEnv: 4500,
            });
        break;
    }
  }

  // ----- Klankopwekking -----

  private noot(k: Klank, route?: 'vervormd') {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = k.golf;
    osc.frequency.setValueAtTime(k.freq, k.start);
    if (k.naar) osc.frequency.exponentialRampToValueAtTime(k.naar, k.start + k.duur);
    if (k.detune) osc.detune.setValueAtTime(k.detune * (this.rand() < 0.5 ? -1 : 1), k.start);
    let bron: AudioNode = osc;
    if (k.vibrato) {
      const lfo = c.createOscillator();
      const diepte = c.createGain();
      lfo.frequency.value = 5.5;
      diepte.gain.value = k.freq * 0.006;
      lfo.connect(diepte).connect(osc.frequency);
      lfo.start(k.start + 0.15);
      lfo.stop(k.start + k.duur + 0.2);
    }
    if (k.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = k.filterEnv ? 4 : 0.7;
      if (k.filterEnv) {
        f.frequency.setValueAtTime(k.filterEnv, k.start);
        f.frequency.exponentialRampToValueAtTime(Math.max(80, k.filter), k.start + Math.min(0.25, k.duur));
      } else f.frequency.value = k.filter;
      bron.connect(f);
      bron = f;
    }
    const g = c.createGain();
    const attack = k.attack ?? 0.008;
    const release = k.release ?? 0.06;
    g.gain.setValueAtTime(0.0001, k.start);
    g.gain.exponentialRampToValueAtTime(k.gain, k.start + attack);
    g.gain.setValueAtTime(k.gain, k.start + Math.max(attack, k.duur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, k.start + k.duur + release);
    bron.connect(g).connect(route === 'vervormd' && this.vervorming ? this.vervorming : this.uit);
    osc.start(k.start);
    osc.stop(k.start + k.duur + release + 0.05);
  }

  private ruis(t: number, duur: number, gain: number, type: BiquadFilterType, freq: number, naar?: number) {
    const c = this.ctx;
    const bron = c.createBufferSource();
    bron.buffer = this.ruisBuffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (naar) f.frequency.exponentialRampToValueAtTime(naar, t + duur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    bron.connect(f).connect(g).connect(this.uit);
    bron.start(t, this.rand() * 0.5);
    bron.stop(t + duur + 0.05);
  }

  private kick(t: number, gain: number) {
    this.noot({ freq: 150, naar: 42, start: t, duur: 0.26, golf: 'sine', gain, release: 0.04 });
  }
  private snare(t: number, gain: number) {
    this.ruis(t, 0.16, gain, 'bandpass', 1900);
    this.noot({ freq: 210, naar: 160, start: t, duur: 0.07, golf: 'triangle', gain: gain * 0.6 });
  }
  private hihat(t: number, gain: number, open: boolean) {
    this.ruis(t, open ? 0.18 : 0.035, gain, 'highpass', 8000);
  }
  private klap(t: number, gain: number) {
    for (const d of [0, 0.011, 0.023]) this.ruis(t + d, 0.04, gain * 0.6, 'bandpass', 1300);
    this.ruis(t + 0.035, 0.14, gain, 'bandpass', 1200);
  }
  private tom(t: number, hoogte: number, gain: number) {
    this.noot({ freq: 120 + 90 * hoogte, naar: 70 + 50 * hoogte, start: t, duur: 0.18, golf: 'sine', gain });
    this.ruis(t, 0.05, gain * 0.3, 'bandpass', 2000);
  }
  private crash(t: number, gain: number) {
    this.ruis(t, 1.6, gain, 'highpass', 5000);
  }
  private riser(t: number, duur: number, gain: number) {
    const c = this.ctx;
    const bron = c.createBufferSource();
    bron.buffer = this.ruisBuffer;
    bron.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(6000, t + duur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + duur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duur + 0.05);
    bron.connect(f).connect(g).connect(this.uit);
    bron.start(t);
    bron.stop(t + duur + 0.1);
  }
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
