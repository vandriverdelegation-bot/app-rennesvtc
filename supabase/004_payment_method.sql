-- Mode de reglement choisi par le client (pas de paiement en ligne).
-- A executer dans Supabase > SQL Editor, apres 003_rides_location.sql.

alter table rides
  add column payment_method text not null
    check (payment_method in ('carte_a_bord', 'especes', 'compte'));
