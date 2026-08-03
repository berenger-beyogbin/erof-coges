-- Reframe level 2 as a workshop evaluation for every eligible EROF COGES.
alter table public.evaluations_niveau_2
  add column if not exists participants_atelier text;

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

drop policy if exists selections_erof_admin_insert on public.selections_erof;
create policy selections_erof_workshop_insert on public.selections_erof for insert to authenticated
with check (
  public.current_user_role() in ('admin_national', 'superviseur_drena', 'superviseur_iepp')
  and public.user_can_select_evaluation(evaluation_id)
);

notify pgrst, 'reload schema';
