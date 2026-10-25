# Wiskunde- en Python-spelletjes: projectplan

Een website waarmee een leerkracht **zelf vragensets maakt** en die in de klas speelt als
**klassikaal spel** (projector, in teams) of later als zelfstandige oefening. Eén vragenset
kan je met elk speltype spelen. De volledige website is in het **Nederlands**.

## 1. Uitgangspunten (keuzes van de leerkracht)

| Keuze | Gevolg voor het ontwerp |
|---|---|
| Namen van leerlingen zien | Per klas een leerlingenlijst; elke beurt wordt aan een leerling gekoppeld. |
| Resultaten exporteren als bestand | Na elk spel: export naar Excel (.xlsx) per leerling. |
| Live spelen op eigen laptops, leerkracht volgt live mee | **Live quiz** met een kleine database (Supabase): enkel tijdens het spel, daarna gewist. |
| Klassen en sets lokaal | Klassen, vragensets en resultaten blijven in de browser van de leerkracht + back-upbestand. Geen accounts. |
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

| Type | Voorbeeld | In de klas (bord) | Live quiz (laptop) |
|---|---|---|---|
| **Open vraag** | Werk uit: $(2a-5)^2$ | Mondeling of wisbordje; leerkracht klikt juist/fout | Typen; automatisch nagekeken (spaties, hoofdletters, $…$ maken niet uit), leerkracht kan groepen antwoorden goed- of afkeuren |
| **Meerkeuze** (2–8 opties) | Welke grafiek…? | Leerkracht klikt de gekozen optie | Gekleurde knoppen |
| **Waar of onwaar** | $2^3 \cdot 2^4 = 2^{12}$ | Idem, twee opties | Twee grote knoppen |
| **Getal** (met foutmarge) | Groeifactor op 0,01 nauwkeurig | Idem open vraag | Komma, punt, breuk (3/4) en "x = …" worden herkend |
| **Invullen** | `for i in [[range]](3):` | Gaten genummerd (1), (2)…; antwoorden per gat | Invulvak per gat; meerdere juiste antwoorden per gat mogelijk (`[[0,5\|1/2]]`) |
| **Ordenen** | Python-lijnen in de juiste volgorde (Parsons) | Items met letters door elkaar; oplossing als "C – A – B" | Items verschuiven met pijltjes; inspringing telt |
| **Koppelen** | Voorschrift ↔ grafiek | Links genummerd, rechts letters; oplossing "1 → C" | Per item de juiste letter kiezen |

Later nog: algebraïsche uitdrukking met controle op gelijkwaardigheid, punt aanklikken op een
grafiek, Python-code schrijven met tests (Pyodide).

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
| 3 | Bingo | Unieke bingokaarten met antwoorden afdrukken. |
| 1b | **Live quiz** | Elke leerling op de eigen laptop (zie §4b). |
| 1d | **Escape room** | Elke leerling op de eigen laptop, in eigen tempo (zie §4c). |
| later | Zelfstandig: herhalingsoefening, pixelkunst, memory | Op de laptop van de leerling; resultaat via de live server naar de leerkracht. |

Extra's voor de klas: **volledig scherm**, grote letters (leesbaar van achteraan),
sneltoetsen, eindstand met podium.

## 4b. Live quiz (elke leerling op de eigen laptop)

**Verloop**
1. De leerkracht kiest *Spelen → Live quiz*, een vragenset en een klas (afwezigen aanvinken),
   timer en snelheidsbonus. Op het bord verschijnt een **code van 6 tekens**.
2. Leerlingen surfen naar `…/#/live`, geven de code in en **kiezen hun naam uit de klaslijst**
   (een gekozen naam verdwijnt voor de anderen). Zonder klas typen ze zelf hun naam. In de
   wachtzaal kunnen ze een **bijnaam** instellen die op het bord verschijnt (niet de naam van een
   klasgenoot); de leerkracht ziet de echte naam (tooltip, resultaten, Excel) en kan een
   ongepaste bijnaam wissen. Met **Verlaten** komt de naam weer vrij; wie terugkeert met
   dezelfde naam behoudt de punten.
3. De leerkracht ziet live wie aangemeld is en start de quiz.
4. Per vraag: de vraag staat op het bord én op elke laptop. Op het bord kleurt elke naam groen
   zodra die leerling geantwoord heeft (zonder te tonen of het juist is), met een teller
   "12 / 20 geantwoord" en de timer.
