-- Couleur d'accent de la page des invites (et du chevalet) de chaque evenement de navette.
-- Format #RRGGBB ; vide = vert Rennes VTC.
alter table navette_events
  add column if not exists accent_color text
  check (accent_color is null or accent_color ~ '^#[0-9A-Fa-f]{6}$');
