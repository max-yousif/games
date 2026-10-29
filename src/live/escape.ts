import { randomInt as defaultRandomInt, type RandomInt } from '../lib/random';
import type { Vraag } from '../lib/types';
import { vastGeschud } from '../lib/vraagtypes';
import { automatischJuist, normaliseer, schermNaam } from './logic';
import type { Beoordeling, LiveAntwoord, LiveSpeler, StandRij } from './types';

/** Vraagnummer van de eindcode. */
export const EINDCODE = -1;

/** Geheime code: één cijfer per slot. */
export function maakEscapeCode(aantal: number, rand: RandomInt = defaultRandomInt): string {
  return Array.from({ length: aantal }, () => String(rand(10))).join('');
}

/**
 * Welke vraag een leerling achter slot (of oefening) nr krijgt: per leerling een eigen volgorde,
 * zodat afkijken niet helpt. Enkel binnen een groep met dezelfde categorie (bv. "Reeks 1"), zodat
 * de opbouw van de set blijft. Het cijfer of de hint hoort bij het slot, niet bij de vraag.
 */
export function slotVraag(spelerId: string, nr: number, vragen: readonly { categorie: string }[]): number {
  if (nr < 0 || nr >= vragen.length) return nr;
  let begin = nr;
  while (begin > 0 && vragen[begin - 1].categorie === vragen[nr].categorie) begin--;
  let einde = nr;
  while (einde < vragen.length - 1 && vragen[einde + 1].categorie === vragen[nr].categorie) einde++;
  const groep = Array.from({ length: einde - begin + 1 }, (_, i) => begin + i);
  return vastGeschud(groep, `${spelerId}:slot:${begin}`)[nr - begin];
}

const zonderSpaties = (t: string) => t.replace(/[\s-]/g, '');

/**
 * Kijkt alle nog niet beoordeelde pogingen na. Een juist antwoord op slot i levert het
 * i-de cijfer van de code op; de eindcode (slot -1) moet volledig kloppen.
 */
export function escapeBeoordelingen(vragen: readonly Vraag[], code: string, antwoorden: readonly LiveAntwoord[]): Beoordeling[] {
  return antwoorden
    .filter((a) => a.juist === null)
    .flatMap((a) => {
      if (a.vraagNr === EINDCODE) return [{ id: a.id, juist: zonderSpaties(a.antwoord) === code, punten: 0, beloning: null }];
      const v = vragen[slotVraag(a.spelerId, a.vraagNr, vragen)];
      if (!v) return [];
      const juist = automatischJuist(v, a.antwoord);
      return [{ id: a.id, juist, punten: juist ? v.punten : 0, beloning: juist ? (code[a.vraagNr] ?? null) : null }];
    });
}

export interface EscapeVoortgang {
  speler: LiveSpeler;
  /** Opgeloste sloten. */
  opgelost: Set<number>;
  /** Aantal foute pogingen per slot. */
  fout: Map<number, number>;
  /** Sloten met een poging die nog nagekeken wordt. */
  bezig: Set<number>;
  /** Tijd tot ontsnappen in ms, of null. */
  ontsnaptMs: number | null;
  /** Tijd van het laatst geopende slot (voor de rangschikking bij gelijke stand). */
  laatsteMs: number;
}

export function escapeVoortgang(spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[]): EscapeVoortgang[] {
  return spelers
    .map((speler) => {
      const eigen = antwoorden.filter((a) => a.spelerId === speler.id);
      const opgelost = new Set<number>();
      const fout = new Map<number, number>();
      const bezig = new Set<number>();
      let ontsnaptMs: number | null = null;
      let laatsteMs = 0;
      for (const a of eigen) {
        if (a.juist === null) bezig.add(a.vraagNr);
        else if (a.juist && a.vraagNr === EINDCODE) ontsnaptMs = a.tijdMs;
        else if (a.juist) {
          opgelost.add(a.vraagNr);
          laatsteMs = Math.max(laatsteMs, a.tijdMs);
        } else fout.set(a.vraagNr, (fout.get(a.vraagNr) ?? 0) + 1);
      }
      return { speler, opgelost, fout, bezig, ontsnaptMs, laatsteMs };
    })
    .sort(
      (a, b) =>
        (a.ontsnaptMs ?? Infinity) - (b.ontsnaptMs ?? Infinity) ||
        b.opgelost.size - a.opgelost.size ||
        a.laatsteMs - b.laatsteMs ||
        a.speler.naam.localeCompare(b.speler.naam, 'nl'),
    );
}

/** Stand voor de leerlingen: wie ontsnapt is eerst (snelste eerst), daarna het aantal open sloten. */
export function escapeStand(voortgang: readonly EscapeVoortgang[]): StandRij[] {
  return voortgang.map((v) => ({ id: v.speler.id, naam: schermNaam(v.speler), punten: v.opgelost.size, juist: v.opgelost.size, tijdMs: v.ontsnaptMs }));
}

