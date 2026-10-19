-- Champs legaux pour generer le bon de commande (billet collectif) envoye
-- au chauffeur a l'acceptation d'une course.
-- A executer dans Supabase > SQL Editor, apres 020_retour_et_reglement_compte.sql.

alter table app_settings
  add column company_legal_name text,
  add column company_siret text,
  add column company_address text;

alter table profiles
  add column full_name text,
  add column vtc_card_number text,
  add column siret text;
