-- Fix auth profile provisioning on the existing remote schema where
-- users.drena_id / users.iepp_id are UUID columns. The initial baseline kept
-- text-friendly metadata assignments, which can make auth user creation fail
-- inside the trigger before the application gets a chance to upsert a profile.

create or replace function public.handle_new_auth_user_erof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  user_role text := coalesce(metadata->>'role', 'enqueteur');
  drena_raw text := nullif(metadata->>'drena_id', '');
  iepp_raw text := nullif(metadata->>'iepp_id', '');
  drena_udt text;
  iepp_udt text;
  insert_sql text;
begin
  if metadata->>'registration_type' = 'enqueteur' or metadata ? 'role' then
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
        id, email, nom, prenom, role, drena_id, iepp_id, actif
      ) values (
        $1, $2, $3, $4, $5, %s, %s, true
      )
      on conflict (id) do update set
        email = excluded.email,
        nom = excluded.nom,
        prenom = excluded.prenom,
        role = excluded.role,
        drena_id = excluded.drena_id,
        iepp_id = excluded.iepp_id,
        updated_at = now()',
      case when drena_udt = 'uuid' then 'public.try_uuid($6)' else '$6' end,
      case when iepp_udt = 'uuid' then 'public.try_uuid($7)' else '$7' end
    );

    execute insert_sql
      using
        new.id,
        coalesce(new.email, ''),
        coalesce(metadata->>'nom', ''),
        coalesce(metadata->>'prenom', ''),
        user_role,
        drena_raw,
        iepp_raw;
  end if;

  return new;
end;
$$;
