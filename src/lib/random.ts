/**
 * Eerlijke willekeur op basis van de Web Crypto API (niet Math.random).
 */

export type RandomInt = (maxExclusive: number) => number;

/** Willekeurig geheel getal in [0, maxExclusive), zonder "modulo bias". */
export const randomInt: RandomInt = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new RangeError(`Ongeldige bovengrens: ${maxExclusive}`);
  }
  const range = 2 ** 32;
  // Grootste veelvoud van maxExclusive dat in 32 bits past; waarden daarboven weggooien.
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
};

/** Fisher-Yates: geeft een nieuwe, eerlijk geschudde kopie terug. */
export function shuffle<T>(items: readonly T[], rand: RandomInt = randomInt): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
