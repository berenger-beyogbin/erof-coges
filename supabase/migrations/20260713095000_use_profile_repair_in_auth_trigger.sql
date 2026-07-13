-- Route Auth profile creation through the hardened repair function so the
-- trigger stays compatible with both text and enum role columns.

create or replace function public.handle_new_auth_user_erof()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_user_profile_for_auth_id(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_erof on auth.users;
create trigger on_auth_user_created_erof
after insert on auth.users
for each row execute function public.handle_new_auth_user_erof();
