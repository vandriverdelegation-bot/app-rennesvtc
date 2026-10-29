-- Le role d'un nouveau compte ne doit plus venir de user_metadata (modifiable par n'importe quel visiteur
-- a l'inscription) mais de app_metadata (reserve au serveur). Sans cela, signUp(... data: { role: 'admin' }) donnait un compte admin.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, coalesce(new.raw_app_meta_data->>'role', 'client'), new.email);
  return new;
end;
$$ language plpgsql security definer;
