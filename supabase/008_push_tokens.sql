-- Jeton de notification push, mis a jour par chaque app (client et chauffeur).
alter table profiles add column push_token text;
grant update (vehicle_category, push_token) on profiles to authenticated;
