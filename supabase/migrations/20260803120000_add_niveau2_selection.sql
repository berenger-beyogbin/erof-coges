-- Second-level selection of the 15 COGES preselected from validated EROF results.

create table if not exists public.selections_erof (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes(id) on update cascade on delete cascade,
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  rang_erof integer not null check (rang_erof > 0),
  score_erof numeric not null check (score_erof between 0 and 5),
  selectionne_par uuid references public.users(id) on update cascade on delete set null,
  selectionne_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (campagne_id, evaluation_id),
  unique (campagne_id, rang_erof)
);

create index if not exists selections_erof_campagne_idx on public.selections_erof(campagne_id);

create table if not exists public.evaluations_niveau_2 (
  id uuid primary key default gen_random_uuid(),
  selection_erof_id uuid not null unique references public.selections_erof(id) on update cascade on delete cascade,
  effectif_coges integer check (effectif_coges is null or effectif_coges >= 0),
  existence_prescolaire boolean not null default false,
  effectif_prescolaire integer not null default 0 check (effectif_prescolaire >= 0),
  distance_iepp_km numeric not null default 0 check (distance_iepp_km >= 0),
  difficulte_acces text not null default 'facile'
    check (difficulte_acces in ('facile', 'moyennement_difficile', 'difficile', 'tres_difficile')),
  justification_acces text,
  distance_centre_sante_km numeric not null default 0 check (distance_centre_sante_km >= 0),
  difficulte_acces_sante text not null default 'facile'
    check (difficulte_acces_sante in ('facile', 'moyennement_difficile', 'difficile', 'tres_difficile')),
  justification_acces_sante text,
  score_prescolaire integer not null default 0,
  score_effectif_prescolaire integer not null default 0,
  score_distance_iepp integer not null default 1,
  score_acces_coges integer not null default 0,
  score_distance_sante integer not null default 1,
  score_acces_sante integer not null default 0,
  score_total integer not null default 2 check (score_total between 0 and 16),
  niveau_priorite text not null default 'Faible priorite',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'soumis', 'valide')),
  commentaire_selection text,
  participants_atelier text,
  saisi_par uuid references public.users(id) on update cascade on delete set null,
  valide_par uuid references public.users(id) on update cascade on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (existence_prescolaire or effectif_prescolaire = 0),
  check (difficulte_acces_sante not in ('difficile', 'tres_difficile') or length(trim(coalesce(justification_acces_sante, ''))) > 0)
);

create or replace function public.enforce_niveau2_selection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  evaluation_row public.evaluations%rowtype;
begin
  select * into evaluation_row from public.evaluations where id = new.evaluation_id;
  if evaluation_row.id is null or evaluation_row.campagne_id <> new.campagne_id then
    raise exception 'La campagne ne correspond pas a l evaluation EROF.';
  end if;
  if evaluation_row.statut not in ('valide', 'verrouille') then
    raise exception 'Seules les evaluations EROF validees ou verrouillees sont eligibles.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_niveau2_selection on public.selections_erof;
create trigger trg_enforce_niveau2_selection before insert or update on public.selections_erof
for each row execute function public.enforce_niveau2_selection();

create or replace function public.compute_niveau2_scores()
returns trigger language plpgsql as $$
begin
  if new.statut = 'valide' and public.current_user_role() <> 'admin_national' then
    raise exception 'Seule la DAPS-COGES peut valider une grille de niveau 2.';
  end if;
  if not new.existence_prescolaire then new.effectif_prescolaire := 0; end if;
  new.score_prescolaire := case when new.existence_prescolaire then 1 else 0 end;
  new.score_effectif_prescolaire := case
    when new.effectif_prescolaire = 0 then 0 when new.effectif_prescolaire <= 20 then 1
    when new.effectif_prescolaire <= 40 then 2 else 3 end;
  new.score_distance_iepp := case when new.distance_iepp_km <= 20 then 1 when new.distance_iepp_km <= 40 then 2 else 3 end;
  new.score_acces_coges := case new.difficulte_acces when 'facile' then 0 when 'moyennement_difficile' then 1 when 'difficile' then 2 else 3 end;
  new.score_distance_sante := case when new.distance_centre_sante_km <= 10 then 1 when new.distance_centre_sante_km <= 25 then 2 else 3 end;
  new.score_acces_sante := case new.difficulte_acces_sante when 'facile' then 0 when 'moyennement_difficile' then 1 when 'difficile' then 2 else 3 end;
  new.score_total := new.score_prescolaire + new.score_effectif_prescolaire + new.score_distance_iepp
    + new.score_acces_coges + new.score_distance_sante + new.score_acces_sante;
  new.niveau_priorite := case when new.score_total >= 13 then 'Tres prioritaire'
    when new.score_total >= 9 then 'Prioritaire' when new.score_total >= 5 then 'Priorite moderee' else 'Faible priorite' end;
  new.updated_at := now();
  if new.statut = 'valide' and (tg_op = 'INSERT' or old.statut <> 'valide') then
    new.validated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compute_niveau2_scores on public.evaluations_niveau_2;
create trigger trg_compute_niveau2_scores before insert or update on public.evaluations_niveau_2
for each row execute function public.compute_niveau2_scores();

alter table public.selections_erof enable row level security;
alter table public.evaluations_niveau_2 enable row level security;

drop policy if exists selections_erof_select_scoped on public.selections_erof;
create policy selections_erof_select_scoped on public.selections_erof for select to authenticated
using (public.user_can_select_evaluation(evaluation_id));
drop policy if exists selections_erof_admin_insert on public.selections_erof;
create policy selections_erof_admin_insert on public.selections_erof for insert to authenticated
with check (public.current_user_role() = 'admin_national');
drop policy if exists selections_erof_admin_update on public.selections_erof;
create policy selections_erof_admin_update on public.selections_erof for update to authenticated
using (public.current_user_role() = 'admin_national') with check (public.current_user_role() = 'admin_national');
drop policy if exists selections_erof_admin_delete on public.selections_erof;
create policy selections_erof_admin_delete on public.selections_erof for delete to authenticated
using (public.current_user_role() = 'admin_national');

drop policy if exists evaluations_niveau2_select_scoped on public.evaluations_niveau_2;
create policy evaluations_niveau2_select_scoped on public.evaluations_niveau_2 for select to authenticated
using (exists (select 1 from public.selections_erof s where s.id = selection_erof_id and public.user_can_select_evaluation(s.evaluation_id)));
drop policy if exists evaluations_niveau2_write_scoped on public.evaluations_niveau_2;
create policy evaluations_niveau2_write_scoped on public.evaluations_niveau_2 for insert to authenticated
with check (exists (select 1 from public.selections_erof s where s.id = selection_erof_id and public.user_can_select_evaluation(s.evaluation_id)));
drop policy if exists evaluations_niveau2_update_scoped on public.evaluations_niveau_2;
create policy evaluations_niveau2_update_scoped on public.evaluations_niveau_2 for update to authenticated
using (exists (select 1 from public.selections_erof s where s.id = selection_erof_id and public.user_can_select_evaluation(s.evaluation_id)))
with check (exists (select 1 from public.selections_erof s where s.id = selection_erof_id and public.user_can_select_evaluation(s.evaluation_id)));

grant select, insert, update, delete on public.selections_erof to authenticated;
grant select, insert, update on public.evaluations_niveau_2 to authenticated;
