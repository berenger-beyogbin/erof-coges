-- Repair and harden Auth -> public.users profile provisioning.
-- Some accounts can exist in auth.users while their application profile is
-- missing, or while an older public.users row with the same e-mail points to a
-- different Auth id. This gives the app a safe self-repair RPC after login.

create or replace function public.ensure_user_profile_for_auth_id(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_user auth.users%rowtype;
  metadata jsonb;
  user_role text;
  drena_raw text;
  iepp_raw text;
  phone_raw text;
  role_schema text;
  role_udt text;
  drena_udt text;
  iepp_udt text;
  insert_sql text;
  existing_profile_id uuid;
  fallback_nom text;
  fallback_prenom text;
begin
  if target_user_id is null then
    return;
  end if;

  select *
    into auth_user
  from auth.users
  where id = target_user_id;

  if not found then
    return;
  end if;

  if nullif(auth_user.email, '') is null then
    return;
  end if;

  if exists (select 1 from public.users where id = auth_user.id) then
    return;
  end if;

  metadata := coalesce(auth_user.raw_user_meta_data, '{}'::jsonb);
  user_role := coalesce(nullif(metadata->>'role', ''), 'enqueteur');
  if user_role not in ('admin_national', 'superviseur_drena', 'superviseur_iepp', 'enqueteur', 'lecteur') then
    user_role := 'enqueteur';
  end if;

  drena_raw := nullif(metadata->>'drena_id', '');
  iepp_raw := nullif(metadata->>'iepp_id', '');
  phone_raw := nullif(coalesce(metadata->>'telephone', metadata->>'phone'), '');
  fallback_nom := coalesce(
    nullif(metadata->>'nom', ''),
    nullif(metadata->>'last_name', ''),
    nullif(split_part(coalesce(auth_user.email, ''), '@', 1), ''),
    'Utilisateur'
  );
  fallback_prenom := coalesce(
    nullif(metadata->>'prenom', ''),
    nullif(metadata->>'first_name', ''),
    'EROF'
  );

  if drena_raw is not null and not exists (select 1 from public.drenas where id::text = drena_raw) then
    drena_raw := null;
  end if;

  if iepp_raw is not null and not exists (select 1 from public.iepps where id::text = iepp_raw) then
    iepp_raw := null;
  end if;

  select u.id
    into existing_profile_id
  from public.users u
  where lower(u.email) = lower(coalesce(auth_user.email, ''))
  limit 1;

  if existing_profile_id is not null then
    update public.users
    set
      id = auth_user.id,
      email = coalesce(auth_user.email, email),
      nom = coalesce(nullif(metadata->>'nom', ''), nullif(nom, ''), fallback_nom),
      prenom = coalesce(nullif(metadata->>'prenom', ''), nullif(prenom, ''), fallback_prenom),
      telephone = coalesce(phone_raw, telephone),
      updated_at = now()
    where id = existing_profile_id;
    return;
  end if;

  select c.udt_schema, c.udt_name
    into role_schema, role_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'role';

  select c.udt_name
    into drena_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'drena_id';

  select c.udt_name
    into iepp_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'users'
    and c.column_name = 'iepp_id';

  insert_sql := format(
    'insert into public.users (
      id, email, nom, prenom, role, telephone, drena_id, iepp_id, actif
    ) values (
      $1, $2, $3, $4, %s, $6, %s, %s, true
    )
    on conflict (id) do nothing',
    case
      when role_udt is not null and role_udt <> 'text' then format('$5::%I.%I', role_schema, role_udt)
      else '$5'
    end,
    case when drena_udt = 'uuid' then 'public.try_uuid($7)' else '$7' end,
    case when iepp_udt = 'uuid' then 'public.try_uuid($8)' else '$8' end
  );

  execute insert_sql
    using
      auth_user.id,
      coalesce(auth_user.email, ''),
      fallback_nom,
      fallback_prenom,
      user_role,
      phone_raw,
      drena_raw,
      iepp_raw;
end;
$$;

revoke all on function public.ensure_user_profile_for_auth_id(uuid) from public;

create or replace function public.ensure_own_user_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Session utilisateur invalide ou expiree.';
  end if;

  perform public.ensure_user_profile_for_auth_id(auth.uid());
end;
$$;

grant execute on function public.ensure_own_user_profile() to authenticated;

do $$
declare
  auth_user_id uuid;
begin
  for auth_user_id in
    select id from auth.users
  loop
    perform public.ensure_user_profile_for_auth_id(auth_user_id);
  end loop;
end $$;
