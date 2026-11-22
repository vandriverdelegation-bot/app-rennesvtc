-- 057 : portes de securite (audit du 21/11/2026).
-- 1. Un client ne peut plus fixer lui-meme le statut, le chauffeur ou le prix « verifie » d'une course ; un chauffeur sans droit ne peut plus changer le prix.
-- 2. Un candidat chauffeur (dossier non valide) ne voit ni n'accepte les courses dispatchees.
-- 3. L'adresse e-mail d'alerte de l'admin n'est plus lisible par tout le monde.
-- 4. Les plaques et l'identifiant des chauffeurs ne sont plus lisibles par un visiteur sans compte.
-- A executer dans Supabase > SQL Editor.

alter table rides add column if not exists price_checked boolean not null default true;

create or replace function guard_ride_columns() returns trigger as $$
declare
  me profiles%rowtype;
begin
  if auth.uid() is null then return new; end if; -- serveur (cle de service) : aucune restriction
  select * into me from profiles where id = auth.uid();
  if me.role = 'admin' then return new; end if;

  if tg_op = 'INSERT' then
    if me.role = 'client' then
      -- Course creee directement par un client : toujours « en attente », jamais attribuee, prix a faire verifier par le serveur.
      new.status := 'pending';
      new.driver_id := null;
      new.dispatched_to := null;
      new.extra_driver_ids := '{}';
      new.ride_step := 'not_started';
      new.surcharge_amount := 0;
      new.surcharge_reason := null;
      new.driver_note := null;
      new.created_by := 'client';
      new.rating := null;
      new.rated_at := null;
      new.price_checked := false;
    end if;
    return new;
  end if;

  -- Modification par un chauffeur (ou tout autre compte non admin)
  new.client_id := old.client_id;
  new.tracking_token := old.tracking_token;
  new.created_by := old.created_by;
  new.rating := old.rating;
  new.rated_at := old.rated_at;
  new.price_checked := old.price_checked;
  if new.price is distinct from old.price and not (coalesce(me.can_edit_price, false) or coalesce(me.is_owner, false)) then
    raise exception 'Modification du tarif non autorisee';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists rides_guard_columns on rides;
create trigger rides_guard_columns
  before insert or update on rides
  for each row execute function guard_ride_columns();

-- Candidats : les droits « chauffeur » sur les courses dispatchees demandent le role chauffeur.
drop policy if exists "Un chauffeur voit les courses qui lui sont dispatchees ou les siennes" on rides;
create policy "Un chauffeur voit les courses qui lui sont dispatchees ou les siennes" on rides
  for select using (
    auth.uid() = driver_id
    or (
      status = 'dispatched'
      and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'chauffeur')
      and (dispatched_to is null or dispatched_to = auth.uid())
      and vehicle_category in (select unnest(coalesce(profiles.vehicle_categories, array[profiles.vehicle_category])) from profiles where profiles.id = auth.uid())
    )
  );

drop policy if exists "Un chauffeur accepte une course dispatchee ou met a jour la sienne" on rides;
create policy "Un chauffeur accepte une course dispatchee ou met a jour la sienne" on rides
  for update using (
    auth.uid() = driver_id
    or (
      status = 'dispatched'
      and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'chauffeur')
      and (dispatched_to is null or dispatched_to = auth.uid())
      and vehicle_category in (select unnest(coalesce(profiles.vehicle_categories, array[profiles.vehicle_category])) from profiles where profiles.id = auth.uid())
    )
  ) with check (auth.uid() = driver_id);

-- Adresse d'alerte de l'admin : table reservee aux admins (elle etait lisible par tout le monde dans app_settings).
create table if not exists admin_settings (
  id boolean primary key default true check (id),
  admin_email text
);
alter table admin_settings enable row level security;
drop policy if exists "Un admin gere ses reglages prives" on admin_settings;
create policy "Un admin gere ses reglages prives" on admin_settings for all using (is_admin()) with check (is_admin());
insert into admin_settings (id, admin_email) select true, admin_email from app_settings where id = true on conflict (id) do update set admin_email = excluded.admin_email;
alter table app_settings drop column if exists admin_email;

-- Un visiteur sans compte ne lit plus les plaques ni les identifiants de chauffeurs.
revoke select on vehicles from anon;
grant select (id, vehicle_category, display_name, color, seats, bags_s, bags_m, bags_l, options, photo_url, active, created_at) on vehicles to anon;
