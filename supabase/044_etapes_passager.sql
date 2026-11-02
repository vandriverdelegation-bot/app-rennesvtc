-- Deux etapes de plus dans le deroule d'une course : « passager a bord » (on_board) et « passager depose » (dropped).
alter table rides drop constraint if exists rides_ride_step_check;
alter table rides add constraint rides_ride_step_check
  check (ride_step in ('not_started', 'en_route', 'on_site', 'on_board', 'dropped', 'completed'));

-- La position du chauffeur reste visible tant que le passager est a bord, puis est effacee une fois depose.
create or replace function hide_driver_position() returns trigger as $$
begin
  if coalesce(new.ride_step, 'not_started') not in ('en_route', 'on_site', 'on_board') then
    new.driver_lat := null;
    new.driver_lng := null;
  end if;
  return new;
end;
$$ language plpgsql;
