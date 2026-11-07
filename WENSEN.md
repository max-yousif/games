# Wensen

Zet hier ideeën voor nieuwe spellen of verbeteringen. De wekelijkse agent neemt de bovenste open
wens eerst; staat er niets, dan kiest hij zelf een verbetering of een nieuw, origineel spel.

## Open

1. **Nieuw spel: Grafiekjacht** (live, op de laptops). Oefent transformaties van functies.
   Op het bord en bij de leerlingen verschijnt een doelgrafiek: een basisfunctie (x², x³, √x,
   |x|, 1/x, eˣ/ aˣ, log, sin/cos … naargelang het jaar) na transformaties
   a·f(b(x − c)) + d. De leerling typt het voorschrift (wiskunde-invoer) en ziet de eigen grafiek
   meteen over de doelgrafiek; indienen = nakijken op de laptop van de leerkracht (gelijkwaardige
   voorschriften gelden, controleren op meetpunten). De leerkracht kiest bij de start welke
   basisfuncties en welke transformaties meedoen (bv. enkel verschuivingen), het aantal rondes en
   of de grafieken per leerling verschillen. Punten voor juist en snel; het bord toont de stand
   en per ronde hoeveel leerlingen het al hebben. Geen vragenset nodig.

2. **Nieuw spel: Puzzel** (live, op de laptops, met een vragenset). De leerkracht uploadt vooraf
   een foto (bij de vragenset, zoals de cover, of bij de start; verkleinen/comprimeren zodat het
   vlot naar 25 laptops gaat). De foto wordt in stukjes verdeeld (ongeveer zoveel als er vragen
   meedoen, of een gekozen raster). Elke juist beantwoorde vraag ontgrendelt een willekeurig
   stukje; de leerling sleept de stukjes op de juiste plaats. Een fout beantwoorde vraag komt
   later terug, zodat iedereen alle stukjes kan verdienen. Wie als eerste alle stukjes heeft én de
   puzzel volledig juist gelegd heeft, wint; daarna de volgende plaatsen. Het bord toont per
   leerling hoeveel stukjes verdiend en gelegd zijn (niet de foto zelf, tot het einde).

3. **Belastingstest.** Een script dat ~30 leerlingen gedurende 20 minuten live spellen nabootst
   (vooral Codekraker) tegen het lokale backend of een testproject, om problemen zoals de oude
   grens van 1000 rijen te vinden vóór ze in de les opduiken.

4. **Eigen vensters i.p.v. `confirm()`/`alert()`** (±21 plaatsen): een eigen dialoog die past in
   de stijl van de site, of "ongedaan maken" waar dat handiger is.

5. **Instellingen onthouden per spel en klas** op de Spelen-pagina (zoals de vraagkeuze van de
   escape room al doet), zodat de leerkracht minder moet klikken.

6. **Herhalingsset uit "Moeilijkste vragen"** bij Resultaten: met één klik een nieuwe vragenset
   maken met die vragen.

7. **Toegankelijkheid**: juist/fout, straftijd en nieuwe stukjes/hints ook aankondigen voor
   schermlezers (aria-live); waar kleur de enige aanduiding is (teams, territorium) een icoon of
   patroon toevoegen.

8. **Onderhoud**: `SpelenPage.tsx` en `LiveHost.tsx` opsplitsen per spel, zonder gedrag te
   veranderen.

## Gedaan

- Voorstellen uitproberen vóór goedkeuring: tests op `agent/voorstel` en een testversie op
  `/games/voorstel/`.
- Laptop van de leerkracht wakker houden tijdens live spellen, waarschuwen bij sluiten of
  pauzeren; leerlingen zien een melding als het nakijken stilvalt.
- Supabase wakker houden (workflow *Supabase wakker houden*, elke 3 dagen).
- Geen merknamen: Codekraker en Detectivezaak.
- README bijgewerkt, PLAN.md geschrapt.
- Mintekens (−, –, ⁻) gelden als gewone min bij het nakijken.
