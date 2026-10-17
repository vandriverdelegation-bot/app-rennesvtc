-- Tarification simplifiee : trajet simple (base + km), mise a disposition (par heure), forfaits (prix fixe).
-- A executer dans Supabase > SQL Editor, apres 006_vehicle_categories_rename.sql.

create table pricing_simple (
  vehicle_category text primary key check (vehicle_category in ('confort', 'affaires', 'van')),
  base_price numeric not null,
  price_per_km numeric not null,
  min_price numeric not null
);

create table pricing_hourly (
  vehicle_category text primary key check (vehicle_category in ('confort', 'affaires', 'van')),
  price_per_hour numeric not null,
  min_hours numeric not null
);

create table forfaits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_category text not null check (vehicle_category in ('confort', 'affaires', 'van')),
  price numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table pricing_simple enable row level security;
alter table pricing_hourly enable row level security;
alter table forfaits enable row level security;

-- Les tarifs ne sont pas sensibles : tout le monde peut les lire (clients et chauffeurs en ont besoin).
create policy "Tout le monde lit les tarifs trajet simple" on pricing_simple for select using (true);
create policy "Tout le monde lit les tarifs mise a disposition" on pricing_hourly for select using (true);
create policy "Tout le monde lit les forfaits actifs" on forfaits for select using (active or is_admin());

create policy "Un admin gere les tarifs trajet simple" on pricing_simple for all using (is_admin()) with check (is_admin());
create policy "Un admin gere les tarifs mise a disposition" on pricing_hourly for all using (is_admin()) with check (is_admin());
create policy "Un admin gere les forfaits" on forfaits for all using (is_admin()) with check (is_admin());

-- La course porte desormais le type de service choisi et le prix convenu.
alter table rides
  add column service_type text not null check (service_type in ('trajet_simple', 'mise_a_disposition', 'forfait')),
  add column price numeric not null,
  add column duration_hours numeric,
  add column forfait_id uuid references forfaits(id);
