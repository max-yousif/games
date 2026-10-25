# Live spelen instellen (Supabase)

Voor **Live quiz** en **Escape room** (elke leerling op de eigen laptop) is een kleine online
database nodig.
Daarvoor gebruiken we [Supabase](https://supabase.com): het gratis plan volstaat ruim voor een klas.
De website zelf blijft gewoon op GitHub Pages staan.

Zonder Supabase werken ze enkel als **demo** in één browser (leerlingenscherm in een
tweede tabblad), handig om alles uit te proberen.

## Eenmalig instellen (± 10 minuten)

1. **Project maken**: maak een gratis account op supabase.com en klik op **New project**.
   - Kies als regio **Frankfurt (eu-central-1)** of een andere EU-regio (GDPR).
   - Het databasewachtwoord heb je verder niet nodig.
2. **Database klaarzetten**: open **SQL Editor → New query**, plak de volledige inhoud van
   [`schema.sql`](schema.sql) en klik op **Run**. (Het script mag later opnieuw uitgevoerd
   worden, bv. na een update.)
3. **Anoniem aanmelden toestaan**: **Authentication → Sign In / Providers** →
   zet **Allow anonymous sign-ins** aan en klik op **Save**.
   Leerlingen hebben zo geen account of wachtwoord nodig.
4. **Leerkrachtaccount maken** (enkel een leerkracht kan live spellen starten en heeft zijn
   vragensets, klassen en resultaten op elk toestel):
   - **Authentication → Users → Add user → Create new user**
   - E-mail: `maxyousif@klasspelen.local`, kies een wachtwoord en vink **Auto Confirm User** aan.
     (Aanvaardt Supabase dat adres niet, gebruik dan je echte e-mailadres; je meldt dan aan
     met dat e-mailadres in plaats van met de gebruikersnaam.)
   - Maak er een leerkracht van: **SQL Editor → New query**, plak en klik op **Run**:
     ```sql
     insert into public.leerkrachten (uid, naam)
     select id, 'maxyousif' from auth.users where email = 'maxyousif@klasspelen.local';
     ```
     (Vervang het e-mailadres als je je echte adres gebruikte.)
   - Op de website: **👤 Aanmelden** rechtsboven, gebruikersnaam `maxyousif` en je wachtwoord.
5. **Sleutels opzoeken**: **Project Settings → API** (of de knop **Connect**):
   - de **Project URL** (bv. `https://abcdefgh.supabase.co`)
   - de **publishable key** (begint met `sb_publishable_`) of, bij oudere projecten, de
     **anon public key**. Deze sleutel mag publiek zijn: de beveiliging zit in de database
     (row level security). Gebruik **nooit** de `service_role`/secret key.
6. **Sleutels aan de website geven** (GitHub): in de repository op GitHub
   **Settings → Secrets and variables → Actions → tabblad Variables → New repository variable**:
   - `SUPABASE_URL` = de Project URL
   - `SUPABASE_ANON_KEY` = de publishable/anon key
7. **Opnieuw publiceren**: **Actions → Website publiceren → Run workflow** (of push iets naar
   `main`). Daarna staat bij *Spelen → Live quiz / Escape room* de demo-optie niet meer
   standaard aan.

**Na een update van de website** met wijzigingen aan `schema.sql`: voer het script opnieuw uit
in de SQL Editor (het bewaart bestaande gegevens). Laatste wijziging: leerkrachtaccounts
(`leerkrachten`) en de cloudopslag (`leerkracht_items`); enkel een leerkracht kan nog live
spellen starten. De oude kluis (`leerkracht_kluis`) wordt niet meer gebruikt en mag je wissen.

**Alles op al je toestellen**: aangemeld als leerkracht worden je vragensets, klassen en
resultaten bewaard in de tabel `leerkracht_items`. Enkel jij kan ze lezen (row level security).
Per item wint de laatste wijziging. Emoji-reacties gebruiken Supabase Realtime (broadcast) en
worden niet bewaard.

**Controleren of alles klopt**: **Actions → Supabase controleren → Run workflow** test het
schema, anoniem aanmelden en de beveiliging (enkel leerkrachten starten live spellen).

**Supabase wakker houden**: de GitHub-taak *Supabase wakker houden* roept de database elke
3 dagen aan, zodat het gratis project niet gepauzeerd wordt. Dat werkt automatisch zodra de
variabelen `SUPABASE_URL` en `SUPABASE_ANON_KEY` ingesteld zijn en het schema `live_ping` bevat.
Je kan het meteen testen via **Actions → Supabase wakker houden → Run workflow**.

Lokaal ontwikkelen: maak een bestand `.env.local` (wordt niet mee opgeslagen in git):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## Goed om te weten

- **Gratis plan**: een project dat 7 dagen niet gebruikt wordt, wordt gepauzeerd. Je kan het
  in het Supabase-dashboard met één klik weer starten (duurt een minuutje). Speel je minstens
  wekelijks, dan merk je daar niets van.
- **Privacy**: op de server staan enkel de titel van de quiz, de namen waaruit leerlingen kiezen,
  de vragen en de antwoorden. Na *Afsluiten* wordt alles meteen gewist; sessies ouder dan
  2 dagen worden automatisch gewist. De resultaten blijven bewaard bij de leerkracht (in de
  browser en, aangemeld, in het leerkrachtaccount; Resultaten → Excel).
- **Beveiliging**: leerlingen zien enkel hun eigen antwoorden, kunnen niets wijzigen en zien het
  juiste antwoord pas wanneer de leerkracht het toont. De tijd per antwoord wordt door de
  server gemeten. Dit alles wordt automatisch getest (`tests/schema.test.ts`).
- **Van laptop wisselen**: de naam van een leerling is gekoppeld aan de laptop. Wisselt een
  leerling van laptop, beweeg dan in de wachtruimte/vraag met de muis over de naam en klik op ✕
  (loskoppelen). De leerling kan daarna opnieuw de naam kiezen en behoudt de punten.
