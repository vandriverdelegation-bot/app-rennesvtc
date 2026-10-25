-- Suivi de mission pour un donneur d'ordre (hotel, entreprise) : lien de suivi unique par course,
-- coordonnees du donneur d'ordre et horodatage de chaque etape.
-- A executer dans Supabase > SQL Editor, apres 026_dispatch_auto.sql.

alter table rides
  add column tracking_token text unique default replace(gen_random_uuid()::text, '-', ''),
  add column orderer_name text,
  add column orderer_email text,
  add column orderer_phone text,
  add column step_times jsonb not null default '{}'::jsonb;

-- Date et heure de chaque etape (acceptee, en route, sur place, terminee), pour la page de suivi.
create or replace function stamp_step_times() returns trigger as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.step_times := coalesce(new.step_times, '{}'::jsonb) || jsonb_build_object('accepted', now());
  end if;
  if new.ride_step is distinct from old.ride_step and new.ride_step is not null and new.ride_step <> 'not_started' then
    new.step_times := coalesce(new.step_times, '{}'::jsonb) || jsonb_build_object(new.ride_step, now());
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists rides_stamp_step_times on rides;
create trigger rides_stamp_step_times
  before update on rides
  for each row execute function stamp_step_times();
