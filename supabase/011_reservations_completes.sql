-- Gestion reservations complete : creation depuis l'admin, tags, aller-retour,
-- etape de course detaillee, majoration de prix, origine de la reservation.
-- A executer dans Supabase > SQL Editor, apres 010_tarification_complete.sql.

alter table rides
  add column tags text[] not null default '{}',
  add column round_trip boolean not null default false,
  add column ride_step text not null default 'not_started'
    check (ride_step in ('not_started', 'en_route', 'on_site', 'completed')),
  add column surcharge_amount numeric not null default 0,
  add column surcharge_reason text,
  add column created_by text not null default 'client' check (created_by in ('client', 'chauffeur', 'admin'));

-- Un admin peut creer une reservation directement depuis le back-office
-- (les mises a jour admin sont deja couvertes par la policy existante
-- "Un admin dispatche les courses", qui autorise tout update, pas seulement le dispatch).
create policy "Un admin cree une reservation"
  on rides for insert
  with check (is_admin());