// ---------- Escape room (versie 2): cijfers kiezen, de code testen ----------
//
// Elk antwoord op een slot geeft meteen een cijfer, ook een fout antwoord (dan een ander cijfer):
// de leerling ziet dus niet of het juist was. Pas wie denkt alle cijfers te hebben, test de code.
// Klopt die niet, dan volgt straftijd: vragen herbekijken mag, antwoorden niet.
// Zoals bij Crypto Hack: elke actie heeft een nieuw nummer vanaf ACTIE_BASIS.

export interface SlotKeuze {
  soort: 'slot';
  slot: number;
  /** Keuzevragen: index in keuzeOpties van de vraag (de leerling ziet ze geschud). */
  keuze?: number;
  /** Andere vragen: het antwoord zoals bij een gewone vraag. */
  antwoord?: string;
}
export interface CodePoging {
  soort: 'code';
  code: string;
}
export type EscapeActie = SlotKeuze | CodePoging;

export function leesEscapeActie(tekst: string): EscapeActie | null {
  try {
    const a = JSON.parse(tekst) as EscapeActie;
    if (a?.soort === 'slot' && Number.isInteger(a.slot) && (Number.isInteger(a.keuze) || typeof a.antwoord === 'string')) return a;
    if (a?.soort === 'code' && typeof a.code === 'string') return a;
    return null;
  } catch {
    return null;
  }
}

/** Beloning bij een slot: het cijfer. Bij een geweigerde actie (straftijd): 'straf'. */
export const STRAF = 'straf';

/** Aantal keuzes van een vraag (meerkeuze: de ingevulde opties, waar/onwaar: 2). */
const aantalKeuzes = (v: Vraag) => (v.type === 'waaronwaar' ? 2 : v.opties.length);
const isKeuze = (v: { type: string }) => v.type === 'meerkeuze' || v.type === 'waaronwaar';

/** Is het antwoord op dit slot juist? (Enkel met de volledige vraag, dus bij de leerkracht.) */
export function slotJuist(v: Vraag, a: SlotKeuze): boolean {
  return isKeuze(v) ? a.keuze === v.juisteOptie : typeof a.antwoord === 'string' && automatischJuist(v, a.antwoord);
}

/**
 * Het cijfer bij een antwoord: het juiste antwoord geeft het cijfer van de code op dat slot, elk
 * fout antwoord een ander (vast) cijfer, per leerling en slot anders. Bij keuzevragen geeft elke
 * foute keuze een ander cijfer; bij open vragen hangt het cijfer af van wat er getypt werd.
 */
