-- Reservation refusee par l'administrateur : la course passe en « annulee » et garde la date du refus (badge « Refusee »).
alter table rides add column if not exists refused_at timestamptz;
