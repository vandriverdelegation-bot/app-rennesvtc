-- Le donneur d'ordre (et donc l'envoi du suivi par email) ne peut etre renseigne que par un admin.
-- Le backend (cle de service, sans utilisateur connecte) reste libre d'ecrire ces champs.
-- A executer dans Supabase > SQL Editor, apres 027_suivi_donneur_ordre.sql.

create or replace function restrict_orderer() returns trigger as $$
begin
  if auth.uid() is not null and not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
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

drop trigger if exists rides_restrict_orderer on rides;
create trigger rides_restrict_orderer
  before insert or update on rides
  for each row execute function restrict_orderer();
