-- EROF COGES - minimal seed data for a fresh Supabase project.
-- This seed is intentionally small: it makes registration and first evaluation
-- tests possible without pretending to be the official national referential.

insert into public.drenas (id, nom) values
  ('drena_agboville', 'AGBOVILLE'),
  ('drena_daloa', 'DALOA'),
  ('drena_tiassale', 'TIASSALE'),
  ('drena_guiglo', 'GUIGLO'),
  ('drena_duekoue', 'DUEKOUE'),
  ('drena_minignan', 'MINIGNAN'),
  ('drena_odienne', 'ODIENNE'),
  ('drena_touba', 'TOUBA'),
  ('drena_issia', 'ISSIA'),
  ('drena_ferke', 'FERKE'),
  ('drena_man', 'MAN'),
  ('drena_danane', 'DANANE')
on conflict (id) do update set nom = excluded.nom;

insert into public.iepps (id, nom, drena_id) values
  ('iepp_agboville_1', 'IEPP AGBOVILLE 1', 'drena_agboville'),
  ('iepp_daloa_1', 'IEPP DALOA 1', 'drena_daloa'),
  ('iepp_tiassale_1', 'IEPP TIASSALE 1', 'drena_tiassale'),
  ('iepp_guiglo_1', 'IEPP GUIGLO 1', 'drena_guiglo'),
  ('iepp_duekoue_1', 'IEPP DUEKOUE 1', 'drena_duekoue'),
  ('iepp_minignan_1', 'IEPP MINIGNAN 1', 'drena_minignan'),
  ('iepp_odienne_1', 'IEPP ODIENNE 1', 'drena_odienne'),
  ('iepp_touba_1', 'IEPP TOUBA 1', 'drena_touba'),
  ('iepp_issia_1', 'IEPP ISSIA 1', 'drena_issia'),
  ('iepp_ferke_1', 'IEPP FERKE 1', 'drena_ferke'),
  ('iepp_man_1', 'IEPP MAN 1', 'drena_man'),
  ('iepp_danane_1', 'IEPP DANANE 1', 'drena_danane')
on conflict (id) do update set
  nom = excluded.nom,
  drena_id = excluded.drena_id;

update public.campagnes
set statut = 'fermee'
where statut = 'ouverte'
  and id <> '00000000-0000-4000-8000-000000000001';

insert into public.campagnes (
  id,
  nom,
  annee_scolaire,
  date_debut,
  date_fin,
  statut
) values (
  '00000000-0000-4000-8000-000000000001',
  'Campagne pilote EROF COGES',
  '2026-2027',
  '2026-07-13',
  null,
  'ouverte'
)
on conflict (id) do update set
  nom = excluded.nom,
  annee_scolaire = excluded.annee_scolaire,
  date_debut = excluded.date_debut,
  date_fin = excluded.date_fin,
  statut = excluded.statut;

-- First admin user bootstrap:
-- 1. Create a user in Supabase Auth from the dashboard or CLI.
-- 2. Copy its auth.users.id.
-- 3. Run an insert like this with that id:
--
-- insert into public.users (id, email, nom, prenom, role, actif)
-- values ('AUTH_USER_UUID', 'admin@example.ci', 'ADMIN', 'NATIONAL', 'admin_national', true)
-- on conflict (id) do update set role = 'admin_national', actif = true;
