-- Le proprietaire (chauffeur marque "is_owner") dispose aussi des droits d'administrateur :
-- un seul compte peut etre a la fois chauffeur et administrateur. Toutes les policies passent par is_admin().
-- A executer dans Supabase > SQL Editor, apres 037_proprietaire.sql.

create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or is_owner));
$$ language sql security definer stable;

create or replace function restrict_orderer() returns trigger as $$
begin
  if auth.uid() is not null and not exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or is_owner)) then
    if tg_op = 'INSERT' then
      new.orderer_name := null;
      new.orderer_email := null;
      new.orderer_phone := null;
    else
      new.orderer_name := old.orderer_name;
      new.orderer_email := old.orderer_email;
      new.orderer_phone := old.orderer_phone;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

update profiles set is_owner = true where email = 'contact@rennesvtc.com' and role = 'chauffeur';
