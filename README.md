# Klasspelen: wiskunde en Python

Klassikale spelletjes met je **eigen vragen**, voor op de projector. Eén vragenset kan je
spelen als **Quizbord** (categorieën × punten, 2–6 teams) of **Vier op een rij** (2 teams).

- **Klassen** met namen van leerlingen (plakken uit Excel/Smartschool of Excel importeren);
  elke beurt wordt aan een leerling gekoppeld (of 🎲 willekeurig gekozen).
- **Vragensets** zelf maken: open vragen en meerkeuze, formules in LaTeX (`$x^2$`),
  Python-code in codeblokken, importeren uit Excel, dupliceren en bewaren als bestand.
- **Resultaten** per leerling bekijken en **exporteren naar Excel**.
- Spellen **pauzeren en hervatten**, laatste beurt **ongedaan maken**, timer, volledig scherm.
- **Back-up** van alles in één bestand. Alles blijft in de browser: er wordt niets doorgestuurd.
- Voorbeeldsets: 3e jaar algebra (5 u), 6e jaar Humane wetenschappen (statistiek, kansen,
  groei) en 4e jaar Python basis.

Sneltoetsen tijdens een vraag: **spatie** = antwoord tonen, **J** = juist, **F** = fout,
**W** = willekeurige leerling, **A–D** = meerkeuzeoptie, **Esc** = terug.

Zie [PLAN.md](PLAN.md) voor het volledige plan en de volgende fases.

## Lokaal ontwikkelen

```bash
npm install
npm run dev      # ontwikkelserver op http://localhost:5173
npm test         # tests
npm run build    # productieversie in dist/
```

## Online zetten (GitHub Pages)

1. Op GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Elke push naar `main` publiceert automatisch de website op
   `https://<gebruikersnaam>.github.io/games/`.
