-- Profil "proprietaire" : un chauffeur qui recoit aussi les alertes admin (push) et voit le lien vers le back-office.
-- Seul un admin peut le definir (les chauffeurs n'ont le droit de modifier que quelques colonnes de leur profil).
-- A executer dans Supabase > SQL Editor, apres 036_journal_emails.sql.

alter table profiles add column if not exists is_owner boolean not null default false;
update app_settings set admin_email = 'rennesvtc@gmail.com' where id = true;
