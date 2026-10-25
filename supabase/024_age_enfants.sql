-- Age(s) des enfants (siege auto / rehausseur), saisi(s) par le client et affiche(s) au chauffeur.
-- A executer dans Supabase > SQL Editor, apres 023_paiement_compte.sql.

alter table rides add column child_ages text;
