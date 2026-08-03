-- Complete legacy evaluations_niveau_2 tables without deleting existing workshop data.
alter table public.evaluations_niveau_2
  add column if not exists effectif_coges integer,
  add column if not exists existence_prescolaire boolean not null default false,
  add column if not exists effectif_prescolaire integer not null default 0,
  add column if not exists distance_iepp_km numeric not null default 0,
  add column if not exists difficulte_acces text not null default 'facile',
  add column if not exists justification_acces text,
  add column if not exists distance_centre_sante_km numeric not null default 0,
  add column if not exists difficulte_acces_sante text not null default 'facile',
  add column if not exists justification_acces_sante text,
  add column if not exists score_prescolaire integer not null default 0,
  add column if not exists score_effectif_prescolaire integer not null default 0,
  add column if not exists score_distance_iepp integer not null default 1,
  add column if not exists score_acces_coges integer not null default 0,
  add column if not exists score_distance_sante integer not null default 1,
  add column if not exists score_acces_sante integer not null default 0,
  add column if not exists score_total integer not null default 2,
  add column if not exists niveau_priorite text not null default 'Faible priorite',
  add column if not exists statut text not null default 'brouillon',
  add column if not exists commentaire_selection text,
  add column if not exists participants_atelier text,
  add column if not exists saisi_par uuid references public.users(id) on update cascade on delete set null,
  add column if not exists valide_par uuid references public.users(id) on update cascade on delete set null,
  add column if not exists validated_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
