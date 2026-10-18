-- Autorise l'origine 'web' pour une reservation creee depuis le module de
-- reservation web public (sans compte), en plus de client/chauffeur/admin.
-- A executer dans Supabase > SQL Editor, apres 018_apparence.sql.

alter table rides drop constraint rides_created_by_check;
alter table rides add constraint rides_created_by_check
  check (created_by in ('client', 'chauffeur', 'admin', 'web'));
