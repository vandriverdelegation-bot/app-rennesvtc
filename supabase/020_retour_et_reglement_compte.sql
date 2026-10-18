-- Date et heure du retour pour les reservations aller-retour, et restriction
-- du mode de reglement "en compte" aux reservations creees depuis le back-office admin.
-- A executer dans Supabase > SQL Editor, apres 019_reservation_web.sql.

alter table rides add column return_scheduled_at timestamptz;

drop policy "Un client cree ses courses" on rides;
create policy "Un client cree ses courses"
  on rides for insert
  with check (auth.uid() = client_id and payment_method <> 'compte');

drop policy "Un chauffeur autorise cree une reservation telephonique" on rides;
create policy "Un chauffeur autorise cree une reservation telephonique"
  on rides for insert
  with check (
    auth.uid() = driver_id
    and status = 'accepted'
    and client_id is null
    and payment_method <> 'compte'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'chauffeur' and can_create_rides
    )
  );
