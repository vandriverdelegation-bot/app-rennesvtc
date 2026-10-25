-- Un chauffeur ne peut etre assigne qu'a un seul vehicule (plusieurs chauffeurs peuvent partager une gamme).
-- A executer dans Supabase > SQL Editor, apres 030_cgv.sql.

create unique index if not exists vehicles_un_chauffeur_un_vehicule on vehicles (driver_id) where driver_id is not null;
