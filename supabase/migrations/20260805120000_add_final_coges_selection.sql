-- Final COGES selection, consolidated from validated level-1 and level-2 results.
create table if not exists public.selection_finale_sessions (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes(id) on update cascade on delete cascade,
  drena_id uuid not null references public.drenas(id) on update cascade on delete cascade,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'valide')),
  commentaire text,
  created_by uuid references public.users(id) on update cascade on delete set null,
  validated_by uuid references public.users(id) on update cascade on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campagne_id, drena_id)
);

create table if not exists public.selection_finale_coges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.selection_finale_sessions(id) on update cascade on delete cascade,
  evaluation_id uuid not null references public.evaluations(id) on update cascade on delete cascade,
  rang_final integer not null check (rang_final > 0),
  created_at timestamptz not null default now(),
  unique (session_id, evaluation_id),
  unique (session_id, rang_final)
);

create index if not exists selection_finale_sessions_campagne_idx on public.selection_finale_sessions(campagne_id);
create index if not exists selection_finale_coges_session_idx on public.selection_finale_coges(session_id);

alter table public.selection_finale_sessions enable row level security;
alter table public.selection_finale_coges enable row level security;

drop policy if exists selection_finale_sessions_select_scoped on public.selection_finale_sessions;
create policy selection_finale_sessions_select_scoped on public.selection_finale_sessions for select to authenticated
using (
  public.current_user_role() = 'admin_national'
  or exists (select 1 from public.users u where u.id = auth.uid() and u.drena_id = drena_id)
);

drop policy if exists selection_finale_coges_select_scoped on public.selection_finale_coges;
create policy selection_finale_coges_select_scoped on public.selection_finale_coges for select to authenticated
using (exists (
  select 1 from public.selection_finale_sessions s
  where s.id = session_id and (
    public.current_user_role() = 'admin_national'
    or exists (select 1 from public.users u where u.id = auth.uid() and u.drena_id = s.drena_id)
  )
));

create or replace function public.save_selection_finale(
  p_campagne_id uuid,
  p_drena_nom text,
  p_evaluation_ids uuid[],
  p_commentaire text default null,
  p_validate boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_drena_id uuid;
  v_session public.selection_finale_sessions%rowtype;
  v_evaluation_id uuid;
  v_rank integer := 0;
begin
  if public.current_user_role() <> 'admin_national' then
    raise exception 'Action reservee a l administrateur national.';
  end if;

  select id into v_drena_id from public.drenas where nom = p_drena_nom;
  if v_drena_id is null then raise exception 'DRENA introuvable.'; end if;
  if coalesce(cardinality(p_evaluation_ids), 0) = 0 then raise exception 'Selectionnez au moins un COGES.'; end if;

  select * into v_session from public.selection_finale_sessions
  where campagne_id = p_campagne_id and drena_id = v_drena_id for update;
  if v_session.statut = 'valide' then raise exception 'Cette selection definitive est deja validee.'; end if;

  if v_session.id is null then
    insert into public.selection_finale_sessions(campagne_id, drena_id, commentaire, created_by)
    values (p_campagne_id, v_drena_id, nullif(trim(p_commentaire), ''), auth.uid()) returning * into v_session;
  else
    update public.selection_finale_sessions set commentaire = nullif(trim(p_commentaire), ''), updated_at = now()
    where id = v_session.id returning * into v_session;
    delete from public.selection_finale_coges where session_id = v_session.id;
  end if;

  foreach v_evaluation_id in array p_evaluation_ids loop
    if not exists (
      select 1 from public.evaluations ev
      join public.etablissements et on et.id = ev.etablissement_id
      join public.iepps i on i.id = et.iepp_id
      join public.selections_erof se on se.evaluation_id = ev.id and se.campagne_id = ev.campagne_id
      join public.evaluations_niveau_2 n2 on n2.selection_erof_id = se.id and n2.statut = 'valide'
      where ev.id = v_evaluation_id and ev.campagne_id = p_campagne_id and i.drena_id = v_drena_id
        and ev.statut in ('valide', 'verrouille')
    ) then raise exception 'Un COGES choisi ne possede pas deux evaluations valides dans cette DRENA.'; end if;
    v_rank := v_rank + 1;
    insert into public.selection_finale_coges(session_id, evaluation_id, rang_final)
    values (v_session.id, v_evaluation_id, v_rank);
  end loop;

  if p_validate then
    update public.selection_finale_sessions set statut = 'valide', validated_by = auth.uid(),
      validated_at = now(), updated_at = now() where id = v_session.id;
  end if;
  return v_session.id;
end;
$$;

grant select on public.selection_finale_sessions, public.selection_finale_coges to authenticated;
grant execute on function public.save_selection_finale(uuid, text, uuid[], text, boolean) to authenticated;
