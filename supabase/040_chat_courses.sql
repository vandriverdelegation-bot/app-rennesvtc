-- Chat d'une course entre le chauffeur et le client / donneur d'ordre.
-- Aucune politique RLS : la table n'est accessible que par le serveur (cle service), qui controle les droits.
create table if not exists ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'chauffeur', 'donneur_ordre')),
  sender_id uuid,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists ride_messages_ride_idx on ride_messages (ride_id, created_at);
alter table ride_messages enable row level security;
