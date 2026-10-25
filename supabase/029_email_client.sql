-- Adresse email du client pour les reservations sans compte (telephone, admin, web).
-- A executer dans Supabase > SQL Editor, apres 028_suivi_reserve_admin.sql.

alter table rides add column client_email text;
