-- Synchronisation Google Agenda du proprietaire : jeton de connexion (jamais lisible depuis les apps) et lien course <-> evenement.
create table if not exists gcal_connection (
  id boolean primary key default true check (id),
  refresh_token text not null,
  calendar_id text not null default 'primary',
  google_email text,
  driver_id uuid references profiles(id) on delete set null,
  connected_at timestamptz not null default now()
);
alter table gcal_connection enable row level security; -- aucune regle : seul le serveur (cle de service) y accede
alter table rides add column if not exists gcal_event_id text, add column if not exists gcal_hash text;
