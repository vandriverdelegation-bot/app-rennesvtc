-- Majorations d evenement (salons...) : un pourcentage par gamme pendant une periode precise.
create table if not exists pricing_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pct_confort numeric not null default 0 check (pct_confort between 0 and 300),
  pct_affaires numeric not null default 0 check (pct_affaires between 0 and 300),
  pct_van numeric not null default 0 check (pct_van between 0 and 300),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table pricing_events enable row level security;
create policy "Tout le monde lit les majorations" on pricing_events for select using (true);
create policy "Un admin gere les majorations" on pricing_events for all using (is_admin()) with check (is_admin());

-- Dimanches et jours feries = tarif de nuit, samedi = tarif de semaine : plus de majorations fixes.
-- (Colonnes gardees a 0 : les anciennes versions des apps les lisent.)
update pricing_simple set day_saturday_surcharge = 0, day_sunday_surcharge = 0, day_holiday_surcharge = 0, night_saturday_surcharge = 0, night_sunday_surcharge = 0, night_holiday_surcharge = 0 where vehicle_category is not null;
update pricing_zones set day_saturday_surcharge = 0, day_sunday_surcharge = 0, day_holiday_surcharge = 0, night_saturday_surcharge = 0, night_sunday_surcharge = 0, night_holiday_surcharge = 0 where vehicle_category is not null;
