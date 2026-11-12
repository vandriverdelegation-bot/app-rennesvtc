-- Navettes evenementielles (mariages, soirees d'entreprise) : evenement, departs, inscriptions des invites.
-- Tables reservees au serveur (cle de service) : aucune politique RLS, donc inaccessibles depuis un navigateur ou une appli.
create table if not exists navette_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- code aleatoire du lien public /navette/{code}
  name text not null,
  type text not null default 'entreprise' check (type in ('mariage', 'entreprise')),
  event_date date not null,                        -- jour de la soiree (les departs apres minuit restent rattaches a ce jour)
  pickup_place text,                               -- lieu de depart
  destination text,
  welcome_message text,                            -- message d'accueil / point de rendez-vous
  logo_url text,
  pin text check (pin is null or pin ~ '^[0-9]{4}$'),
  status text not null default 'ouvert' check (status in ('ouvert', 'ferme', 'termine')),
  close_minutes int not null default 1 check (close_minutes between 0 and 1440),  -- cloture auto avant l'heure du depart
  client_id uuid references clients(id) on delete set null,
  ride_id uuid references rides(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists navette_departures (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references navette_events(id) on delete cascade,
  departs_at timestamptz not null,
  seats int not null check (seats between 1 and 500),
  vehicle_id uuid references vehicles(id) on delete set null,
  driver_id uuid references profiles(id) on delete set null,
  status text not null default 'ouvert' check (status in ('ouvert', 'complet', 'ferme')),
  created_at timestamptz not null default now()
);
create index if not exists navette_departures_event_idx on navette_departures (event_id, departs_at);

create table if not exists navette_signups (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references navette_departures(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  seats int not null default 1 check (seats between 1 and 10),
  phone text,                                      -- visible uniquement dans le back-office
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- jeton secret de l'invite (modifier / annuler)
  boarded boolean not null default false,          -- coche a la montee
  created_at timestamptz not null default now()
);
create index if not exists navette_signups_departure_idx on navette_signups (departure_id);

alter table navette_events enable row level security;
alter table navette_departures enable row level security;
alter table navette_signups enable row level security;
