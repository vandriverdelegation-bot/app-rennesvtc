-- Adresse qui recoit les alertes admin (nouvelles demandes, devis, dossiers chauffeurs...), reglable dans l'admin.
-- A executer dans Supabase > SQL Editor, apres 034_plusieurs_vehicules.sql.

alter table app_settings add column admin_email text;
