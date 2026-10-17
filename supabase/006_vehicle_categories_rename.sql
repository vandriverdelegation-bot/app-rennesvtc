-- Renomme les 3 gammes de vehicules : confort / affaires / van (au lieu de berline/van/prestige).

alter table profiles drop constraint profiles_vehicle_category_check;
alter table profiles add constraint profiles_vehicle_category_check
  check (vehicle_category in ('confort', 'affaires', 'van'));

alter table rides drop constraint rides_vehicle_category_check;
alter table rides add constraint rides_vehicle_category_check
  check (vehicle_category in ('confort', 'affaires', 'van'));
