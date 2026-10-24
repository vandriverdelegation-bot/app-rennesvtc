-- Nombre de bagages declares par le client, affiche au chauffeur apres acceptation.
-- A executer dans Supabase > SQL Editor, apres 021_bon_commande.sql.

alter table rides add column luggage_count integer not null default 0;
