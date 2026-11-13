-- Navettes, etape 4 (suivi de soiree) : message de changement pour l'invite, et ajout / deplacement / regroupement
-- de passagers par l'admin, en une seule operation sure (aucune surreservation, meme verrou que l'inscription).
alter table navette_signups add column if not exists notice text;  -- ex. « Votre navette a change : nouveau depart a 01h30 », efface quand l'invite l'a lu

-- Ajout d'un passager a la main (n'exige pas que le depart soit ouvert, mais respecte les places).
create or replace function navette_admin_add(p_departure uuid, p_first text, p_last text, p_seats int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dep navette_departures;
  taken int;
  sid uuid;
begin
  select * into dep from navette_departures where id = p_departure for update;
  if not found then return jsonb_build_object('error', 'departure_not_found'); end if;
  if p_seats < 1 or p_seats > 20 then return jsonb_build_object('error', 'bad_seats'); end if;
  select coalesce(sum(seats), 0) into taken from navette_signups where departure_id = p_departure;
  if taken + p_seats > dep.seats then return jsonb_build_object('error', 'full', 'remaining', greatest(dep.seats - taken, 0)); end if;
  insert into navette_signups (departure_id, first_name, last_name, seats) values (p_departure, p_first, p_last, p_seats) returning id into sid;
  return jsonb_build_object('ok', true, 'id', sid, 'remaining', dep.seats - taken - p_seats);
end $$;

-- Deplacement d'un passager vers un autre depart du meme evenement.
create or replace function navette_admin_move(p_signup uuid, p_departure uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  su navette_signups;
  old_dep navette_departures;
  dep navette_departures;
  taken int;
begin
  select * into su from navette_signups where id = p_signup;
  if not found then return jsonb_build_object('error', 'signup_not_found'); end if;
  select * into old_dep from navette_departures where id = su.departure_id;
  select * into dep from navette_departures where id = p_departure and event_id = old_dep.event_id for update;
  if not found then return jsonb_build_object('error', 'departure_not_found'); end if;
  if dep.id = su.departure_id then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  select coalesce(sum(seats), 0) into taken from navette_signups where departure_id = p_departure;
  if taken + su.seats > dep.seats then return jsonb_build_object('error', 'full', 'remaining', greatest(dep.seats - taken, 0)); end if;
  update navette_signups set departure_id = p_departure where id = p_signup;
  return jsonb_build_object('ok', true, 'remaining', dep.seats - taken - su.seats);
end $$;

-- Regroupement : tous les passagers d'un depart vont vers un autre depart (refuse si la place manque).
create or replace function navette_merge(p_from uuid, p_to uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a navette_departures;
  b navette_departures;
  need int;
  taken int;
  n int;
begin
  if p_from = p_to then return jsonb_build_object('error', 'same_departure'); end if;
  perform 1 from navette_departures where id in (p_from, p_to) order by id for update;  -- verrou dans un ordre fixe
  select * into a from navette_departures where id = p_from;
  select * into b from navette_departures where id = p_to;
  if a.id is null or b.id is null or a.event_id <> b.event_id then return jsonb_build_object('error', 'departure_not_found'); end if;
  select coalesce(sum(seats), 0), count(*) into need, n from navette_signups where departure_id = p_from;
  select coalesce(sum(seats), 0) into taken from navette_signups where departure_id = p_to;
  if need + taken > b.seats then return jsonb_build_object('error', 'no_room', 'needed', need, 'remaining', greatest(b.seats - taken, 0)); end if;
  update navette_signups set departure_id = p_to where departure_id = p_from;
  return jsonb_build_object('ok', true, 'moved', n, 'passengers', need);
end $$;

revoke execute on function navette_admin_add(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function navette_admin_move(uuid, uuid) from public, anon, authenticated;
revoke execute on function navette_merge(uuid, uuid) from public, anon, authenticated;
grant execute on function navette_admin_add(uuid, text, text, int) to service_role;
grant execute on function navette_admin_move(uuid, uuid) to service_role;
grant execute on function navette_merge(uuid, uuid) to service_role;
