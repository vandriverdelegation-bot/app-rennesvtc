-- Une zone a son propre prix au kilometre et son minimum (jour / nuit), au lieu d'un prix fixe.
-- (day_price / night_price restent a 0 : les anciennes versions des apps les lisent.)
alter table pricing_zones add column if not exists price_per_km_day numeric not null default 0;
alter table pricing_zones add column if not exists price_per_km_night numeric not null default 0;
