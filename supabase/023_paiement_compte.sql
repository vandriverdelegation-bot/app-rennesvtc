-- Suivi du reglement des courses "en compte" : date de paiement renseignee par l'admin.
-- A executer dans Supabase > SQL Editor, apres 022_bagages.sql.

alter table rides add column paid_at timestamptz;
