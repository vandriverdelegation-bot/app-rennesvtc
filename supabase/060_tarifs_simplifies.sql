-- Tarification simplifiee : plus de supplement passagers / sieges / rehausseurs / point d'arret / prise en charge fixe
-- (les arrets sont comptes dans le kilometrage). Les colonnes restent en base (les anciennes versions des apps les lisent)
-- mais sont mises a 0 pour qu'elles n'ajoutent plus rien au prix.
update pricing_simple set price_per_passenger = 0, passenger_threshold = 0, child_seat_price = 0, booster_seat_price = 0, stop_price = 0, pickup_fee = 0;

-- Une zone est la meme pour les trois gammes : une ligne par gamme, regroupees par zone_group
-- (nom, position, rayon et supplement de prise en charge sont identiques dans le groupe).
alter table pricing_zones add column if not exists zone_group uuid not null default gen_random_uuid();
update pricing_zones set price_per_passenger = 0, passenger_threshold = 0;
