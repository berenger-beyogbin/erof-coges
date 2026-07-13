-- Enqueteurs are always scoped at DRENA level. IEPP scoping remains reserved
-- for superviseur_iepp users.

drop trigger if exists on_auth_user_created_enqueteur on auth.users;
drop function if exists public.handle_new_enqueteur_signup();

update public.users
set
  iepp_id = null,
  updated_at = now()
where role::text = 'enqueteur'
  and iepp_id is not null;

alter table public.users
drop constraint if exists users_enqueteur_drena_scope_chk;

alter table public.users
add constraint users_enqueteur_drena_scope_chk
check (role::text <> 'enqueteur' or iepp_id is null);
