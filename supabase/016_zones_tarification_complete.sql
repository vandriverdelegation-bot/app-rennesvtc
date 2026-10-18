-- Refonte des zones de tarif : chaque zone a son propre tarif jour/nuit
-- complet (comme la tarification de base), et plus un simple prix fixe.
-- Aucune zone n'existe encore en production, donc la colonne price peut
-- etre remplacee sans migration de donnees.
-- Corrige aussi la tarification de base : les majorations samedi/dimanche/
-- ferie sont en realite distinctes pour le tarif de jour et le tarif de
-- nuit (confirme en reexaminant l'ancien back-office), pas partagees.
-- A executer dans Supabase > SQL Editor, apres 015_notes_course.sql.

alter table pricing_simple
  add column day_saturday_surcharge numeric not null default 0,
  add column day_sunday_surcharge numeric not null default 0,
  add column day_holiday_surcharge numeric not null default 0,
  add column night_saturday_surcharge numeric not null default 0,
  add column night_sunday_surcharge numeric not null default 0,
  add column night_holiday_surcharge numeric not null default 0;

update pricing_simple set
  day_saturday_surcharge = saturday_surcharge,
  day_sunday_surcharge = sunday_surcharge,
  day_holiday_surcharge = holiday_surcharge;

alter table pricing_simple
  drop column saturday_surcharge,
  drop column sunday_surcharge,
  drop column holiday_surcharge;

alter table pricing_zones drop column price;

alter table pricing_zones
  add column day_start time not null default '07:00',
  add column day_end time not null default '19:00',
  add column day_price numeric not null default 0,
  add column day_saturday_surcharge numeric not null default 0,
  add column day_sunday_surcharge numeric not null default 0,
  add column day_holiday_surcharge numeric not null default 0,
  add column night_start time not null default '19:00',
  add column night_end time not null default '07:00',
  add column night_price numeric not null default 0,
  add column night_saturday_surcharge numeric not null default 0,
  add column night_sunday_surcharge numeric not null default 0,
  add column night_holiday_surcharge numeric not null default 0,
  add column min_price_day numeric not null default 0,
  add column min_price_night numeric not null default 0,
  add column price_per_passenger numeric not null default 0,
  add column passenger_threshold integer not null default 0,
  add column pickup_fee numeric not null default 0;
