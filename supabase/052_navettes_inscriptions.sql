-- Navettes, etape 2 (page invite) : nombre de places maximum par inscription, appareil de l'invite,
-- et inscription / changement de depart en une seule operation sure (aucune surreservation).
alter table navette_events add column if not exists max_party int not null default 4 check (max_party between 1 and 10);
alter table navette_signups add column if not exists device text;  -- identifiant aleatoire garde dans le navigateur de l'invite (anti-abus)
create index if not exists navette_signups_device_idx on navette_signups (device);

-- Inscription. La ligne du depart est verrouillee pendant le calcul des places : deux personnes sur la derniere place
-- = une seule reussit, l'autre recoit l'erreur « full ».
create or replace function navette_signup(p_event uuid, p_departure uuid, p_first text, p_last text, p_seats int, p_phone text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev navette_events;
  dep navette_departures;
  taken int;
  mine int;
  sid uuid;
  tok text;
begin
  select * into dep from navette_departures where id = p_departure and event_id = p_event for update;
  if not found then return jsonb_build_object('error', 'departure_not_found'); end if;
  select * into ev from navette_events where id = p_event;
  if ev.status <> 'ouvert' then return jsonb_build_object('error', 'event_closed'); end if;
  if dep.status = 'ferme' or now() >= dep.departs_at - make_interval(mins => ev.close_minutes) then
    return jsonb_build_object('error', 'departure_closed');
  end if;
  if p_seats < 1 or p_seats > ev.max_party then return jsonb_build_object('error', 'bad_seats', 'max', ev.max_party); end if;
  if p_device is not null then
    select count(*) into mine from navette_signups s join navette_departures d on d.id = s.departure_id where d.event_id = p_event and s.device = p_device;
    if mine >= 4 then return jsonb_build_object('error', 'device_limit'); end if;
  end if;
  select coalesce(sum(seats), 0) into taken from navette_signups where departure_id = p_departure;
  if dep.status = 'complet' or taken + p_seats > dep.seats then
    return jsonb_build_object('error', 'full', 'remaining', greatest(case when dep.status = 'complet' then 0 else dep.seats - taken end, 0));
  end if;
  insert into navette_signups (departure_id, first_name, last_name, seats, phone, device)
  values (p_departure, p_first, p_last, p_seats, p_phone, p_device) returning id, token into sid, tok;
  return jsonb_build_object('ok', true, 'id', sid, 'token', tok, 'remaining', dep.seats - taken - p_seats);
end $$;

-- Changement de depart (et/ou du nombre de places) d'une inscription existante, avec le meme verrou.
create or replace function navette_move(p_event uuid, p_token text, p_departure uuid, p_seats int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev navette_events;
  dep navette_departures;
  su navette_signups;
  taken int;
begin
  select s.* into su from navette_signups s join navette_departures d on d.id = s.departure_id where s.token = p_token and d.event_id = p_event;
  if not found then return jsonb_build_object('error', 'signup_not_found'); end if;
  select * into dep from navette_departures where id = p_departure and event_id = p_event for update;
  if not found then return jsonb_build_object('error', 'departure_not_found'); end if;
  select * into ev from navette_events where id = p_event;
  if ev.status <> 'ouvert' then return jsonb_build_object('error', 'event_closed'); end if;
  if dep.status = 'ferme' or now() >= dep.departs_at - make_interval(mins => ev.close_minutes) then
    return jsonb_build_object('error', 'departure_closed');
  end if;
  if p_seats < 1 or p_seats > ev.max_party then return jsonb_build_object('error', 'bad_seats', 'max', ev.max_party); end if;
  select coalesce(sum(seats), 0) into taken from navette_signups where departure_id = p_departure and id <> su.id;
  if dep.status = 'complet' or taken + p_seats > dep.seats then
    return jsonb_build_object('error', 'full', 'remaining', greatest(case when dep.status = 'complet' then 0 else dep.seats - taken end, 0));
  end if;
  update navette_signups set departure_id = p_departure, seats = p_seats where id = su.id;
  return jsonb_build_object('ok', true, 'id', su.id, 'token', su.token, 'remaining', dep.seats - taken - p_seats);
end $$;

-- Ces fonctions ne doivent etre appelables que par le serveur (pas depuis un navigateur avec la cle publique).
revoke execute on function navette_signup(uuid, uuid, text, text, int, text, text) from public, anon, authenticated;
revoke execute on function navette_move(uuid, text, uuid, int) from public, anon, authenticated;
grant execute on function navette_signup(uuid, uuid, text, text, int, text, text) to service_role;
grant execute on function navette_move(uuid, text, uuid, int) to service_role;
