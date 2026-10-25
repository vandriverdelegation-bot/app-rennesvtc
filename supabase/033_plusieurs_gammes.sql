-- Un chauffeur peut etre sur plusieurs gammes (ex. le chauffeur principal sur les trois),
-- et un chauffeur supprime mais avec historique de courses est archive (role "ancien").
-- A executer dans Supabase > SQL Editor, apres 032_invitation_chauffeurs.sql.

alter table profiles add column if not exists vehicle_categories text[];
update profiles set vehicle_categories = array[vehicle_category] where vehicle_category is not null and vehicle_categories is null;

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('client', 'chauffeur', 'admin', 'candidat', 'ancien'));

-- Un chauffeur voit et accepte les courses dispatchees de TOUTES ses gammes.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where tablename = 'rides' and qual ilike '%profiles.vehicle_category%' loop
    execute format(
      'alter policy %I on rides using ((auth.uid() = driver_id) or (status = ''dispatched'' and (dispatched_to is null or dispatched_to = auth.uid()) and vehicle_category = any (select unnest(coalesce(vehicle_categories, array[vehicle_category])) from profiles where id = auth.uid())))',
      p.policyname);
  end loop;
end $$;
