-- Dispatch manuel par l'admin (pas de geolocalisation) + categorie de vehicule.
-- A executer dans Supabase > SQL Editor, apres 004_payment_method.sql.

-- 1. Role "admin" + infos chauffeur necessaires au dispatch -----------------

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('client', 'chauffeur', 'admin'));

alter table profiles
  add column email text,
  add column vehicle_category text check (vehicle_category in ('berline', 'van', 'prestige'));

update profiles set email = u.email from auth.users u where profiles.id = u.id;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'client'), new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Fonction utilitaire pour eviter la recursion RLS sur profiles.
create function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

create policy "Un admin voit tous les profils"
  on profiles for select
  using (is_admin());

-- Un chauffeur ne peut modifier que sa categorie de vehicule (pas son role).
revoke update on table profiles from authenticated;
grant update (vehicle_category) on profiles to authenticated;

create policy "Un chauffeur modifie sa categorie de vehicule"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2. Dispatch sur les courses -------------------------------------------

alter table rides drop constraint rides_status_check;
alter table rides add constraint rides_status_check
  check (status in ('pending', 'dispatched', 'accepted', 'completed', 'cancelled'));

alter table rides
  add column vehicle_category text not null check (vehicle_category in ('berline', 'van', 'prestige')),
  add column dispatched_to uuid references auth.users(id);

-- Un chauffeur ne voit plus les courses "pending" (reservees a l'admin),
-- seulement celles qui lui ont ete dispatchees (a tous ou a lui precisement).
drop policy "Un chauffeur voit les courses en attente et les siennes" on rides;
drop policy "Un chauffeur accepte une course en attente ou met a jour la sienne" on rides;

create policy "Un chauffeur voit les courses qui lui sont dispatchees ou les siennes"
  on rides for select
  using (
    auth.uid() = driver_id
    or (
      status = 'dispatched'
      and (dispatched_to is null or dispatched_to = auth.uid())
      and vehicle_category = (select vehicle_category from profiles where id = auth.uid())
    )
  );

create policy "Un chauffeur accepte une course dispatchee ou met a jour la sienne"
  on rides for update
  using (
    auth.uid() = driver_id
    or (
      status = 'dispatched'
      and (dispatched_to is null or dispatched_to = auth.uid())
      and vehicle_category = (select vehicle_category from profiles where id = auth.uid())
    )
  )
  with check (auth.uid() = driver_id);

create policy "Un admin voit toutes les courses"
  on rides for select
  using (is_admin());

create policy "Un admin dispatche les courses"
  on rides for update
  using (is_admin())
  with check (is_admin());
