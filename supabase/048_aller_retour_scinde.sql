-- Aller-retour : a la saisie, la reservation est scindee en deux courses distinctes (aller et retour),
-- chacune un trajet simple, avec ses propres etapes, son chauffeur et son lien de suivi.
-- Le retour reprend toutes les donnees de la saisie (client, gamme, paiement, tarif, passagers...),
-- avec depart et arrivee inverses, les arrets dans l'ordre inverse et la date de retour.
alter table rides add column if not exists leg text check (leg in ('aller', 'retour'));
alter table rides add column if not exists linked_ride_id uuid references rides(id) on delete set null;

create or replace function split_round_trip() returns trigger as $$
declare
  v rides;
  return_id uuid := gen_random_uuid();
begin
  if not (new.round_trip and new.return_scheduled_at is not null and coalesce(new.service_type, '') <> 'mise_a_disposition') then
    return null;
  end if;
  v := new;
  v.id := return_id;
  v.created_at := now();
  v.tracking_token := replace(gen_random_uuid()::text, '-', '');
  v.pickup_address := new.dropoff_address;  v.dropoff_address := new.pickup_address;
  v.pickup_lat := new.dropoff_lat;          v.dropoff_lat := new.pickup_lat;
  v.pickup_lng := new.dropoff_lng;          v.dropoff_lng := new.pickup_lng;
  v.stop_addresses := array(select s from unnest(new.stop_addresses) with ordinality as t(s, o) order by o desc);
  v.scheduled_at := new.return_scheduled_at;
  v.return_scheduled_at := null;
  v.round_trip := false;
  v.leg := 'retour';
  v.linked_ride_id := new.id;
  v.ride_step := 'not_started';
  v.step_times := '{}'::jsonb;
  v.driver_lat := null;  v.driver_lng := null;
  v.paid_at := null;  v.reminder_sent_at := null;  v.alert_until := null;  v.declined_by := '{}';
  insert into rides select (v).*;
  update rides set round_trip = false, return_scheduled_at = null, leg = 'aller', linked_ride_id = return_id where id = new.id;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists rides_split_round_trip on rides;
create trigger rides_split_round_trip
  after insert on rides
  for each row execute function split_round_trip();
