-- Tablette d'accueil : nom affiche sur l'image de bienvenue du client (par defaut, le nom du client).
alter table rides add column if not exists welcome_name text;
