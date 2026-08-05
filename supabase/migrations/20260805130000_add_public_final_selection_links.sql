-- Secure public links for final COGES selection workshops.
create table if not exists public.final_selection_public_links (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes(id) on update cascade on delete cascade,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references public.users(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.final_selection_public_links enable row level security;
create policy final_selection_links_admin_all on public.final_selection_public_links for all to authenticated
using (public.current_user_role() = 'admin_national')
with check (public.current_user_role() = 'admin_national');
grant select, insert, update, delete on public.final_selection_public_links to authenticated;

create or replace function public.create_final_selection_public_link(p_campagne_id uuid, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if public.current_user_role() <> 'admin_national' then raise exception 'Action reservee a l administrateur national.'; end if;
  if p_expires_at <= now() then raise exception 'La date d expiration doit etre future.'; end if;
  insert into public.final_selection_public_links(campagne_id, expires_at, created_by)
  values (p_campagne_id, p_expires_at, auth.uid()) returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.final_selection_public_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_link public.final_selection_public_links%rowtype; v_result jsonb;
begin
  select * into v_link from public.final_selection_public_links where token=p_token and active and expires_at>now();
  if v_link.id is null then raise exception 'Lien invalide ou expire.'; end if;
  select jsonb_build_object(
    'campagne', (select to_jsonb(c) from public.campagnes c where c.id=v_link.campagne_id),
    'expires_at', v_link.expires_at,
    'candidates', coalesce((select jsonb_agg(jsonb_build_object(
      'selection_id', se.id, 'evaluation_id', ev.id, 'campagne_id', ev.campagne_id,
      'etablissement_nom', et.nom, 'iepp_nom', i.nom, 'drena_nom', d.nom,
      'score_erof', es.score_global, 'niveau2', to_jsonb(n2)
    ) order by d.nom, n2.score_total desc, et.nom)
    from public.evaluations ev
    join public.etablissements et on et.id=ev.etablissement_id
    join public.iepps i on i.id=et.iepp_id
    join public.drenas d on d.id=i.drena_id
    join public.evaluation_scores es on es.evaluation_id=ev.id
    join public.selections_erof se on se.evaluation_id=ev.id and se.campagne_id=ev.campagne_id
    join public.evaluations_niveau_2 n2 on n2.selection_erof_id=se.id and n2.statut='valide'
    where ev.campagne_id=v_link.campagne_id and ev.statut in ('valide','verrouille')), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'campagne_id', s.campagne_id, 'drena_nom', d.nom, 'statut', s.statut,
      'commentaire', s.commentaire, 'validated_at', s.validated_at,
      'evaluation_ids', coalesce((select jsonb_agg(sc.evaluation_id order by sc.rang_final) from public.selection_finale_coges sc where sc.session_id=s.id), '[]'::jsonb)
    )) from public.selection_finale_sessions s join public.drenas d on d.id=s.drena_id
      where s.campagne_id=v_link.campagne_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.final_selection_public_save(
  p_token uuid, p_drena_nom text, p_evaluation_ids uuid[], p_commentaire text default null, p_validate boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_link public.final_selection_public_links%rowtype; v_drena_id uuid;
  v_session public.selection_finale_sessions%rowtype; v_evaluation_id uuid; v_rank integer := 0;
begin
  select * into v_link from public.final_selection_public_links where token=p_token and active and expires_at>now();
  if v_link.id is null then raise exception 'Lien invalide ou expire.'; end if;
  select id into v_drena_id from public.drenas where nom=p_drena_nom;
  if v_drena_id is null then raise exception 'DRENA introuvable.'; end if;
  if coalesce(cardinality(p_evaluation_ids),0)=0 then raise exception 'Selectionnez au moins un COGES.'; end if;
  select * into v_session from public.selection_finale_sessions
    where campagne_id=v_link.campagne_id and drena_id=v_drena_id for update;
  if v_session.statut='valide' then raise exception 'Cette selection definitive est deja validee.'; end if;
  if v_session.id is null then
    insert into public.selection_finale_sessions(campagne_id,drena_id,commentaire)
    values(v_link.campagne_id,v_drena_id,nullif(trim(p_commentaire),'')) returning * into v_session;
  else
    update public.selection_finale_sessions set commentaire=nullif(trim(p_commentaire),''),updated_at=now()
      where id=v_session.id returning * into v_session;
    delete from public.selection_finale_coges where session_id=v_session.id;
  end if;
  foreach v_evaluation_id in array p_evaluation_ids loop
    if not exists(select 1 from public.evaluations ev
      join public.etablissements et on et.id=ev.etablissement_id join public.iepps i on i.id=et.iepp_id
      join public.selections_erof se on se.evaluation_id=ev.id and se.campagne_id=ev.campagne_id
      join public.evaluations_niveau_2 n2 on n2.selection_erof_id=se.id and n2.statut='valide'
      where ev.id=v_evaluation_id and ev.campagne_id=v_link.campagne_id and i.drena_id=v_drena_id
        and ev.statut in ('valide','verrouille')) then raise exception 'COGES non eligible.'; end if;
    v_rank := v_rank+1;
    insert into public.selection_finale_coges(session_id,evaluation_id,rang_final) values(v_session.id,v_evaluation_id,v_rank);
  end loop;
  if p_validate then update public.selection_finale_sessions set statut='valide',validated_at=now(),updated_at=now() where id=v_session.id; end if;
  return v_session.id;
end;
$$;

grant execute on function public.create_final_selection_public_link(uuid,timestamptz) to authenticated;
grant execute on function public.final_selection_public_context(uuid) to anon, authenticated;
grant execute on function public.final_selection_public_save(uuid,text,uuid[],text,boolean) to anon, authenticated;
