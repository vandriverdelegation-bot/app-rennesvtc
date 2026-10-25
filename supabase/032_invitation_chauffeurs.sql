-- Invitation et candidature des chauffeurs : lien d'invitation, dossier, documents prives, validation par l'admin.
-- A executer dans Supabase > SQL Editor, apres 031_un_vehicule_par_chauffeur.sql.

-- Un chauffeur invite a le role "candidat" tant que l'admin n'a pas valide son dossier
-- (aucun droit du role chauffeur : ni course, ni dispatch, ni connexion a l'app chauffeur).
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('client', 'chauffeur', 'admin', 'candidat'));
alter table profiles add column if not exists address text;

create table driver_invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  vehicle_category text not null check (vehicle_category in ('confort', 'affaires', 'van')),
  driver_role text not null default 'secondaire' check (driver_role in ('principal', 'secondaire')),
  status text not null default 'sent' check (status in ('sent', 'submitted', 'validated', 'refused', 'cancelled')),
  profile_id uuid references profiles(id) on delete set null,
  refusal_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  submitted_at timestamptz,
  validated_at timestamptz
);

create table driver_documents (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references driver_invitations(id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  file_name text,
  created_at timestamptz not null default now()
);

-- Aucune policy : seules les routes du backend (cle de service) lisent et ecrivent ces tables.
alter table driver_invitations enable row level security;
alter table driver_documents enable row level security;

-- Documents des chauffeurs : stockage PRIVE (jamais d'URL publique), 10 Mo max par fichier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-documents', 'driver-documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
