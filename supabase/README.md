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
   Leerlingen en leerkracht hebben zo geen account of wachtwoord nodig.
4. **Sleutels opzoeken**: **Project Settings → API** (of de knop **Connect**):
   - de **Project URL** (bv. `https://abcdefgh.supabase.co`)
   - de **publishable key** (begint met `sb_publishable_`) of, bij oudere projecten, de
     **anon public key**. Deze sleutel mag publiek zijn: de beveiliging zit in de database
     (row level security). Gebruik **nooit** de `service_role`/secret key.
5. **Sleutels aan de website geven** (GitHub): in de repository op GitHub
   **Settings → Secrets and variables → Actions → tabblad Variables → New repository variable**:
   - `SUPABASE_URL` = de Project URL
   - `SUPABASE_ANON_KEY` = de publishable/anon key
6. **Opnieuw publiceren**: **Actions → Website publiceren → Run workflow** (of push iets naar
   `main`). Daarna staat bij *Spelen → Live quiz / Escape room* de demo-optie niet meer
   standaard aan.

**Na een update van de website** met wijzigingen aan `schema.sql`: voer het script opnieuw uit
in de SQL Editor (het bewaart bestaande gegevens). Laatste wijziging: de kluis voor je klassen
(`leerkracht_kluis`, `kluis_lees`, `kluis_schrijf`); daarvoor bijnamen, het spel verlaten en
`live_ping`.

**Klassen op al je toestellen (kluis)**: op de pagina *Klassen* kies je een kluiscode. Je
klassen worden in de browser versleuteld; in de tabel `leerkracht_kluis` staat enkel onleesbare
tekst. Emoji-reacties gebruiken Supabase Realtime (broadcast) en worden niet bewaard.

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
  2 dagen worden automatisch gewist. De resultaten blijven bewaard op de laptop van de leerkracht
  (Resultaten → Excel).
- **Beveiliging**: leerlingen zien enkel hun eigen antwoorden, kunnen niets wijzigen en zien het
  juiste antwoord pas wanneer de leerkracht het toont. De tijd per antwoord wordt door de
  server gemeten. Dit alles wordt automatisch getest (`tests/schema.test.ts`).
- **Van laptop wisselen**: de naam van een leerling is gekoppeld aan de laptop. Wisselt een
  leerling van laptop, beweeg dan in de wachtruimte/vraag met de muis over de naam en klik op ✕
  (loskoppelen). De leerling kan daarna opnieuw de naam kiezen en behoudt de punten.
