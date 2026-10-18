-- Roles/permissions par chauffeur (Principal/Secondaire) + creation de reservation
-- telephonique depuis l'app chauffeur (sans compte client, prix auto-calcule).
-- A executer dans Supabase > SQL Editor, apres 008_push_tokens.sql.

alter table profiles
  add column driver_role text check (driver_role in ('principal', 'secondaire')),
  add column can_create_rides boolean not null default false,
  add column can_edit_price boolean not null default false;

alter table rides
  alter column client_id drop not null,
  add column client_name text,
  add column client_phone text,
  add column scheduled_at timestamptz,
  add constraint rides_client_identifie check (client_id is not null or (client_name is not null and client_phone is not null));

-- Un chauffeur autorise cree une reservation telephonique, directement assignee a lui-meme.
create policy "Un chauffeur autorise cree une reservation telephonique"
  on rides for insert
  with check (
    auth.uid() = driver_id
    and status = 'accepted'
    and client_id is null
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'chauffeur' and can_create_rides
    )
  );