export function cijferVoor(code: string, spelerId: string, slot: number, vraag: Vraag, a: SlotKeuze): string {
  const juist = code[slot] ?? '0';
  if (slotJuist(vraag, a)) return juist;
  const anderen = vastGeschud(
    '0123456789'.split('').filter((c) => c !== juist),
    `${code}:${spelerId}:${slot}`,
  );
  if (isKeuze(vraag)) {
    const k = a.keuze ?? 0;
    return anderen[(k < vraag.juisteOptie ? k : k - 1) % anderen.length];
  }
  let h = 0;
  for (const c of normaliseer(a.antwoord ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return anderen[h % anderen.length];
}

export interface EscapeStaat {
  speler: LiveSpeler;
  /** Gegeven antwoord per slot (het laatste telt). */
  keuzes: Map<number, SlotKeuze>;
  /** Cijfer per slot (zoals de leerling het ziet). */
  cijfers: Map<number, string>;
  /** Juiste sloten: enkel voor de leerkracht, nooit op het bord of de server. */
  juist: number;
  /** Foute codes. */
  fout: number;
  ontsnaptMs: number | null;
  /** Tot wanneer (ms sinds de start) de straftijd loopt. */
  strafTot: number;
  /** Er wacht nog een actie op nakijken. */
  bezig: boolean;
  laatsteMs: number;
}

/** Herberekent de toestand van elke leerling uit de nagekeken acties (in volgorde van binnenkomst). */
export function escapeStaat(vragen: readonly { categorie: string; juisteOptie?: number }[], spelers: readonly LiveSpeler[], antwoorden: readonly LiveAntwoord[], wachttijd: number): EscapeStaat[] {
  return spelers
    .map((speler) => {
      const st: EscapeStaat = { speler, keuzes: new Map(), cijfers: new Map(), juist: 0, fout: 0, ontsnaptMs: null, strafTot: 0, bezig: false, laatsteMs: 0 };
      const eigen = antwoorden.filter((a) => a.spelerId === speler.id).sort((a, b) => a.tijdMs - b.tijdMs || a.vraagNr - b.vraagNr);
      for (const a of eigen) {
        if (a.juist === null) {
          st.bezig = true;
          continue;
        }
        const actie = leesEscapeActie(a.antwoord);
        if (!actie) continue;
        if (actie.soort === 'slot' && a.juist) {
          st.keuzes.set(actie.slot, actie);
          if (a.beloning && a.beloning !== STRAF) st.cijfers.set(actie.slot, a.beloning);
          st.laatsteMs = a.tijdMs;
        } else if (actie.soort === 'code' && a.beloning !== STRAF) {
          if (a.juist) st.ontsnaptMs = a.tijdMs;
          else {
            st.fout++;
            st.strafTot = a.tijdMs + wachttijd * 1000;
          }
        }
      }
      st.juist = [...st.keuzes].filter(([slot, keuze]) => {
        const v = vragen[slotVraag(speler.id, slot, vragen)];
        return !!v && 'antwoord' in v && slotJuist(v as Vraag, keuze);
      }).length;
      return st;
    })
    .sort(
      (a, b) =>
        (a.ontsnaptMs ?? Infinity) - (b.ontsnaptMs ?? Infinity) ||
        b.cijfers.size - a.cijfers.size ||
        a.laatsteMs - b.laatsteMs ||
        a.speler.naam.localeCompare(b.speler.naam, 'nl'),
    );
}

/** Kijkt nieuwe acties na, per leerling in volgorde: keuzes geven een cijfer, een code klopt of geeft straftijd. */
export function escapeActieBeoordelingen(vragen: readonly Vraag[], code: string, wachttijd: number, antwoorden: readonly LiveAntwoord[]): Beoordeling[] {
  const uit: Beoordeling[] = [];
  const perSpeler = new Map<string, LiveAntwoord[]>();
  for (const a of antwoorden) perSpeler.set(a.spelerId, [...(perSpeler.get(a.spelerId) ?? []), a]);
  for (const [spelerId, eigen] of perSpeler) {
    let strafTot = 0;
    let ontsnapt = false;
    for (const a of [...eigen].sort((x, y) => x.tijdMs - y.tijdMs || x.vraagNr - y.vraagNr)) {
      const actie = leesEscapeActie(a.antwoord);
      let juist = a.juist;
      let beloning = a.beloning;
      if (juist === null) {
        if (!actie || ontsnapt) [juist, beloning] = [false, null];
        else if (a.tijdMs < strafTot) [juist, beloning] = [false, STRAF];
        else if (actie.soort === 'slot') {
          const v = vragen[slotVraag(spelerId, actie.slot, vragen)];
          const geldig =
            !!v && actie.slot >= 0 && actie.slot < vragen.length && (isKeuze(v) ? (actie.keuze ?? -1) >= 0 && (actie.keuze ?? -1) < aantalKeuzes(v) : typeof actie.antwoord === 'string');
          [juist, beloning] = geldig ? [true, cijferVoor(code, spelerId, actie.slot, v, actie)] : [false, null];
        } else [juist, beloning] = [zonderSpaties(actie.code) === code, null];
        uit.push({ id: a.id, juist, punten: 0, beloning });
      }
      if (actie?.soort === 'code' && beloning !== STRAF) {
        if (juist) ontsnapt = true;
        else strafTot = a.tijdMs + wachttijd * 1000;
      }
    }
  }
  return uit;
}

/**
 * Stand voor de server (de leerlingen zien die): ontsnapt (snelste eerst) en hoeveel sloten
 * ingevuld zijn. Nooit hoeveel er juist zijn, anders verraadt de stand het antwoord.
 */
export function escapeStaatStand(staat: readonly EscapeStaat[]): StandRij[] {
  return staat.map((s) => ({ id: s.speler.id, naam: schermNaam(s.speler), punten: s.cijfers.size, juist: s.cijfers.size, tijdMs: s.ontsnaptMs }));
}

/** De gekozen antwoorden als antwoorden per vraag (voor de resultaten): juist of fout per slot. */
export function escapeAlsAntwoorden(vragen: readonly Vraag[], staat: readonly EscapeStaat[]): LiveAntwoord[] {
  return staat.flatMap((s) =>
    [...s.keuzes].map(([slot, keuze]) => {
      const nr = slotVraag(s.speler.id, slot, vragen);
      const juist = !!vragen[nr] && slotJuist(vragen[nr], keuze);
      return { id: `${s.speler.id}:${slot}`, spelerId: s.speler.id, vraagNr: nr, antwoord: keuze.antwoord ?? String(keuze.keuze), tijdMs: s.laatsteMs, juist, punten: juist ? (vragen[nr]?.punten ?? 0) : 0, poging: 1, beloning: null };
    }),
  );
}
