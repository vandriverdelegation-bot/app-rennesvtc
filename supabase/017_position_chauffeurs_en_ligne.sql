-- Derniere position connue d'un chauffeur en ligne (hors course), pour que
-- la Carte interactive affiche aussi les chauffeurs disponibles et pas
-- seulement ceux en course. Mise a jour periodique par l'app chauffeur.
-- A executer dans Supabase > SQL Editor, apres 016_zones_tarification_complete.sql.

alter table profiles
  add column last_lat double precision,
  add column last_lng double precision;

revoke update on table profiles from authenticated;
grant update (vehicle_category, online_status, phone, last_lat, last_lng) on profiles to authenticated;
