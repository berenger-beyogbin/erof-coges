-- Secure, revocable, expiring links for unauthenticated level-2 workshops.
create table if not exists public.niveau2_workshop_links (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  campagne_id uuid not null references public.campagnes(id) on update cascade on delete cascade,
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by uuid references public.users(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.niveau2_workshop_links enable row level security;
create policy niveau2_links_admin_all on public.niveau2_workshop_links for all to authenticated
using (public.current_user_role() = 'admin_national')
with check (public.current_user_role() = 'admin_national');
grant select, insert, update, delete on public.niveau2_workshop_links to authenticated;

create or replace function public.create_niveau2_workshop_link(p_campagne_id uuid, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_token uuid;
begin
  if public.current_user_role() <> 'admin_national' then raise exception 'Action reservee a l administrateur national.'; end if;
  if p_expires_at <= now() then raise exception 'La date d expiration doit etre future.'; end if;
  insert into public.niveau2_workshop_links(campagne_id, expires_at, created_by)
  values (p_campagne_id, p_expires_at, auth.uid()) returning token into new_token;
  return new_token;
end;
$$;

create or replace function public.niveau2_public_context(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare link_row public.niveau2_workshop_links%rowtype; result jsonb;
begin
  select * into link_row from public.niveau2_workshop_links where token = p_token and active and expires_at > now();
  if link_row.id is null then raise exception 'Lien invalide ou expire.'; end if;
  select jsonb_build_object(
    'campagne', (select to_jsonb(c) from public.campagnes c where c.id = link_row.campagne_id),
    'expires_at', link_row.expires_at,
    'evaluations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ev.id, 'campagne_id', ev.campagne_id, 'effectif_total', ev.effectif_total,
      'etablissement_nom', et.nom, 'drena_nom', d.nom, 'iepp_nom', i.nom,
      'score_erof', es.score_global,
      'selection_id', s.id,
      'niveau2', case when n.id is null then null else to_jsonb(n) end
    ) order by d.nom, et.nom)
    from public.evaluations ev
    join public.etablissements et on et.id = ev.etablissement_id
    join public.iepps i on i.id = et.iepp_id
    join public.drenas d on d.id = i.drena_id
    join public.evaluation_scores es on es.evaluation_id = ev.id
    left join public.selections_erof s on s.evaluation_id = ev.id and s.campagne_id = ev.campagne_id
    left join public.evaluations_niveau_2 n on n.selection_erof_id = s.id
    where ev.campagne_id = link_row.campagne_id and ev.statut in ('valide','verrouille')), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.niveau2_public_start(p_token uuid, p_evaluation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare link_row public.niveau2_workshop_links%rowtype; ev public.evaluations%rowtype; result_id uuid; erof_score numeric; erof_rank integer;
begin
  select * into link_row from public.niveau2_workshop_links where token=p_token and active and expires_at>now();
  if link_row.id is null then raise exception 'Lien invalide ou expire.'; end if;
  select * into ev from public.evaluations where id=p_evaluation_id and campagne_id=link_row.campagne_id and statut in ('valide','verrouille');
  if ev.id is null then raise exception 'COGES non eligible.'; end if;
  select score_global into erof_score from public.evaluation_scores where evaluation_id=ev.id;
  select rank_value into erof_rank from (
    select e.id, row_number() over(order by sc.score_global desc, e.id)::integer rank_value
    from public.evaluations e join public.evaluation_scores sc on sc.evaluation_id=e.id
    where e.campagne_id=link_row.campagne_id and e.statut in ('valide','verrouille')
  ) ranked where id=ev.id;
  select id into result_id from public.selections_erof where campagne_id=link_row.campagne_id and evaluation_id=ev.id;
  if result_id is null then
    insert into public.selections_erof(campagne_id,evaluation_id,rang_erof,score_erof)
    values(link_row.campagne_id,ev.id,erof_rank,erof_score) returning id into result_id;
  end if;
  return result_id;
end;
$$;

create or replace function public.niveau2_public_save(p_token uuid, p_selection_id uuid, p_payload jsonb, p_submit boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare link_row public.niveau2_workshop_links%rowtype; existing public.evaluations_niveau_2%rowtype;
begin
  select * into link_row from public.niveau2_workshop_links where token=p_token and active and expires_at>now();
  if link_row.id is null then raise exception 'Lien invalide ou expire.'; end if;
  if not exists(select 1 from public.selections_erof where id=p_selection_id and campagne_id=link_row.campagne_id) then raise exception 'Grille hors campagne.'; end if;
  select * into existing from public.evaluations_niveau_2 where selection_erof_id=p_selection_id;
  if existing.id is not null and existing.statut='valide' then raise exception 'Cette grille est deja soumise et verrouillee.'; end if;
  insert into public.evaluations_niveau_2(
    selection_erof_id, existence_prescolaire, effectif_prescolaire, distance_iepp_km,
    difficulte_acces, distance_centre_sante_km, difficulte_acces_sante,
    justification_acces_sante, statut
  ) values (
    p_selection_id, coalesce((p_payload->>'existence_prescolaire')::boolean,false),
    coalesce((p_payload->>'effectif_prescolaire')::integer,0), coalesce((p_payload->>'distance_iepp_km')::numeric,0),
    coalesce(p_payload->>'difficulte_acces','facile'), coalesce((p_payload->>'distance_centre_sante_km')::numeric,0),
    coalesce(p_payload->>'difficulte_acces_sante','facile'), p_payload->>'justification_acces_sante',
    case when p_submit then 'valide' else 'brouillon' end
  ) on conflict(selection_erof_id) do update set
    existence_prescolaire=excluded.existence_prescolaire, effectif_prescolaire=excluded.effectif_prescolaire,
    distance_iepp_km=excluded.distance_iepp_km, difficulte_acces=excluded.difficulte_acces,
    distance_centre_sante_km=excluded.distance_centre_sante_km, difficulte_acces_sante=excluded.difficulte_acces_sante,
    justification_acces_sante=excluded.justification_acces_sante, statut=excluded.statut;
end;
$$;

grant execute on function public.create_niveau2_workshop_link(uuid,timestamptz) to authenticated;
grant execute on function public.niveau2_public_context(uuid) to anon, authenticated;
grant execute on function public.niveau2_public_start(uuid,uuid) to anon, authenticated;
grant execute on function public.niveau2_public_save(uuid,uuid,jsonb,boolean) to anon, authenticated;

-- Ensure SQL NULL roles are treated as non-admin for ordinary direct updates.
create or replace function public.prevent_non_admin_niveau2_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.statut = 'valide' and coalesce(public.current_user_role(),'') <> 'admin_national' then
    raise exception 'Cette grille a ete soumise et ne peut etre modifiee que par un administrateur.';
  end if;
  return new;
end;
$$;
