/**
 * Testversie van een voorstel (de branch agent/voorstel, op /games/voorstel/). Die draait in
 * dezelfde browser als de echte site, dus mag ze niets van de echte gegevens beschadigen: ze werkt
 * met een eigen kopie van de browseropslag en stuurt niets naar de cloud (ophalen mag wel).
 */
export const VOORSTEL = import.meta.env.VITE_VOORSTEL === '1';

const EIGEN = 'voorstel.';
const GEKOPIEERD = 'voorstel.gekopieerd';
const vanSite = (k: string) => k.startsWith('games.');

/** Alle sleutels van de site ("games.…") krijgen in de testversie een eigen voorvoegsel. */
function scheidOpslag() {
  if (!VOORSTEL) return;
  const p = Storage.prototype;
  const lees = p.getItem;
  const zet = p.setItem;
  const wis = p.removeItem;
  try {
    // Eén keer de echte gegevens overnemen, zodat de testversie meteen je sets en klassen toont.
    if (lees.call(localStorage, GEKOPIEERD) === null) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (vanSite(k)) zet.call(localStorage, EIGEN + k, lees.call(localStorage, k)!);
      }
      zet.call(localStorage, GEKOPIEERD, '1');
    }
  } catch {
    // geen opslag: dan begint de testversie leeg
  }
  p.getItem = function (k) {
    return lees.call(this, vanSite(k) ? EIGEN + k : k);
  };
  p.setItem = function (k, v) {
    zet.call(this, vanSite(k) ? EIGEN + k : k, v);
  };
  p.removeItem = function (k) {
    wis.call(this, vanSite(k) ? EIGEN + k : k);
  };
}

scheidOpslag();
