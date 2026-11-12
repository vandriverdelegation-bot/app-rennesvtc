-- Navettes : troisieme type d'evenement « evenement » (en plus de mariage et entreprise).
alter table navette_events drop constraint if exists navette_events_type_check;
alter table navette_events add constraint navette_events_type_check check (type in ('mariage', 'entreprise', 'evenement'));
