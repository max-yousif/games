# Klasspelen: wiskunde en Python

Spelletjes met je **eigen vragen**, voor het 3e tot 6e jaar. Eén vragenset kan je met elk
spel spelen. Live op https://max-yousif.github.io/games/.

## Spellen

**Op het bord, in teams** (projector):
- **Quizbord**: categorieën × punten, 2–6 teams. Eerst kies je wie antwoordt (een leerling,
  willekeurig of het hele team), dan verschijnt de vraag.
- **Vier op een rij**: juist antwoord = een schijf laten vallen, 2 teams.
- **Bom doorgeven**: juist antwoord = bom naar het volgende team; wie ze vasthoudt als ze
  ontploft, verliest. Het team aan de beurt staat altijd op het bord.

**Op de eigen laptop** (code op het bord, jij volgt live mee):
- **Live quiz**: iedereen dezelfde vraag, met tussenstand.
- **Escape room**: elk antwoord geeft een cijfer, juist of niet; een foute code geeft straftijd.
- **Codekraker**: munten verdienen, kistjes openen en elkaars wachtwoord kraken.
- **Territorium**: juist antwoord = even tekenen in je kleur; tegen elkaar of samen een
  kleurplaat inkleuren.
- **Grafiekjacht** (zonder vragenset): het voorschrift zoeken bij een grafiek
  a·f(b(x − c)) + d. De leerling ziet de eigen grafiek meteen over de doelgrafiek; jij kiest de
  basisfuncties en transformaties.

**Op de eigen laptop, met een verhaal** (voorbereiden bij de vragenset):
- **Detectivezaak**: wie, waar en waarmee? Juiste antwoorden strepen kaarten weg; een foute
  beschuldiging geeft straftijd.
- **Whodunit**: elke juiste oefening geeft een hint voor een logisch raadsel.

In de laptopspellen krijgt elke leerling de vragen en meerkeuzeantwoorden in een eigen
volgorde, en ziet bij een fout antwoord het juiste antwoord (behalve in de escape room). Open
vragen negeren spaties en hoofdletters; wiskundige uitdrukkingen kunnen ook gelijkwaardig
nagekeken worden. **Je laptop kijkt alles na**: laat het spel openstaan tot het einde.

## Verder

- **Leerkrachtaccount** (rechtsboven): vragensets, klassen en resultaten staan in de cloud en
  zijn op elk toestel hetzelfde. Elk account ziet enkel zijn eigen gegevens.
- **Klassen** per jaar, namen plakken uit Excel/Smartschool. Op het bord enkel voornamen.
- **Vragensets** met 7 vraagtypes (open, meerkeuze, waar/onwaar, getal, invullen, ordenen,
  koppelen), formules in LaTeX, Python-code, importeren uit Excel/Word.
- **Resultaten** worden enkel bewaard als je op het einde **💾 Resultaten bewaren** kiest;
  bekijken per leerling, per onderwerp en moeilijkste vragen, exporteren naar Excel.
- **Muziek en geluid**, dark mode, volledig scherm, pauzeren en hervatten.

Sneltoetsen bij een vraag op het bord: **spatie** = antwoord tonen, **J** = juist, **F** = fout,
**W** = willekeurige leerling, **A–D** = meerkeuzeoptie, **Esc** = terug.

Wensen voor nieuwe spellen en verbeteringen: [WENSEN.md](WENSEN.md). Afspraken voor wie aan de
code werkt: [CLAUDE.md](CLAUDE.md).

## Instellen

- **Supabase** (database voor live spelen en accounts): zie [supabase/README.md](supabase/README.md).
  De taak *Supabase wakker houden* voorkomt dat het gratis project na een vakantie gepauzeerd is.
- **GitHub Pages**: elke push naar `main` publiceert de site (workflow *Website publiceren*).

## Lokaal ontwikkelen

```bash
npm install
npm run dev      # ontwikkelserver op http://localhost:5173 (zonder Supabase: lokaal backend)
npm test         # unit tests
npm run test:e2e # browsertests (Playwright)
npm run build    # productieversie in dist/
```
