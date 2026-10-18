-- Disponibilites (statut en ligne/hors ligne + agenda hebdo par chauffeur)
-- et donnees pour la page Calendrier admin.
-- A executer dans Supabase > SQL Editor, apres 011_reservations_completes.sql.

alter table profiles
  add column online_status boolean not null default false,
  add column phone text;

-- Un chauffeur peut desormais mettre a jour son statut en ligne et son telephone
-- (en plus de sa gamme de vehicule, deja autorisee depuis 005_dispatch.sql).
revoke update on table profiles from authenticated;
grant update (vehicle_category, online_status, phone) on profiles to authenticated;

create table driver_availability (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = dimanche
  start_time time not null,
  end_time time not null,
  unique (driver_id, day_of_week)
);

alter table driver_availability enable row level security;

create policy "Un chauffeur gere ses propres disponibilites"
  on driver_availability for all
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

create policy "Un admin lit toutes les disponibilites"
  on driver_availability for select
  using (is_admin());
