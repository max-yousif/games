# Klasspelen

Website voor een leerkracht wiskunde/informatica (3e–6e jaar secundair): zelf vragensets maken en
die in de klas spelen. Live op https://max-yousif.github.io/games/ (GitHub Pages, workflow
`deploy.yml` publiceert elke push naar `main`).

Stack: React 19 + TypeScript + Vite + Tailwind 4, Vitest (unit, `tests/`), Playwright
(`tests/e2e/`, lokaal backend), Supabase (live spellen + cloudopslag per leerkrachtaccount).

## Afspraken (altijd)

- Alles in het **Nederlands** (Vlaams), ook de UI. Kort en duidelijk, geen overbodige tekst of uitleg in de UI.
- Leerlingen spelen op **laptops**; het bord staat op de projector. Geen gsm-lay-out, geen groepsspel op één laptop, geen demo-optie.
- Enkel **3e tot 6e jaar**.
- **Nakijken gebeurt op de laptop van de leerkracht** (host), niet op de server.
- Resultaten worden enkel bewaard als de leerkracht expliciet op "💾 Resultaten bewaren" klikt.
- In laptopspellen: vragen en meerkeuzeantwoorden in willekeurige volgorde per leerling.
- Bij een fout antwoord ziet de leerling het juiste antwoord (behalve waar het spel dat bewust verbergt, zoals de escape room).
- Open vragen: spaties en hoofdletters negeren.
- Menu's sluiten bij klik ernaast of Esc; klikbare elementen tonen het handje.
- Nieuwe spellen zijn **origineel**: geen namaak van een bestaand (commercieel) spel, ook niet hernoemd.

## Privacy en veiligheid

- Nooit namen van leerlingen of echte leerkrachten in de repo (ook niet in tests of fixtures).
- Nooit de Supabase service_role/secret key; enkel de publieke anon key.
- Nooit wachtwoorden in code of chat (het gastwachtwoord staat enkel in het GitHub-secret).
- Lokale gegevens horen bij één account (`games.v1.eigenaar`): niets mag van het ene account naar het andere lekken.

## Werkwijze

- Volg de stijl van de omliggende code (Nederlandse namen, weinig maar nuttige commentaar).
- Voor elke commit: `npx tsc -b`, `npm test`, `npm run test:e2e` (relevante specs) en `npm run build` moeten slagen.
- Nieuw live spel: spellogica puur in `src/live/<spel>.ts` met unit tests; host- en spelerscherm in `src/live/`; opnemen in `SpelenPage`; e2e-test toevoegen.
- Geen prettier op hele bestanden draaien.
- Grote wijziging aan het live spelen (nakijken, ophalen van antwoorden): ook de belastingstest draaien (`LEERLINGEN=8 npm run test:belasting`).
- Geen modelnamen in commits of code.

## Publiceren

Alleen na **expliciete goedkeuring van de leerkracht** naar `main` pushen
(`git push origin HEAD:main && git push origin HEAD:claude/live-spelen`). Voorstellen van de
wekelijkse agent staan eerst op de branch `agent/voorstel`.

Na een push naar `agent/voorstel` draaien alle tests op GitHub; slagen ze, dan staat het voorstel
na een paar minuten als testversie op https://max-yousif.github.io/games/voorstel/ (eigen kopie
van de browseropslag, niets naar de cloud; zie `src/lib/voorstel.ts`). Vermeld die link in de
samenvatting voor de leerkracht. Na publiceren naar `main` verdwijnt de testversie vanzelf.

Wensen en ideeën van de leerkracht staan in `WENSEN.md`.
