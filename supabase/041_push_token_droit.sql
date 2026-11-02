-- Les migrations 012 et 017 ont retire le droit de modifier profiles.push_token (revoke puis grant sans cette colonne) :
-- les apps obtenaient leur jeton mais la base refusait de l'enregistrer, donc aucune notification push.
grant update (vehicle_category, online_status, phone, last_lat, last_lng, push_token) on profiles to authenticated;
