# Wiskunde- en Python-spelletjes: projectplan

Een website waarmee een leerkracht **zelf vragensets maakt** en die in de klas speelt als
**klassikaal spel** (projector, in teams) of later als zelfstandige oefening. Eén vragenset
kan je met elk speltype spelen. De volledige website is in het **Nederlands**.

## 1. Uitgangspunten (keuzes van de leerkracht)

| Keuze | Gevolg voor het ontwerp |
|---|---|
| Namen van leerlingen zien | Per klas een leerlingenlijst; elke beurt wordt aan een leerling gekoppeld. |
| Resultaten exporteren als bestand | Na elk spel: export naar Excel (.xlsx) per leerling. |
| Geen database | Alles blijft in de browser (localStorage) + back-upbestand. Geen accounts, geen server. |
| Enkel laptops | Ontwerp voor een groot scherm (projector) en laptops; geen gsm-lay-out nodig. |
| Niet delen met collega's | Geen deelfunctie, geen gebruikersbeheer. |
| Eerst klassikale spellen | Fase 1 = projectorspellen met teams. Zelfstandig oefenen komt later. |
| Bewaren en hergebruiken | Vragensets blijven bewaard, kunnen gedupliceerd, bewerkt en als bestand bewaard worden. |

**Doelgroepen**
- **3e jaar, 5 u wiskunde**: algebra (machten, merkwaardige producten, ontbinden),
  vergelijkingen, functies, meetkunde (Pythagoras, gelijkvormigheid), statistiek.
- **4e jaar, basis programmeren (Python)**: inhoud volgt de eigen cursus van de leerkracht
  (wordt later aangeleverd en omgezet naar vragensets).
- **6e jaar, Humane wetenschappen**: statistiek (normale verdeling), kansrekening,
  groeimodellen (exponentiële functies), functies.

## 2. Kernidee

```
Klas (leerlingen)      Vragenset (vragen)      Speltype
        \                     |                   /
         \------------> Spelsessie <-------------/
                              |
                        Resultaten (Excel)
```

- **Vragenset**: titel, vak, leerjaar en een lijst vragen. Elke vraag heeft een
  categorie en punten (voor het quizbord).
- **Klas**: naam (bv. "3A") en een lijst leerlingen.
- **Spelsessie**: één keer spelen = set + klas + speltype + teams. Elke beurt wordt
  bewaard (vraag, team, leerling, juist/fout, punten). Een sessie kan na het sluiten van
  de browser **hervat** worden.

## 3. Vraagtypes

| Fase | Type | Gebruik in de klas |
|---|---|---|
| 1 | **Open vraag** | De leerling antwoordt mondeling of op een wisbordje; de leerkracht toont het antwoord en klikt *juist* of *fout*. |
| 1 | **Meerkeuze** (A–D) | De leerkracht klikt de gekozen optie aan; het juiste antwoord kleurt groen. |
| 2 | Getal met tolerantie | Wordt automatisch gecontroleerd (nodig voor zelfstandig oefenen). |
| 2 | Waar/onwaar, invullen | |
| 3 | Algebraïsche uitdrukking | Controle op wiskundige gelijkwaardigheid. |
| 3 | Python: Parsons (codelijnen ordenen), zoek de bug | |
| 4 | Python: code schrijven met tests | Python in de browser via Pyodide. |

