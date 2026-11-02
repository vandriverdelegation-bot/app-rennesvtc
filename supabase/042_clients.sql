-- Fichier clients (saisie semi-automatique du back-end et de l'app chauffeur).
-- Aucune politique RLS : la table n'est accessible que par le serveur (cle service), qui reserve la recherche a l'admin et aux chauffeurs autorises.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status text not null default 'actif' check (status in ('actif', 'inactif', 'blacklist')),
  rides_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists clients_name_idx on clients (lower(name));
create index if not exists clients_phone_idx on clients (phone);
alter table clients enable row level security;
