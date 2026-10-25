-- CGV (texte editable dans l'admin) et trace de l'acceptation des conditions a la reservation web.
-- A executer dans Supabase > SQL Editor, apres 029_email_client.sql.

alter table app_settings add column cgv_text text;
alter table rides add column terms_accepted_at timestamptz;
