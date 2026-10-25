-- Klasspelen: live spelen
-- Voer dit één keer uit in Supabase: SQL Editor → New query → plakken → Run.
-- Het script mag opnieuw uitgevoerd worden (bestaande tabellen blijven behouden).
--
-- Iedereen (leerkracht en leerlingen) meldt zich anoniem aan (Authentication → Sign In / Providers
-- → "Allow anonymous sign-ins" aanzetten). Er zijn geen wachtwoorden of e-mailadressen nodig.
-- Leerlingen kunnen enkel hun eigen antwoorden zien; het juiste antwoord staat pas in de database
-- wanneer de leerkracht het toont. Sessies ouder dan 2 dagen worden automatisch gewist.

create table if not exists public.live_sessies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host uuid not null default auth.uid(),
  titel text not null,
  -- Namen waaruit leerlingen kiezen (leeg + vrije_naam = zelf een naam typen).
  namen text[] not null default '{}',
  vrije_naam boolean not null default false,
  -- quiz: de leerkracht toont vraag per vraag. escape: elke leerling lost de sloten op in eigen tempo.
  modus text not null default 'quiz' check (modus in ('quiz', 'escape')),
  status text not null default 'lobby' check (status in ('lobby', 'vraag', 'antwoord', 'bezig', 'einde')),
  vraag_nr int not null default -1,
  aantal_vragen int not null default 0,
  -- Huidige vraag zonder antwoord (quiz).
  vraag jsonb,
  -- Alle vragen zonder antwoord (escape room).
  vragen jsonb,
  -- Escape room: seconden wachten na een fout antwoord.
  wachttijd int not null default 0 check (wachttijd >= 0),
  vraag_start timestamptz,
  -- Seconden per vraag (quiz) of voor de hele escape room.
  timer int check (timer is null or timer > 0),
  -- Juiste antwoord + uitleg, pas ingevuld als de leerkracht het toont.
  oplossing jsonb,
  -- Tussenstand: [{naam, punten, juist}], gesorteerd.
  stand jsonb not null default '[]',
  aangemaakt timestamptz not null default now()
);

create table if not exists public.live_spelers (
  id uuid primary key default gen_random_uuid(),
  sessie_id uuid not null references public.live_sessies (id) on delete cascade,
  -- null = losgekoppeld door de leerkracht; de leerling kan zich opnieuw aanmelden.
  uid uuid default auth.uid(),
  naam text not null check (length(naam) between 1 and 60),
  aangemaakt timestamptz not null default now(),
  unique (sessie_id, naam)
);
create index if not exists live_spelers_uid on public.live_spelers (uid);

create table if not exists public.live_antwoorden (
  id uuid primary key default gen_random_uuid(),
  sessie_id uuid not null references public.live_sessies (id) on delete cascade,
  speler_id uuid not null references public.live_spelers (id) on delete cascade,
  -- Escape room: -1 = de eindcode.
  vraag_nr int not null,
  -- Escape room: meerdere pogingen per vraag. Quiz: altijd 1.
  poging int not null default 1,
  antwoord text not null check (length(antwoord) <= 2000),
  tijd_ms int not null,
  juist boolean,
  punten int not null default 0,
  -- Escape room: het cijfer van de code dat de leerling verdient met een juist antwoord.
  beloning text,
  aangemaakt timestamptz not null default now(),
  unique (speler_id, vraag_nr, poging)
);
create index if not exists live_antwoorden_sessie on public.live_antwoorden (sessie_id, vraag_nr);

-- Bijwerken van een oudere installatie (zonder escape room).
alter table public.live_sessies add column if not exists modus text not null default 'quiz';
alter table public.live_sessies add column if not exists vragen jsonb;
alter table public.live_sessies add column if not exists wachttijd int not null default 0;
alter table public.live_sessies drop constraint if exists live_sessies_status_check;
alter table public.live_sessies add constraint live_sessies_status_check check (status in ('lobby', 'vraag', 'antwoord', 'bezig', 'einde'));
alter table public.live_antwoorden add column if not exists poging int not null default 1;
alter table public.live_antwoorden add column if not exists beloning text;
alter table public.live_antwoorden drop constraint if exists live_antwoorden_speler_id_vraag_nr_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'live_antwoorden_speler_id_vraag_nr_poging_key') then
    alter table public.live_antwoorden add constraint live_antwoorden_speler_id_vraag_nr_poging_key unique (speler_id, vraag_nr, poging);
  end if;
end;
$$;

-- ---------- Hulpfuncties (security definer: vermijdt recursie in de policies) ----------

create or replace function public.live_is_host(p_sessie uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from live_sessies where id = p_sessie and host = auth.uid());
$$;

create or replace function public.live_is_speler(p_sessie uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from live_spelers where sessie_id = p_sessie and uid = auth.uid());
$$;

-- security definer: de controle op dubbele codes moet alle sessies zien, niet enkel de eigen.
create or replace function public.live_nieuwe_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  tekens constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(tekens, 1 + floor(random() * length(tekens))::int, 1);
    end loop;
    exit when not exists (select 1 from live_sessies where code = c);
  end loop;
  return c;
