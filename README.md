# Klasspelen: wiskunde en Python

Spelletjes met je **eigen vragen**. Eén vragenset kan je spelen als:

- **Quizbord** (categorieën × punten, 2–6 teams) en **Vier op een rij** (2 teams), op het bord;
- **Live quiz**: elke leerling speelt op de eigen laptop terwijl jij live meevolgt op het bord;
- **Escape room**: elke leerling opent sloten door vragen op te lossen; elk slot geeft een
  cijfer van de geheime code, en met de volledige code ontsnap je. Jij ziet live wie welk slot
  open heeft en wie ontsnapt is.

## Aan de slag

1. **Website online zetten (eenmalig)**: op GitHub in deze repository
   **Settings → Pages → Build and deployment → Source: GitHub Actions**. Daarna
   **Actions → Website publiceren → Run workflow**. Na een minuut staat de site op
   `https://max-yousif.github.io/games/`.
2. **Uitproberen zonder verdere installatie**: quizbord en vier op een rij werken meteen.
   Live quiz en escape room werken als **demo**: open het leerlingenscherm
   (`…/games/#/live`) in een tweede tabblad van dezelfde browser.
3. **Live spelen met echte laptops**: maak een gratis Supabase-project en koppel het
   (± 10 minuten): zie [supabase/README.md](supabase/README.md).
4. **Eigen inhoud**: maak een klas (namen plakken) en vragensets (zelf typen of importeren).
   Maak af en toe een **back-up** (startpagina): alles staat in de browser van je laptop.

- **Klassen** met namen van leerlingen (plakken uit Excel/Smartschool of Excel importeren);
  elke beurt wordt aan een leerling gekoppeld (of 🎲 willekeurig gekozen).
- **Vragensets** zelf maken met 7 vraagtypes: open vraag, meerkeuze, waar/onwaar, getal (met
  foutmarge), invullen, ordenen (bv. Python-lijnen) en koppelen. Formules in LaTeX (`$x^2$`),
  Python-code in codeblokken, dupliceren en bewaren als bestand.
- **Vragen importeren**: plak cellen uit Excel/Google Sheets, tekst uit Word of van een
  AI-chatbot (snelformaat met `*`, `-` en `=`), of sleep een Excel-bestand. Je kiest zelf welke
  kolom wat is en ziet elke vraag vooraf.
- **Dark mode**: knop rechtsboven (donker, licht of zoals de computer).
- **Resultaten** per leerling bekijken en **exporteren naar Excel**.
- Spellen **pauzeren en hervatten**, laatste beurt **ongedaan maken**, timer, volledig scherm.
- **Live quiz en escape room**: code op het bord, leerlingen kiezen hun naam (en eventueel een
  bijnaam voor op het bord), je volgt alles live, automatisch nakijken (ook open vragen),
  tussenstand en eindstand. Leerlingen kunnen het spel verlaten en terugkeren, reageren met
  emoji (😠 😂 ❤️ 😢 💀 🐐) terwijl ze wachten, en antwoorden met een **wiskunde-editor**
  (breuken, machten, wortels, maal). Eén browser is één leerling.
- **Leerkrachtaccount**: meld je aan (rechtsboven) en je vragensets, klassen en resultaten staan
  in Supabase en synchroniseren automatisch tussen al je toestellen. Enkel een aangemelde
  leerkracht kan live spellen starten. Vereist een gratis
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
npm run test:e2e # browsertests (Playwright)
npm run build    # productieversie in dist/
```

## Online zetten (GitHub Pages)

1. Op GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Elke push naar `main` publiceert automatisch de website op
   `https://<gebruikersnaam>.github.io/games/`.
