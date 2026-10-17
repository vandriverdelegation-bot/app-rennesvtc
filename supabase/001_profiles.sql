-- Table des profils : associe un role (client/chauffeur) a chaque compte.
-- A executer une fois dans Supabase > SQL Editor.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'chauffeur')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Un utilisateur voit son propre profil"
  on profiles for select
  using (auth.uid() = id);

-- Cree automatiquement un profil a chaque creation de compte.
-- role par defaut 'client' (inscription libre depuis l'app) ;
-- le backend admin passe role='chauffeur' dans les metadata a la creation.
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'client'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
