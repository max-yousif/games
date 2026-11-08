# Wensen

Zet hier ideeën voor nieuwe spellen of verbeteringen. De wekelijkse agent neemt de bovenste open
wens eerst; staat er niets, dan kiest hij zelf een verbetering of een nieuw, origineel spel.

## Open

1. **Eigen vensters i.p.v. `confirm()`/`alert()`** (±21 plaatsen): een eigen dialoog die past in
   de stijl van de site, of "ongedaan maken" waar dat handiger is.

2. **Instellingen onthouden per spel en klas** op de Spelen-pagina (zoals de vraagkeuze van de
   escape room al doet), zodat de leerkracht minder moet klikken.

3. **Herhalingsset uit "Moeilijkste vragen"** bij Resultaten: met één klik een nieuwe vragenset
   maken met die vragen.

4. **Toegankelijkheid**: juist/fout, straftijd en nieuwe stukjes/hints ook aankondigen voor
   schermlezers (aria-live); waar kleur de enige aanduiding is (teams, territorium) een icoon of
   patroon toevoegen.

5. **Onderhoud**: `SpelenPage.tsx` en `LiveHost.tsx` opsplitsen per spel, zonder gedrag te
   veranderen.

## Gedaan

- Belastingstest voor alle live spellen met "onnozele" leerlingen (spammen, onzin typen, herladen,
  offline, tweede tabblad, verlaten): `npm run test:belasting` (lokaal) en de workflow
  *Belastingstest* (echte database, leerkracht als Gast). Alle spellen geslaagd, ook
  Codekraker 60 min, escape room en detectivezaak 50 min met 20 leerlingen. Dataverkeer per drukke
  les (25 leerlingen, 50 min): Codekraker ~290 MB, Territorium ~470 MB, de rest 90–125 MB.
- Nieuw spel Puzzel (foto bij de vragenset, stukjes verdienen en leggen). Het bord toont per
  leerling de verdiende stukjes en wie klaar is (niet hoeveel er al gelegd zijn).
- Nieuw spel Grafiekjacht (transformaties van functies). Mogelijke uitbreiding: per leerling
  andere grafieken.
- Voorstellen uitproberen vóór goedkeuring: tests op `agent/voorstel` en een testversie op
  `/games/voorstel/`.
- Laptop van de leerkracht wakker houden tijdens live spellen, waarschuwen bij sluiten of
  pauzeren; leerlingen zien een melding als het nakijken stilvalt.
- Supabase wakker houden (workflow *Supabase wakker houden*, elke 3 dagen).
- Geen merknamen: Codekraker en Detectivezaak.
- README bijgewerkt, PLAN.md geschrapt.
- Mintekens (−, –, ⁻) gelden als gewone min bij het nakijken.
