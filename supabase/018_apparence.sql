-- Parametres d'apparence/identite de l'app, configurables depuis l'admin :
-- nom, logo, couleur d'accent, description, contact, reseaux sociaux,
-- numero de support, CGU. Ligne unique (singleton).
-- A executer dans Supabase > SQL Editor, apres 017_position_chauffeurs_en_ligne.sql.

create table app_settings (
  id boolean primary key default true check (id),
  app_name text not null default 'Rennes VTC',
  logo_url text,
  accent_color text not null default '#47C415',
  accent_contrast text not null default 'black' check (accent_contrast in ('black', 'white')),
  description text,
  contact_email text,
  contact_phone text,
  contact_website text,
  facebook_url text,
  instagram_url text,
  x_url text,
  tiktok_url text,
  linkedin_url text,
  youtube_url text,
  support_phone text,
  support_phone_visible boolean not null default false,
  cgu_text text,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (true);

alter table app_settings enable row level security;

create policy "Tout le monde lit les parametres d'apparence"
  on app_settings for select
  using (true);

create policy "Un admin modifie les parametres d'apparence"
  on app_settings for update
  using (is_admin())
  with check (is_admin());

-- Bucket pour le logo (meme principe que vehicle-photos).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "Lecture publique du logo"
  on storage.objects for select
  using (bucket_id = 'branding');

create policy "Un admin modifie le logo"
  on storage.objects for insert
  with check (bucket_id = 'branding' and is_admin());

create policy "Un admin supprime le logo"
  on storage.objects for delete
  using (bucket_id = 'branding' and is_admin());