end;
$$;

alter table public.live_sessies alter column code set default public.live_nieuwe_code();

-- Oude sessies opruimen telkens er een nieuwe sessie start.
create or replace function public.live_opruimen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from live_sessies where aangemaakt < now() - interval '2 days';
  return new;
end;
$$;

drop trigger if exists live_opruimen on public.live_sessies;
create trigger live_opruimen before insert on public.live_sessies
for each statement execute function public.live_opruimen();

-- ---------- Row level security ----------

alter table public.live_sessies enable row level security;
alter table public.live_spelers enable row level security;
alter table public.live_antwoorden enable row level security;

drop policy if exists sessie_lezen on public.live_sessies;
create policy sessie_lezen on public.live_sessies for select to authenticated
  using (host = auth.uid() or public.live_is_speler(id));
drop policy if exists sessie_maken on public.live_sessies;
create policy sessie_maken on public.live_sessies for insert to authenticated
  with check (host = auth.uid());
drop policy if exists sessie_wijzigen on public.live_sessies;
create policy sessie_wijzigen on public.live_sessies for update to authenticated
  using (host = auth.uid()) with check (host = auth.uid());
drop policy if exists sessie_wissen on public.live_sessies;
create policy sessie_wissen on public.live_sessies for delete to authenticated
  using (host = auth.uid());

drop policy if exists speler_lezen on public.live_spelers;
create policy speler_lezen on public.live_spelers for select to authenticated
  using (uid = auth.uid() or public.live_is_host(sessie_id));
drop policy if exists speler_wijzigen on public.live_spelers;
create policy speler_wijzigen on public.live_spelers for update to authenticated
  using (public.live_is_host(sessie_id)) with check (public.live_is_host(sessie_id));
drop policy if exists speler_wissen on public.live_spelers;
create policy speler_wissen on public.live_spelers for delete to authenticated
  using (public.live_is_host(sessie_id));

drop policy if exists antwoord_lezen on public.live_antwoorden;
create policy antwoord_lezen on public.live_antwoorden for select to authenticated
  using (
    public.live_is_host(sessie_id)
    or exists (select 1 from public.live_spelers s where s.id = speler_id and s.uid = auth.uid())
  );
drop policy if exists antwoord_wijzigen on public.live_antwoorden;
create policy antwoord_wijzigen on public.live_antwoorden for update to authenticated
  using (public.live_is_host(sessie_id)) with check (public.live_is_host(sessie_id));

-- Spelers en antwoorden worden enkel via de functies hieronder toegevoegd.

-- ---------- Functies voor leerlingen ----------

