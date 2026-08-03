-- A submitted/validated level-2 grid is immutable for non-admin users.
create or replace function public.prevent_non_admin_niveau2_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut = 'valide' and public.current_user_role() <> 'admin_national' then
    raise exception 'Cette grille a ete soumise et ne peut etre modifiee que par un administrateur.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_submitted_niveau2 on public.evaluations_niveau_2;
create trigger trg_lock_submitted_niveau2
before update on public.evaluations_niveau_2
for each row execute function public.prevent_non_admin_niveau2_update();
