-- Coordonnees GPS pour la carte et le suivi temps reel.
-- A executer dans Supabase > SQL Editor, apres 002_rides.sql.
-- Pas de nouvelle policy necessaire : les policies existantes sur "rides"
-- couvrent deja la lecture/mise a jour de ces colonnes.

alter table rides
  add column pickup_lat double precision,
  add column pickup_lng double precision,
  add column dropoff_lat double precision,
  add column dropoff_lng double precision,
  add column driver_lat double precision,
  add column driver_lng double precision;
