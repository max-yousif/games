# Wensen

Zet hier ideeën voor nieuwe spellen of verbeteringen. De wekelijkse agent neemt de bovenste open
wens eerst; staat er niets, dan kiest hij zelf een verbetering of een nieuw, origineel spel.

## Open

1. **Laptop van de leerkracht actief houden tijdens live spellen.** De host kijkt alles na; valt
   die laptop in slaap of gaat het tabblad dicht, dan hangen alle leerlingen. Tijdens een lopend
   spel: Screen Wake Lock aanvragen (en opnieuw na terugkeer naar het tabblad), waarschuwen bij
   sluiten/herladen (beforeunload), en bij de leerlingen kort "Het bord is even weg…" tonen als de
   host een tijd niets doet, in plaats van eindeloos te wachten.

2. **Supabase niet laten pauzeren.** Een gratis project pauzeert na ongeveer een week zonder
   gebruik (vakanties). Een geplande GitHub-workflow die bv. om de 3 dagen een lichte vraag stelt
   met de publieke anon key (geen secret key!). Enkel als dat zonder geheime sleutel kan.

3. **Geen merknamen.** "Crypto Hack" → overal **Codekraker** (UI, export, README; ook de zin
   "naar Crypto Hack van Blooket" weg). "Cluedo" → **Detectivezaak** in alles wat de leerkracht
   of leerlingen zien. Interne id's (`cluedo`, `codekraker`) en bewaarde gegevens blijven werken.

4. **Documentatie bijwerken.** `README.md` beschrijft nog de demo-modus, spelen per 2/3 op één
   laptop en "Afsluiten" als bewaren. `PLAN.md` zegt nog "geen accounts, alles lokaal". Bijwerken
   naar hoe de site nu werkt (of PLAN.md schrappen als het niets meer toevoegt).

5. **Voorstellen kunnen uitproberen vóór goedkeuring.** De workflow laat ook op pushes naar
   `agent/voorstel` typecheck, unit- en e2e-tests draaien. En als het veilig kan: een testversie
   van die branch op `/games/voorstel/` naast de gewone site. Let op: dezelfde browseropslag en
   dezelfde cloud; de testversie mag niets aan bewaarde gegevens beschadigen (bv. geen cloudsync
   of een aparte opslagprefix).

6. **Nieuw spel: Grafiekjacht** (live, op de laptops). Oefent transformaties van functies.
   Op het bord en bij de leerlingen verschijnt een doelgrafiek: een basisfunctie (x², x³, √x,
   |x|, 1/x, eˣ/ aˣ, log, sin/cos … naargelang het jaar) na transformaties
   a·f(b(x − c)) + d. De leerling typt het voorschrift (wiskunde-invoer) en ziet de eigen grafiek
   meteen over de doelgrafiek; indienen = nakijken op de laptop van de leerkracht (gelijkwaardige
   voorschriften gelden, controleren op meetpunten). De leerkracht kiest bij de start welke
   basisfuncties en welke transformaties meedoen (bv. enkel verschuivingen), het aantal rondes en
   of de grafieken per leerling verschillen. Punten voor juist en snel; het bord toont de stand
   en per ronde hoeveel leerlingen het al hebben. Geen vragenset nodig.

7. **Nieuw spel: Puzzel** (live, op de laptops, met een vragenset). De leerkracht uploadt vooraf
   een foto (bij de vragenset, zoals de cover, of bij de start; verkleinen/comprimeren zodat het
   vlot naar 25 laptops gaat). De foto wordt in stukjes verdeeld (ongeveer zoveel als er vragen
   meedoen, of een gekozen raster). Elke juist beantwoorde vraag ontgrendelt een willekeurig
   stukje; de leerling sleept de stukjes op de juiste plaats. Een fout beantwoorde vraag komt
   later terug, zodat iedereen alle stukjes kan verdienen. Wie als eerste alle stukjes heeft én de
   puzzel volledig juist gelegd heeft, wint; daarna de volgende plaatsen. Het bord toont per
   leerling hoeveel stukjes verdiend en gelegd zijn (niet de foto zelf, tot het einde).

8. **Belastingstest.** Een script dat ~30 leerlingen gedurende 20 minuten live spellen nabootst
   (vooral Codekraker) tegen het lokale backend of een testproject, om problemen zoals de oude
   grens van 1000 rijen te vinden vóór ze in de les opduiken.

9. **Eigen vensters i.p.v. `confirm()`/`alert()`** (±21 plaatsen): een eigen dialoog die past in
   de stijl van de site, of "ongedaan maken" waar dat handiger is.

10. **Instellingen onthouden per spel en klas** op de Spelen-pagina (zoals de vraagkeuze van de
    escape room al doet), zodat de leerkracht minder moet klikken.

11. **Herhalingsset uit "Moeilijkste vragen"** bij Resultaten: met één klik een nieuwe vragenset
    maken met die vragen.

12. **Toegankelijkheid**: juist/fout, straftijd en nieuwe stukjes/hints ook aankondigen voor
    schermlezers (aria-live); waar kleur de enige aanduiding is (teams, territorium) een icoon of
    patroon toevoegen.

13. **Onderhoud**: `SpelenPage.tsx` en `LiveHost.tsx` opsplitsen per spel, zonder gedrag te
    veranderen.

## Gedaan

-
