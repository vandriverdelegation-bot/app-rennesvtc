-- Plusieurs chauffeurs sur une meme mission : le chauffeur principal (driver_id) gere les etapes, les chauffeurs
-- supplementaires (extra_driver_ids) voient la mission en lecture seule et recoivent le bon de commande.
alter table rides add column if not exists extra_driver_ids uuid[] not null default '{}';

drop policy if exists "Chauffeurs supplementaires lisent leurs missions" on rides;
create policy "Chauffeurs supplementaires lisent leurs missions" on rides
  for select using (auth.uid() = any (extra_driver_ids));