**Opmaak van vragen**
- Formules met LaTeX tussen dollartekens: `$x^2 + 6x + 9$` of `$$\frac{a}{b}$$` (KaTeX).
- Python-code tussen drie backticks (```` ``` ````), weergegeven in een codeblok.
- `inline code` tussen enkele backticks.
- Per vraag een optionele **uitleg** die samen met het antwoord verschijnt.

## 4. Speltypes (klassikaal)

Gemeenschappelijk verloop van een beurt (één component voor alle spellen):
1. De vraag verschijnt groot op het scherm (optioneel met timer).
2. **Wie antwoordt?** Klik een naam uit het team, of 🎲 kies willekeurig (de app kiest
   bij voorkeur iemand die nog weinig beurten had), of "hele team".
3. *Toon antwoord* (spatiebalk), daarna *Juist* (J) of *Fout* (F).
4. Punten gaan naar het team én worden bij de leerling genoteerd.

| Fase | Spel | Werking |
|---|---|---|
| 1 | **Quizbord** | Raster met categorieën × punten (100–400). Teams kiezen om beurt een vak. |
| 1 | **Vier op een rij** | 2 teams. Een juist antwoord geeft het recht om een schijf te laten vallen. |
| 2 | Race op het bord | Pionnen per team schuiven vooruit per juist antwoord; valkuilen en ladders. |
| 2 | Kaboom-pot | Punten verzamelen, maar een "Kaboom" laat je alles verliezen. |
| 2 | Miljonairsladder | Steeds moeilijker, met hulplijnen. |
| 3 | Escape room | Antwoorden vormen samen de code van een slot. |
| 3 | Bingo | Unieke bingokaarten met antwoorden afdrukken. |
| later | Zelfstandig: herhalingsoefening, pixelkunst, memory | Op de laptop van de leerling; resultaat als bestand of controlecode naar de leerkracht. |

Extra's voor de klas: **volledig scherm**, grote letters (leesbaar van achteraan),
sneltoetsen, eindstand met podium.

## 5. Beheer door de leerkracht

- **Vragensets**: nieuw, bewerken met live voorbeeld, dupliceren, verwijderen,
  vragen herschikken.
- **Importeren uit Excel/CSV** met de kolommen *Categorie, Punten, Vraag, Antwoord,
  Fout antwoord 1–3, Uitleg* (met fout-antwoorden wordt het een meerkeuzevraag).
  Een sjabloon kan je downloaden.
- **Klassen**: namen plakken uit Excel/Smartschool (één per lijn) of een Excel-bestand
  importeren.
- **Resultaten**: overzicht van alle gespeelde sessies; export naar Excel per sessie
  (per leerling: team, beurten, juist, fout, punten) of alles samen.
- **Back-up**: één bestand (.json) met alle sets, klassen en resultaten. Terugzetten op
  een andere laptop of na het wissen van de browsergegevens. Een losse vragenset kan je
  ook apart bewaren als bestand.
- **Voorbeeldsets** voor de drie doelgroepen worden bij de eerste start toegevoegd.

## 6. Privacy

- Leerlingnamen en resultaten blijven op de laptop van de leerkracht (browseropslag) of
  in een bestand dat de leerkracht zelf bewaart. Er wordt niets doorgestuurd.
- De code staat in een publieke repository, maar daar staan **geen** leerlingnamen in.

## 7. Techniek

| Onderdeel | Keuze |
|---|---|
| Framework | React 19 + TypeScript + Vite (zoals Gotcha) |
| Opmaak | Tailwind CSS |
| Formules | KaTeX |
| Excel | read-excel-file / write-excel-file |
| Opslag | localStorage, versie in de sleutel (`games.v1.*`) |
| Hosting | GitHub Pages via GitHub Actions (push naar `main` = online) |
| Later | Pyodide (Python), CodeMirror (code-editor), MathLive (formule-invoer), JSXGraph (grafieken) |

```
src/
  lib/        types, opslag, back-up, import/export, spellogica (puur, getest)
  components/ gedeelde UI (knoppen, RichText, beurtvenster, scorebord)
  games/      één bestand per speltype
  pages/      start, vragensets, editor, klassen, spelen, resultaten
  content/    voorbeeldsets
tests/
```

## 8. Fasering

**Fase 1: klassikaal spelen (deze versie)**
- Klassen beheren (plakken, Excel-import)
- Vragensets: editor (open + meerkeuze, LaTeX, code), Excel-import, dupliceren, bestand
- Quizbord en Vier op een rij, teams, leerling kiezen, timer, sneltoetsen
- Sessies hervatten, resultaten bekijken en exporteren naar Excel
- Back-up van alles in één bestand
- Voorbeeldsets: 3e jaar algebra, 6 HW statistiek & kansen, 4e Python basis

**Fase 2: meer spellen**
- Race op het bord, Kaboom, Miljonairsladder
- "Stelen": bij een fout antwoord mag een ander team proberen
- Geluidseffecten (aan/uit)

**Fase 3: Python-cursus**
- Cursus van de leerkracht omzetten naar vragensets per hoofdstuk
- Vraagtypes Parsons en zoek-de-bug, syntaxkleuring

**Fase 4: zelfstandig oefenen op laptops**
- Leerling typt naam, oefent een set (getal, uitdrukking, meerkeuze, Python met Pyodide)
- Resultaat als bestand dat de leerkracht importeert in het resultatenoverzicht
- Geparametriseerde vragen (andere getallen voor elke leerling)

**Fase 5: grafieken en extra's**
- Grafiekvragen (punt aanklikken), escape room, bingo-afdruk, pixelkunst

## 9. Kwaliteit

- Automatische tests voor de spellogica (quizbord, vier op een rij), scores, imports en
  de weergave van formules.
- Voor elke push: `npm test` en `npm run build` (ook in GitHub Actions).
- Testen op een laptop met projector (1280×720 en 1920×1080).
