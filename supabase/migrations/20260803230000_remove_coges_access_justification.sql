-- The workshop no longer asks for a textual justification of COGES access difficulty.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.evaluations_niveau_2'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%justification_acces%'
      and pg_get_constraintdef(oid) not ilike '%justification_acces_sante%'
  loop
    execute format('alter table public.evaluations_niveau_2 drop constraint %I', constraint_name);
  end loop;
end;
$$;
