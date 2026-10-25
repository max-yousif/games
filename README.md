# Klasspelen: wiskunde en Python

Spelletjes met je **eigen vragen**. Eén vragenset kan je spelen als **Quizbord**
(categorieën × punten, 2–6 teams), **Vier op een rij** (2 teams) of **Live quiz**: elke
leerling speelt op de eigen laptop terwijl jij live meevolgt op het bord.

- **Klassen** met namen van leerlingen (plakken uit Excel/Smartschool of Excel importeren);
  elke beurt wordt aan een leerling gekoppeld (of 🎲 willekeurig gekozen).
- **Vragensets** zelf maken met 7 vraagtypes: open vraag, meerkeuze, waar/onwaar, getal (met
  foutmarge), invullen, ordenen (bv. Python-lijnen) en koppelen. Formules in LaTeX (`$x^2$`),
  Python-code in codeblokken, importeren uit Excel, dupliceren en bewaren als bestand.
- **Resultaten** per leerling bekijken en **exporteren naar Excel**.
- Spellen **pauzeren en hervatten**, laatste beurt **ongedaan maken**, timer, volledig scherm.
- **Live quiz**: code op het bord, leerlingen kiezen hun naam, je ziet live wie geantwoord
  heeft, automatisch nakijken (ook open vragen), tussenstand en eindstand. Vereist een gratis
  Supabase-project: zie [supabase/README.md](supabase/README.md). Zonder Supabase werkt een demo
  in één browser.
- **Back-up** van alles in één bestand. Klassen, sets en resultaten blijven in je browser.
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
