-- EROF COGES - Supabase baseline schema
-- This migration defines the application tables, RLS helpers/policies, storage
-- bucket, and the auth trigger used by self-service enqueteur registration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.drenas (
  id text primary key,
  nom text not null unique
);

create table if not exists public.iepps (
  id text primary key,
  nom text not null,
  drena_id text not null references public.drenas(id) on update cascade on delete restrict,
  unique (drena_id, nom)
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nom text not null,
  prenom text not null,
  role text not null default 'enqueteur'
    check (role in ('admin_national', 'superviseur_drena', 'superviseur_iepp', 'enqueteur', 'lecteur')),
  telephone text,
  drena_id text references public.drenas(id) on update cascade on delete set null,
  iepp_id text references public.iepps(id) on update cascade on delete set null,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.etablissements (
  id uuid primary key default gen_random_uuid(),
  nom text,
  code_desps text,
  type_etablissement text
    check (type_etablissement is null or type_etablissement in ('prescolaire', 'primaire', 'groupe_scolaire', 'college', 'lycee')),
  iepp_id text references public.iepps(id) on update cascade on delete restrict,
  localite text,
  statut text
    check (statut is null or statut in ('public', 'prive_laic', 'prive_confessionnel')),
  milieu text
    check (milieu is null or milieu in ('urbain', 'periurbain', 'rural')),
  nombre_classes integer check (nombre_classes is null or nombre_classes >= 0),
  nombre_enseignants integer check (nombre_enseignants is null or nombre_enseignants >= 0),
  cantine boolean,
  date_creation date,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists etablissements_iepp_idx on public.etablissements(iepp_id);
create unique index if not exists etablissements_code_desps_uidx
  on public.etablissements(code_desps)
  where code_desps is not null and code_desps <> '';

create table if not exists public.coges (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id) on update cascade on delete cascade,
  code_coges text,
  date_creation date,
  date_derniere_ag_elective date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coges_etablissement_uidx
  on public.coges(etablissement_id)
  where etablissement_id is not null;

create table if not exists public.campagnes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  annee_scolaire text not null,
  date_debut date not null,
  date_fin date,
  statut text not null default 'fermee' check (statut in ('ouverte', 'fermee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);

create unique index if not exists campagnes_single_open_uidx
  on public.campagnes(statut)
  where statut = 'ouverte';

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid references public.etablissements(id) on update cascade on delete restrict,
  coges_id uuid references public.coges(id) on update cascade on delete restrict,
  campagne_id uuid not null references public.campagnes(id) on update cascade on delete restrict,
  enqueteur_id uuid references public.users(id) on update cascade on delete restrict,
  date_collecte date,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'soumis', 'en_revision', 'valide', 'rejete', 'verrouille')),
  president_nom text,
  president_contact text,
  conseiller_nom text,
  conseiller_contact text,
  conseiller_email text,
  historique_creation text,
  observations_generales text,
  effectif_total integer not null default 0 check (effectif_total >= 0),
  effectif_filles integer not null default 0 check (effectif_filles >= 0),
  effectif_garcons integer not null default 0 check (effectif_garcons >= 0),
  submitted_at timestamptz,
  validated_by uuid references public.users(id) on update cascade on delete set null,
  validated_at timestamptz,
  locked boolean not null default false,
  rejected_reason text,
  supervision_comment text,
  motif_revision text,
  created_by uuid references public.users(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluations_etablissement_idx on public.evaluations(etablissement_id);
create index if not exists evaluations_campagne_idx on public.evaluations(campagne_id);
create index if not exists evaluations_enqueteur_idx on public.evaluations(enqueteur_id);
create index if not exists evaluations_statut_idx on public.evaluations(statut);

create table if not exists public.evaluation_reponses (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  question_code text not null,
  section_num integer not null,
  valeur_numerique numeric,
  valeur_texte text,
  valeur_date date,
  valeur_json jsonb,
  commentaire text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, question_code)
);

create table if not exists public.membres_be (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  nom_prenoms text not null default '',
  genre text not null default 'homme' check (genre in ('homme', 'femme')),
  fonction text not null
    check (fonction in ('president', 'vice_president', 'secretaire_general', 'secretaire_general_adjoint',
                       'tresorier_general', 'tresorier_general_adjoint', 'parent_membre', 'eleve')),
  lit_ecrit_francais boolean not null default false,
  lit_ecrit_langue_locale boolean not null default false,
  niveau_etude text not null default 'aucun'
    check (niveau_etude in ('aucun', 'primaire', 'secondaire_1er_cycle', 'secondaire_2nd_cycle', 'superieur')),
  profession text not null default '',
  formation_coges boolean not null default false,
  module_formation text,
  maitrise_role text not null default 'faible' check (maitrise_role in ('faible', 'moyenne', 'bonne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipes_evaluation (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  nom_prenoms text not null default '',
  fonction_structure text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommandations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null unique references public.evaluations(id) on update cascade on delete cascade,
  forces text not null default '',
  faiblesses text not null default '',
  difficultes text not null default '',
  actions_urgentes text not null default '',
  appuis_attendus text not null default '',
  recommandations_prioritaires text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preuves_documentaires (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  type_preuve text not null,
  statut text not null default 'non_disponible'
    check (statut in ('disponible_consultee', 'disponible_non_consultee', 'declaree_non_presentee', 'non_disponible', 'non_applicable')),
  commentaire text,
  fichier_path text,
  fichier_nom_original text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, type_preuve)
);

create table if not exists public.evaluation_scores (
  id text primary key,
  evaluation_id uuid not null unique references public.evaluations(id) on update cascade on delete cascade,
  score_global numeric not null default 0,
  classification text not null default '',
  taux_disponibilite_preuves numeric not null default 0,
  axes_faibles text[] not null default '{}',
  score_axe1 numeric not null default 0,
  score_axe2 numeric not null default 0,
  score_axe3 numeric not null default 0,
  score_axe4 numeric not null default 0,
  score_axe5 numeric not null default 0,
  score_axe6 numeric not null default 0,
  score_axe7 numeric not null default 0,
  score_axe8 numeric not null default 0,
  score_axe9 numeric not null default 0,
  score_axe10 numeric not null default 0,
  score_axe11 numeric not null default 0,
  score_axe12 numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on update cascade on delete set null,
  action text not null,
  table_cible text not null,
  ligne_id text not null,
  donnees_avant jsonb,
  donnees_apres jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- Utility triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'etablissements', 'coges', 'campagnes', 'evaluations',
    'evaluation_reponses', 'membres_be', 'equipes_evaluation',
    'recommandations', 'preuves_documentaires', 'evaluation_scores'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Auth profile trigger
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user_erof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role text := coalesce(metadata->>'role', 'enqueteur');
begin
  if metadata->>'registration_type' = 'enqueteur' or metadata ? 'role' then
    insert into public.users (
      id,
      email,
      nom,
      prenom,
      role,
      drena_id,
      iepp_id,
      actif
    )
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(metadata->>'nom', ''),
      coalesce(metadata->>'prenom', ''),
      user_role,
      nullif(metadata->>'drena_id', ''),
      nullif(metadata->>'iepp_id', ''),
      true
    )
    on conflict (id) do update set
      email = excluded.email,
      nom = excluded.nom,
      prenom = excluded.prenom,
      role = excluded.role,
      drena_id = excluded.drena_id,
      iepp_id = excluded.iepp_id,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_erof on auth.users;
create trigger on_auth_user_created_erof
after insert on auth.users
for each row execute function public.handle_new_auth_user_erof();

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.actif = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin_national', false)
$$;

create or replace function public.is_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'lecteur', false)
$$;

create or replace function public.try_uuid(raw_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return raw_value::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.user_can_access_iepp(target_iepp_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or public.is_reader()
    or exists (
      select 1
      from public.users u
      join public.iepps i on i.id::text = target_iepp_id
      where u.id = auth.uid()
        and u.actif = true
        and (
          (u.role = 'superviseur_drena' and u.drena_id::text = i.drena_id::text)
          or (u.role = 'superviseur_iepp' and u.iepp_id::text = target_iepp_id)
          or (
            u.role = 'enqueteur'
            and (
              (u.iepp_id is not null and u.iepp_id::text = target_iepp_id)
              or (u.iepp_id is null and u.drena_id::text = i.drena_id::text)
            )
          )
        )
    ),
    false
  )
$$;

create or replace function public.user_can_access_etablissement(target_etablissement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.etablissements e
      where e.id = target_etablissement_id
        and public.user_can_access_iepp(e.iepp_id::text)
    ),
    false
  )
$$;

create or replace function public.user_can_select_evaluation(target_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or public.is_reader()
    or exists (
      select 1
      from public.evaluations ev
      left join public.etablissements e on e.id = ev.etablissement_id
      where ev.id = target_evaluation_id
        and (
          ev.created_by = auth.uid()
          or ev.enqueteur_id = auth.uid()
          or public.user_can_access_iepp(e.iepp_id::text)
        )
    ),
    false
  )
$$;

create or replace function public.user_can_edit_evaluation(target_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.evaluations ev
      left join public.etablissements e on e.id = ev.etablissement_id
      where ev.id = target_evaluation_id
        and ev.locked = false
        and (
          public.is_admin()
          or (
            public.current_user_role() in ('superviseur_drena', 'superviseur_iepp')
            and public.user_can_access_iepp(e.iepp_id::text)
          )
          or (
            (ev.created_by = auth.uid() or ev.enqueteur_id = auth.uid())
            and ev.statut in ('brouillon', 'en_revision')
          )
        )
    ),
    false
  )
$$;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_reader() to anon, authenticated;
grant execute on function public.try_uuid(text) to anon, authenticated;
grant execute on function public.user_can_access_iepp(text) to anon, authenticated;
grant execute on function public.user_can_access_etablissement(uuid) to anon, authenticated;
grant execute on function public.user_can_select_evaluation(uuid) to anon, authenticated;
grant execute on function public.user_can_edit_evaluation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.drenas, public.iepps to anon, authenticated;
grant select on public.campagnes to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.drenas enable row level security;
alter table public.iepps enable row level security;
alter table public.users enable row level security;
alter table public.etablissements enable row level security;
alter table public.coges enable row level security;
alter table public.campagnes enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_reponses enable row level security;
alter table public.membres_be enable row level security;
alter table public.equipes_evaluation enable row level security;
alter table public.recommandations enable row level security;
alter table public.preuves_documentaires enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists drenas_public_select on public.drenas;
create policy drenas_public_select
on public.drenas for select
to anon, authenticated
using (true);

drop policy if exists iepps_public_select on public.iepps;
create policy iepps_public_select
on public.iepps for select
to anon, authenticated
using (true);

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin
on public.users for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists users_admin_insert on public.users;
create policy users_admin_insert
on public.users for insert
to authenticated
with check (public.is_admin());

drop policy if exists users_admin_update on public.users;
create policy users_admin_update
on public.users for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists users_admin_delete on public.users;
create policy users_admin_delete
on public.users for delete
to authenticated
using (public.is_admin());

drop policy if exists campagnes_select_authenticated on public.campagnes;
create policy campagnes_select_authenticated
on public.campagnes for select
to authenticated
using (true);

drop policy if exists campagnes_admin_insert on public.campagnes;
create policy campagnes_admin_insert
on public.campagnes for insert
to authenticated
with check (public.is_admin());

drop policy if exists campagnes_admin_update on public.campagnes;
create policy campagnes_admin_update
on public.campagnes for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists campagnes_admin_delete on public.campagnes;
create policy campagnes_admin_delete
on public.campagnes for delete
to authenticated
using (public.is_admin());

drop policy if exists etablissements_select_scoped on public.etablissements;
create policy etablissements_select_scoped
on public.etablissements for select
to authenticated
using (public.user_can_access_iepp(iepp_id::text));

drop policy if exists etablissements_insert_scoped on public.etablissements;
create policy etablissements_insert_scoped
on public.etablissements for insert
to authenticated
with check (public.user_can_access_iepp(iepp_id::text));

drop policy if exists etablissements_update_scoped on public.etablissements;
create policy etablissements_update_scoped
on public.etablissements for update
to authenticated
using (public.user_can_access_iepp(iepp_id::text))
with check (public.user_can_access_iepp(iepp_id::text));

drop policy if exists coges_select_scoped on public.coges;
create policy coges_select_scoped
on public.coges for select
to authenticated
using (public.user_can_access_etablissement(etablissement_id));

drop policy if exists coges_insert_scoped on public.coges;
create policy coges_insert_scoped
on public.coges for insert
to authenticated
with check (public.user_can_access_etablissement(etablissement_id));

drop policy if exists coges_update_scoped on public.coges;
create policy coges_update_scoped
on public.coges for update
to authenticated
using (public.user_can_access_etablissement(etablissement_id))
with check (public.user_can_access_etablissement(etablissement_id));

drop policy if exists evaluations_select_scoped on public.evaluations;
create policy evaluations_select_scoped
on public.evaluations for select
to authenticated
using (public.user_can_select_evaluation(id));

drop policy if exists evaluations_insert_owner_scoped on public.evaluations;
create policy evaluations_insert_owner_scoped
on public.evaluations for insert
to authenticated
with check (
  (created_by = auth.uid() or enqueteur_id = auth.uid() or public.is_admin())
  and public.user_can_access_etablissement(etablissement_id)
);

drop policy if exists evaluations_update_editable on public.evaluations;
create policy evaluations_update_editable
on public.evaluations for update
to authenticated
using (public.user_can_edit_evaluation(id))
with check (public.user_can_select_evaluation(id));

drop policy if exists evaluations_delete_admin_or_draft_owner on public.evaluations;
create policy evaluations_delete_admin_or_draft_owner
on public.evaluations for delete
to authenticated
using (
  public.is_admin()
  or (
    (created_by = auth.uid() or enqueteur_id = auth.uid())
    and statut in ('brouillon', 'en_revision')
    and locked = false
  )
);

-- Child tables: visibility follows the parent evaluation; writes require an
-- editable parent evaluation.
drop policy if exists evaluation_reponses_select_parent on public.evaluation_reponses;
create policy evaluation_reponses_select_parent
on public.evaluation_reponses for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists evaluation_reponses_insert_parent on public.evaluation_reponses;
create policy evaluation_reponses_insert_parent
on public.evaluation_reponses for insert to authenticated
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists evaluation_reponses_update_parent on public.evaluation_reponses;
create policy evaluation_reponses_update_parent
on public.evaluation_reponses for update to authenticated
using (public.user_can_edit_evaluation(evaluation_id))
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists evaluation_reponses_delete_parent on public.evaluation_reponses;
create policy evaluation_reponses_delete_parent
on public.evaluation_reponses for delete to authenticated
using (public.user_can_edit_evaluation(evaluation_id));

drop policy if exists membres_be_select_parent on public.membres_be;
create policy membres_be_select_parent
on public.membres_be for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists membres_be_insert_parent on public.membres_be;
create policy membres_be_insert_parent
on public.membres_be for insert to authenticated
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists membres_be_update_parent on public.membres_be;
create policy membres_be_update_parent
on public.membres_be for update to authenticated
using (public.user_can_edit_evaluation(evaluation_id))
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists membres_be_delete_parent on public.membres_be;
create policy membres_be_delete_parent
on public.membres_be for delete to authenticated
using (public.user_can_edit_evaluation(evaluation_id));

drop policy if exists equipes_evaluation_select_parent on public.equipes_evaluation;
create policy equipes_evaluation_select_parent
on public.equipes_evaluation for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists equipes_evaluation_insert_parent on public.equipes_evaluation;
create policy equipes_evaluation_insert_parent
on public.equipes_evaluation for insert to authenticated
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists equipes_evaluation_update_parent on public.equipes_evaluation;
create policy equipes_evaluation_update_parent
on public.equipes_evaluation for update to authenticated
using (public.user_can_edit_evaluation(evaluation_id))
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists equipes_evaluation_delete_parent on public.equipes_evaluation;
create policy equipes_evaluation_delete_parent
on public.equipes_evaluation for delete to authenticated
using (public.user_can_edit_evaluation(evaluation_id));

drop policy if exists recommandations_select_parent on public.recommandations;
create policy recommandations_select_parent
on public.recommandations for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists recommandations_insert_parent on public.recommandations;
create policy recommandations_insert_parent
on public.recommandations for insert to authenticated
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists recommandations_update_parent on public.recommandations;
create policy recommandations_update_parent
on public.recommandations for update to authenticated
using (public.user_can_edit_evaluation(evaluation_id))
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists recommandations_delete_parent on public.recommandations;
create policy recommandations_delete_parent
on public.recommandations for delete to authenticated
using (public.user_can_edit_evaluation(evaluation_id));

drop policy if exists preuves_documentaires_select_parent on public.preuves_documentaires;
create policy preuves_documentaires_select_parent
on public.preuves_documentaires for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists preuves_documentaires_insert_parent on public.preuves_documentaires;
create policy preuves_documentaires_insert_parent
on public.preuves_documentaires for insert to authenticated
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists preuves_documentaires_update_parent on public.preuves_documentaires;
create policy preuves_documentaires_update_parent
on public.preuves_documentaires for update to authenticated
using (public.user_can_edit_evaluation(evaluation_id))
with check (public.user_can_edit_evaluation(evaluation_id));
drop policy if exists preuves_documentaires_delete_parent on public.preuves_documentaires;
create policy preuves_documentaires_delete_parent
on public.preuves_documentaires for delete to authenticated
using (public.user_can_edit_evaluation(evaluation_id));

drop policy if exists evaluation_scores_select_parent on public.evaluation_scores;
create policy evaluation_scores_select_parent
on public.evaluation_scores for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists evaluation_scores_insert_parent on public.evaluation_scores;
create policy evaluation_scores_insert_parent
on public.evaluation_scores for insert to authenticated
with check (public.user_can_select_evaluation(evaluation_id));
drop policy if exists evaluation_scores_update_parent on public.evaluation_scores;
create policy evaluation_scores_update_parent
on public.evaluation_scores for update to authenticated
using (public.user_can_select_evaluation(evaluation_id))
with check (public.user_can_select_evaluation(evaluation_id));
drop policy if exists evaluation_scores_delete_admin on public.evaluation_scores;
create policy evaluation_scores_delete_admin
on public.evaluation_scores for delete to authenticated
using (public.is_admin());

drop policy if exists audit_logs_insert_own on public.audit_logs;
create policy audit_logs_insert_own
on public.audit_logs for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'preuves-erof',
  'preuves-erof',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists preuves_erof_select_scoped on storage.objects;
create policy preuves_erof_select_scoped
on storage.objects for select
to authenticated
using (
  bucket_id = 'preuves-erof'
  and public.user_can_select_evaluation(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists preuves_erof_insert_scoped on storage.objects;
create policy preuves_erof_insert_scoped
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'preuves-erof'
  and public.user_can_edit_evaluation(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists preuves_erof_update_scoped on storage.objects;
create policy preuves_erof_update_scoped
on storage.objects for update
to authenticated
using (
  bucket_id = 'preuves-erof'
  and public.user_can_edit_evaluation(public.try_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'preuves-erof'
  and public.user_can_edit_evaluation(public.try_uuid((storage.foldername(name))[1]))
);

drop policy if exists preuves_erof_delete_scoped on storage.objects;
create policy preuves_erof_delete_scoped
on storage.objects for delete
to authenticated
using (
  bucket_id = 'preuves-erof'
  and public.user_can_edit_evaluation(public.try_uuid((storage.foldername(name))[1]))
);