5. Als de tijd om is of iedereen geantwoord heeft, verschijnt automatisch het antwoord:
   verdeling over de opties (meerkeuze) of gegroepeerde antwoorden (open vraag), en de
   tussenstand. Open antwoorden worden automatisch nagekeken (schrijfwijze maakt niet uit:
   `x=7`, `$x = 7$` en `7` zijn gelijk); de leerkracht kan een groep antwoorden met één klik
   goed- of afkeuren.
6. De leerling ziet meteen juist/fout, de punten, het juiste antwoord met uitleg en de eigen plaats.
7. Eindstand met podium; resultaten per leerling naar Excel; *Afsluiten* wist de gegevens op
   de server.

**Techniek**
- Supabase (Postgres + Realtime), EU-regio, gratis plan. De website blijft op GitHub Pages.
- Iedereen meldt zich **anoniem** aan: geen accounts of wachtwoorden.
- **Row level security**: leerlingen zien enkel hun eigen antwoorden, kunnen niets wijzigen,
  en het juiste antwoord staat pas in de database wanneer de leerkracht het toont.
- De **server meet de tijd** per antwoord (snelheidsbonus: van 100 % tot 50 % van de punten),
  één antwoord per vraag, te late antwoorden worden geweigerd.
- Pagina herladen of verbinding kwijt: de leerling speelt verder met dezelfde naam. Van laptop
  wisselen: de leerkracht koppelt de naam los, de leerling meldt zich opnieuw aan.
- Sessies worden gewist na *Afsluiten* of automatisch na 2 dagen.
- **Demo-modus** zonder server: leerlingenschermen in andere tabbladen van dezelfde browser.
- **Testtabblad** (🧪 in de wachtzaal): met Supabase meldt elk testtabblad zich apart aan, zodat
  de leerkracht op één laptop meerdere leerlingen kan spelen (geen incognitovenster nodig).
- **Verbindingsbolletje** bij leerkracht en leerling; na een verbroken verbinding of slaapstand
  wordt alles meteen opnieuw opgehaald.
- Installatie: zie [`supabase/README.md`](supabase/README.md).

## 4c. Escape room (elke leerling op de eigen laptop, in eigen tempo)

1. *Spelen → Escape room*: kies een vragenset, het aantal sloten (alle vragen of een
   willekeurige selectie), de totale tijd en de wachttijd na een fout antwoord.
2. Aanmelden zoals bij de live quiz (code op het bord, naam kiezen).
3. Elke leerling ziet de sloten en een geheime code met vraagtekens. Een slot opent met een
   juist antwoord en onthult één cijfer van de code. De volgorde kiezen de leerlingen zelf;
   na een fout antwoord mogen ze opnieuw proberen na de wachttijd (tegen gokken).
4. Zijn alle sloten open, dan typt de leerling de code en ontsnapt.
5. Op het bord: klok, aantal ontsnapt en een tabel met per leerling per slot 🔒 / ⏳ / ✗n / ✅
   en de ontsnappingstijd. De geheime code kan de leerkracht tonen met een knop.
6. Einde (knop of als de tijd om is): podium met de snelste ontsnappers, resultaten en
   Excel-export (met "ontsnapt na").

Techniek: alles wordt nagekeken in de browser van de leerkracht, zodat antwoorden en code nooit
op de laptops van de leerlingen staan. De database bewaart meerdere pogingen per slot en
dwingt de wachttijd en de totale tijd af.

Mogelijke uitbreidingen: teams per escape room, een verhaal per slot ("kamer"), sloten die
pas openen na een vorig slot, of een code die een puzzel vormt (bv. cijfers door elkaar).

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

- Vragensets en resultaten blijven op de laptop van de leerkracht (browseropslag) of in een
  bestand dat de leerkracht zelf bewaart. Klassen kunnen daarnaast in de **kluis**: versleuteld
  in de browser met de kluiscode van de leerkracht, zodat Supabase enkel onleesbare tekst bewaart.
- Enkel tijdens een **live quiz** staan namen en antwoorden op de server (Supabase, EU-regio),
  en enkel voor die ene sessie: na *Afsluiten* of na 2 dagen wordt alles gewist. Het is
  aangeraden de school op de hoogte te brengen (verwerkersovereenkomst/GDPR).
- De code staat in een publieke repository, maar daar staan **geen** leerlingnamen in.

## 7. Techniek

| Onderdeel | Keuze |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Opmaak | Tailwind CSS |
| Formules | KaTeX |
| Excel | read-excel-file / write-excel-file |
| Opslag | localStorage, versie in de sleutel (`games.v1.*`) |
| Live | Supabase (Postgres, Realtime, anonieme aanmelding), schema in `supabase/schema.sql` |
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

