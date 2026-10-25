-- La position du chauffeur n'est conservee que lorsqu'il est en route ou sur place :
-- avant "Je suis en route", elle est effacee, donc invisible pour le client.
-- A executer dans Supabase > SQL Editor, apres 024_age_enfants.sql.

create or replace function hide_driver_position() returns trigger as $$
begin
  if coalesce(new.ride_step, 'not_started') not in ('en_route', 'on_site') then
    new.driver_lat := null;
    new.driver_lng := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists rides_hide_driver_position on rides;
create trigger rides_hide_driver_position
  before insert or update on rides
  for each row execute function hide_driver_position();

-- Nettoie les positions deja enregistrees.
update rides set driver_lat = null, driver_lng = null
where coalesce(ride_step, 'not_started') not in ('en_route', 'on_site') and driver_lat is not null;
