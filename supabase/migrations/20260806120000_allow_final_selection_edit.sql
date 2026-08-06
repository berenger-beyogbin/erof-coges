-- Allow national administrators to revise and revalidate a final manual selection.
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

  if v_session.id is null then
    insert into public.selection_finale_sessions(campagne_id, drena_id, commentaire, created_by)
    values (p_campagne_id, v_drena_id, nullif(trim(p_commentaire), ''), auth.uid()) returning * into v_session;
  else
    update public.selection_finale_sessions
    set commentaire = nullif(trim(p_commentaire), ''), statut = 'brouillon',
        validated_by = null, validated_at = null, updated_at = now()
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
    update public.selection_finale_sessions
    set statut = 'valide', validated_by = auth.uid(), validated_at = now(), updated_at = now()
    where id = v_session.id;
  end if;
  return v_session.id;
end;
$$;

grant execute on function public.save_selection_finale(uuid, text, uuid[], text, boolean) to authenticated;
