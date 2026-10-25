import { backend } from '../live/config';
import { beeindig } from './session';
import type { Sessie } from './types';

/**
 * Beëindigt een lopend spel. Bij een live spel worden ook de gegevens op de server gewist
 * (de resultaten blijven bewaard in de browser); lukt dat niet, dan gebeurt het na 2 dagen vanzelf.
 */
export async function beeindigSpel(s: Sessie): Promise<Sessie> {
  const klaar = beeindig(s);
  if (!s.live || s.live.afgesloten) return klaar;
  try {
    await backend(s.live.backend).verwijderSessie(s.live.sessieId);
  } catch {
    // Geen verbinding: de server ruimt oude sessies zelf op.
  }
  return { ...klaar, live: { ...s.live, afgesloten: true } };
}
