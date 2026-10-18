-- Gestion detaillee de la flotte de vehicules (plaque, couleur, capacite,
-- options, assignation a un chauffeur), en remplacement de la simple
-- gamme fixe par chauffeur.
-- A executer dans Supabase > SQL Editor, apres 012_disponibilites_calendrier.sql.

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references profiles(id) on delete set null, -- FK vers profiles (pas auth.users) pour permettre l'embed PostgREST vehicles->profiles
  vehicle_category text not null check (vehicle_category in ('confort', 'affaires', 'van')),
  display_name text not null,
  plate text,
  color text,
  seats integer not null default 4,
  bags_s integer not null default 0,
  bags_m integer not null default 0,
  bags_l integer not null default 0,
  options text[] not null default '{}',
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table vehicles enable row level security;

create policy "Tout le monde lit les vehicules actifs" on vehicles for select using (active or is_admin());
create policy "Un admin gere les vehicules" on vehicles for all using (is_admin()) with check (is_admin());
