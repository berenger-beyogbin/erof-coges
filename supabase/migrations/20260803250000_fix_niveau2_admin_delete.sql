-- Delete the child grid before its workshop selection, atomically and admin-only.
create or replace function public.delete_niveau2_selection(p_selection_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'admin_national' then
    raise exception 'Action reservee a l administrateur national.';
  end if;
  delete from public.evaluations_niveau_2 where selection_erof_id = p_selection_id;
  delete from public.selections_erof where id = p_selection_id;
  if not found then raise exception 'Grille niveau 2 introuvable.'; end if;
end;
$$;

grant execute on function public.delete_niveau2_selection(uuid) to authenticated;
