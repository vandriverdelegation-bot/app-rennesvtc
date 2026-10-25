-- Journal des emails envoyes par le serveur (statut renvoye par Resend), pour diagnostiquer les emails non recus.
-- A executer dans Supabase > SQL Editor, apres 035_email_alertes_admin.sql.

create table email_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  to_email text not null,
  subject text not null,
  status text not null,
  detail text
);
alter table email_log enable row level security; -- aucune policy : lecture reservee au serveur