-- Info om aan te sluiten: titel en de namen die nog vrij zijn.
create or replace function public.live_sessie_info(p_code text)
returns table (id uuid, titel text, vrije_namen text[], vrije_naam boolean, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.titel,
    array(
      select n from unnest(s.namen) as n
      where not exists (select 1 from live_spelers p where p.sessie_id = s.id and p.naam = n and p.uid is not null and p.uid <> auth.uid())
      order by n
    ),
    s.vrije_naam, s.status
  from live_sessies s
  where s.code = upper(trim(p_code)) and s.status <> 'einde';
$$;

-- Aansluiten met een naam. Opnieuw aansluiten (bv. na het herladen van de pagina) geeft dezelfde speler terug.
create or replace function public.live_deelnemen(p_code text, p_naam text)
returns table (sessie_id uuid, speler_id uuid, naam text)
language plpgsql security definer set search_path = public as $$
declare
  s live_sessies;
  p live_spelers;
  n text := trim(regexp_replace(p_naam, '\s+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'niet_aangemeld'; end if;
  select * into s from live_sessies where code = upper(trim(p_code));
  if not found then raise exception 'onbekende_code'; end if;
  if s.status = 'einde' then raise exception 'gesloten'; end if;
  if n = '' or length(n) > 60 or (not s.vrije_naam and not (n = any (s.namen))) then
    raise exception 'ongeldige_naam';
  end if;

  select * into p from live_spelers where live_spelers.sessie_id = s.id and live_spelers.naam = n;
  if found then
    if p.uid is not null and p.uid <> auth.uid() then raise exception 'naam_bezet'; end if;
    -- Deze laptop had eventueel al een andere naam in deze sessie: die wordt vrijgegeven.
    update live_spelers set uid = null where live_spelers.sessie_id = s.id and uid = auth.uid() and id <> p.id;
    update live_spelers set uid = auth.uid() where id = p.id;
  else
    update live_spelers set uid = null where live_spelers.sessie_id = s.id and uid = auth.uid();
    insert into live_spelers (sessie_id, uid, naam) values (s.id, auth.uid(), n) returning * into p;
  end if;
  return query select s.id, p.id, p.naam;
end;
$$;

-- Een antwoord geven. Quiz: één keer op de huidige vraag. Escape room: op eender welk slot
-- (of -1 voor de eindcode), opnieuw proberen na een fout antwoord en de wachttijd.
-- De tijd wordt door de server gemeten.
create or replace function public.live_antwoord(p_sessie uuid, p_vraag_nr int, p_antwoord text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s live_sessies;
  p live_spelers;
  laatste live_antwoorden;
  ms int;
begin
  select * into s from live_sessies where id = p_sessie;
  if not found then raise exception 'onbekende_sessie'; end if;
  select * into p from live_spelers where sessie_id = p_sessie and uid = auth.uid();
  if not found then raise exception 'geen_speler'; end if;
  ms := greatest(0, floor(extract(epoch from (now() - s.vraag_start)) * 1000))::int;

  if s.modus = 'escape' then
    if s.status <> 'bezig' or p_vraag_nr < -1 or p_vraag_nr >= s.aantal_vragen then raise exception 'geen_vraag'; end if;
    if s.timer is not null and ms > (s.timer + 2) * 1000 then raise exception 'te_laat'; end if;
    if exists (select 1 from live_antwoorden where speler_id = p.id and vraag_nr = p_vraag_nr and juist) then
      raise exception 'al_opgelost';
    end if;
    select * into laatste from live_antwoorden where speler_id = p.id and vraag_nr = p_vraag_nr order by poging desc limit 1;
    if found and (laatste.juist is null or laatste.aangemaakt + make_interval(secs => s.wachttijd) > now()) then
      raise exception 'wacht';
    end if;
    insert into live_antwoorden (sessie_id, speler_id, vraag_nr, poging, antwoord, tijd_ms)
    values (p_sessie, p.id, p_vraag_nr, coalesce(laatste.poging, 0) + 1, left(p_antwoord, 2000), ms);
    return;
  end if;

  if s.status <> 'vraag' or s.vraag_nr <> p_vraag_nr then raise exception 'geen_vraag'; end if;
  -- 2 seconden speling voor trage verbindingen.
  if s.timer is not null and ms > (s.timer + 2) * 1000 then raise exception 'te_laat'; end if;
  insert into live_antwoorden (sessie_id, speler_id, vraag_nr, antwoord, tijd_ms)
  values (p_sessie, p.id, s.vraag_nr, left(p_antwoord, 2000), ms)
  on conflict (speler_id, vraag_nr, poging) do nothing;
  if not found then raise exception 'al_geantwoord'; end if;
end;
$$;

-- ---------- Functies voor de leerkracht ----------

-- Volgende vraag starten; de starttijd komt van de server.
create or replace function public.live_start_vraag(p_sessie uuid, p_vraag_nr int, p_vraag jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not live_is_host(p_sessie) then raise exception 'geen_host'; end if;
  update live_sessies
  set status = 'vraag', vraag_nr = p_vraag_nr, vraag = p_vraag, vraag_start = now(), oplossing = null
  where id = p_sessie;
end;
$$;

-- Escape room starten; de starttijd komt van de server.
create or replace function public.live_start_escape(p_sessie uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not live_is_host(p_sessie) then raise exception 'geen_host'; end if;
  update live_sessies set status = 'bezig', vraag_start = now() where id = p_sessie and modus = 'escape';
end;
$$;

-- Beoordelingen opslaan: [{"id": "...", "juist": true, "punten": 100, "beloning": "7"}, ...]
create or replace function public.live_beoordeel(p_sessie uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not live_is_host(p_sessie) then raise exception 'geen_host'; end if;
  update live_antwoorden a
  set juist = i.juist, punten = coalesce(i.punten, 0), beloning = i.beloning
  from jsonb_to_recordset(p_items) as i (id uuid, juist boolean, punten int, beloning text)
  where a.id = i.id and a.sessie_id = p_sessie;
end;
$$;

revoke all on function public.live_is_host(uuid), public.live_is_speler(uuid), public.live_nieuwe_code(), public.live_opruimen() from public, anon;
grant execute on function public.live_is_host(uuid), public.live_is_speler(uuid), public.live_nieuwe_code() to authenticated;
revoke all on function public.live_sessie_info(text), public.live_deelnemen(text, text), public.live_antwoord(uuid, int, text),
  public.live_start_vraag(uuid, int, jsonb), public.live_start_escape(uuid), public.live_beoordeel(uuid, jsonb) from public, anon;
grant execute on function public.live_sessie_info(text), public.live_deelnemen(text, text), public.live_antwoord(uuid, int, text),
  public.live_start_vraag(uuid, int, jsonb), public.live_start_escape(uuid), public.live_beoordeel(uuid, jsonb) to authenticated;
grant select, insert, update, delete on public.live_sessies to authenticated;
grant select, update, delete on public.live_spelers, public.live_antwoorden to authenticated;

-- ---------- Realtime ----------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_sessies') then
      alter publication supabase_realtime add table public.live_sessies;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_spelers') then
      alter publication supabase_realtime add table public.live_spelers;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_antwoorden') then
      alter publication supabase_realtime add table public.live_antwoorden;
    end if;
  end if;
end;
$$;
