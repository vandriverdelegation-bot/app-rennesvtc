-- Table des courses (reservation simple, sans dispatch automatique ni carte).
-- A executer dans Supabase > SQL Editor, apres 001_profiles.sql.

create table rides (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id),
  driver_id uuid references auth.users(id),
  pickup_address text not null,
  dropoff_address text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table rides enable row level security;

create policy "Un client cree ses courses"
  on rides for insert
  with check (auth.uid() = client_id);

create policy "Un client voit ses courses"
  on rides for select
  using (auth.uid() = client_id);

create policy "Un chauffeur voit les courses en attente et les siennes"
  on rides for select
  using (
    auth.uid() = driver_id
    or (
      status = 'pending'
      and exists (select 1 from profiles where id = auth.uid() and role = 'chauffeur')
    )
  );

create policy "Un chauffeur accepte une course en attente ou met a jour la sienne"
  on rides for update
  using (
    (status = 'pending' and exists (select 1 from profiles where id = auth.uid() and role = 'chauffeur'))
    or auth.uid() = driver_id
  )
  with check (
    auth.uid() = driver_id
  );
