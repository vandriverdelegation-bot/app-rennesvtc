-- Tarification complete du trajet simple, fidele a l'ancien back-office :
-- tarif de nuit, majorations samedi/dimanche/ferie, supplements (passager,
-- siege auto, rehausseur, point d'arret), mode Manuel, et tarifs par zone.
-- A executer dans Supabase > SQL Editor, apres 009_chauffeur_roles_et_creation_manuelle.sql.

alter table pricing_simple
  add column night_start time,
  add column night_end time,
  add column base_price_night numeric,
  add column price_per_km_night numeric,
  add column min_price_night numeric,
  add column saturday_surcharge numeric not null default 0,
  add column sunday_surcharge numeric not null default 0,
  add column holiday_surcharge numeric not null default 0,
  add column price_per_passenger numeric not null default 0,
  add column passenger_threshold integer not null default 0,
  add column child_seat_price numeric not null default 0,
  add column booster_seat_price numeric not null default 0,
  add column stop_price numeric not null default 0,
  add column pickup_fee numeric not null default 0,
  add column manual_mode boolean not null default false,
  add column zone_pricing_pickup boolean not null default false,
  add column zone_pricing_dropoff boolean not null default false;

-- Zones de tarif fixe (rayon en km autour d'un point), par gamme.
create table pricing_zones (
  id uuid primary key default gen_random_uuid(),
  vehicle_category text not null check (vehicle_category in ('confort', 'affaires', 'van')),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_km numeric not null,
  price numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table pricing_zones enable row level security;
create policy "Tout le monde lit les zones de tarif" on pricing_zones for select using (active or is_admin());
create policy "Un admin gere les zones de tarif" on pricing_zones for all using (is_admin()) with check (is_admin());

-- Donnees necessaires au calcul des supplements et aux points d'arret multiples.
alter table rides
  add column passenger_count integer not null default 1,
  add column child_seats integer not null default 0,
  add column booster_seats integer not null default 0,
  add column stop_addresses text[] not null default '{}',
  alter column price drop not null; -- le mode Manuel n'a pas de prix tant que le chauffeur ne l'a pas fixe
