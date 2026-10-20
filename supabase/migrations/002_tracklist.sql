-- Liste des titres de chaque album (donnée Discogs libre de droits, CC0) : étiquettes de K7 et rabat de jaquette.
alter table public.releases add column if not exists tracklist jsonb not null default '[]'::jsonb;
