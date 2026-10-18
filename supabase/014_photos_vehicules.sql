-- Bucket de stockage pour les photos de vehicules (upload direct depuis l'admin).
-- A executer dans Supabase > SQL Editor, apres 013_vehicules_detailles.sql.

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

create policy "Lecture publique des photos de vehicules"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Un admin ajoute des photos de vehicules"
  on storage.objects for insert
  with check (bucket_id = 'vehicle-photos' and is_admin());

create policy "Un admin supprime des photos de vehicules"
  on storage.objects for delete
  using (bucket_id = 'vehicle-photos' and is_admin());