**Fase 1: klassikaal spelen (klaar)**
- Klassen beheren (plakken, Excel-import)
- Vragensets: editor (open + meerkeuze, LaTeX, code), Excel-import, dupliceren, bestand
- Quizbord en Vier op een rij, teams, leerling kiezen, timer, sneltoetsen
- Sessies hervatten, resultaten bekijken en exporteren naar Excel
- Back-up van alles in één bestand
- Voorbeeldsets: 3e jaar algebra, 6 HW statistiek & kansen, 4e Python basis

**Fase 1b: live quiz op eigen laptops (klaar)**
- Supabase-schema met beveiliging, live wachtruimte, live meevolgen, automatisch nakijken,
  tussenstand, eindstand, Excel-export, demo-modus

**Fase 1c: meer vraagtypes (klaar)**
- Waar/onwaar, getal met foutmarge, invullen, ordenen (Parsons) en koppelen, in de editor,
  op het bord, in de live quiz en in de Excel-import

**Fase 1d: escape room (klaar)**

**Fase 1e: optimalisatie (deze versie)**
- Supabase wakker houden met een geplande GitHub-taak (elke 3 dagen)
- Sneller laden: startpagina van 279 kB naar 78 kB (gecomprimeerd); Supabase, KaTeX, Excel en
  de spellen worden pas geladen wanneer nodig
- Verbindingsbolletje en automatisch opnieuw verbinden
- Onderhoud: nieuwere GitHub-acties, KaTeX-beveiligingsupdate, browsertests (Playwright) die op
  GitHub draaien vóór elke publicatie
- Bijnaam, verlaten/terugkeren, testtabblad, lopende spellen beëindigen
- Gaten bij invulvragen als gekleurde symbolen (★ ● ▲ …) in plaats van cijfers
- Open vragen met meerdere juiste antwoorden ("+ ook juist", Excel-kolom *Ook juist*)

**Fase 1f: reacties, wiskunde-editor en klassen in de cloud (deze versie)**
- Emoji-reacties tijdens het wachten (😠 😂 ❤️ 😢 💀 🐐), zwevend over het bord met de
  (bij)naam; niet bewaard, enkel doorgestuurd; de leerkracht kan ze verbergen
- Wiskunde-editor (MathLive) als keuze bij open vragen, getallen en invullen; het nakijken
  herkent breuken, machten, wortels en maal in elke schrijfwijze
- Kluis van de leerkracht: klassen versleuteld (AES, sleutel afgeleid uit de kluiscode) in
  Supabase, automatisch gesynchroniseerd tussen toestellen; de server ziet geen namen

**Volgende stap (voorstel): leerkrachtlogin + cloudopslag van vragensets**
- Enkel de leerkracht kan spellen starten (magische link per e-mail); leerlingen blijven anoniem
- Vragensets en resultaten ook in de kluis: op elke laptop beschikbaar, geen verlies meer
- Anonieme gebruikers automatisch opruimen na 30 dagen; CAPTCHA/rate limits in Supabase

**Fase 2: meer spellen**
- Race op het bord, Kaboom, Miljonairsladder
- "Stelen": bij een fout antwoord mag een ander team proberen
- Geluidseffecten (aan/uit)

**Fase 3: Python-cursus**
- Cursus van de leerkracht omzetten naar vragensets per hoofdstuk
- Vraagtype zoek-de-bug (lijn aanklikken), syntaxkleuring

**Fase 4: zelfstandig oefenen op laptops**
- Leerling kiest naam, oefent een set in eigen tempo (getal, uitdrukking, meerkeuze, Python met Pyodide)
- Resultaten komen via de live server binnen bij de leerkracht
- Live spelen in teams (teamscore op het bord)
- Geparametriseerde vragen (andere getallen voor elke leerling)

**Fase 5: grafieken en extra's**
- Grafiekvragen (punt aanklikken), bingo-afdruk, pixelkunst

## 9. Kwaliteit

- Automatische tests voor de spellogica (quizbord, vier op een rij, live quiz), scores,
  imports en de weergave van formules.
- Het Supabase-schema (beveiliging en functies) wordt getest op een echte Postgres (PGlite).
- Browsertests (Playwright, `npm run test:e2e`): quizbord, live quiz (bijnaam, verlaten en
  terugkeren) en escape room, met leerlingen in aparte tabbladen.
- GitHub Actions voert voor elke publicatie typecheck, alle tests en de build uit.
- Testen op een laptop met projector (1280×720 en 1920×1080).
