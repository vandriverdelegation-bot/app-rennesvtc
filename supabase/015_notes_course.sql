-- Note du client et note pour le chauffeur sur une reservation,
-- pour la fiche detaillee a onglets de l'admin.
-- A executer dans Supabase > SQL Editor, apres 014_photos_vehicules.sql.

alter table rides
  add column client_note text,
  add column driver_note text;
