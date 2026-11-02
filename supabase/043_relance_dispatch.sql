-- Relance du dispatch : tant que alert_until est dans le futur et que la course est en dispatch, le serveur renvoie la notification chaque minute.
-- declined_by : chauffeurs qui ont refuse la course (ils ne sont plus relances et ne la voient plus).
alter table rides add column if not exists alert_until timestamptz;
alter table rides add column if not exists declined_by uuid[] not null default '{}';
