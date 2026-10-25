-- Dispatch automatique des courses (reglage dans l'admin, Tableau de bord).
-- A executer dans Supabase > SQL Editor, apres 025_position_chauffeur_privee.sql.

alter table app_settings
  add column auto_dispatch_enabled boolean not null default false,
  add column auto_dispatch_delay_minutes integer not null default 0;
