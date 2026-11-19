-- Note du client en fin de course (1 a 5 etoiles), donnee dans l'appli puis propose sur Google.
alter table rides
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists rated_at timestamptz;
