-- Ensure score-by-axis columns exist on already-created remote projects.
-- The baseline migration creates them for fresh databases, but CREATE TABLE IF
-- NOT EXISTS does not add columns when evaluation_scores pre-exists.

alter table public.evaluation_scores
  add column if not exists score_axe1 numeric not null default 0,
  add column if not exists score_axe2 numeric not null default 0,
  add column if not exists score_axe3 numeric not null default 0,
  add column if not exists score_axe4 numeric not null default 0,
  add column if not exists score_axe5 numeric not null default 0,
  add column if not exists score_axe6 numeric not null default 0,
  add column if not exists score_axe7 numeric not null default 0,
  add column if not exists score_axe8 numeric not null default 0,
  add column if not exists score_axe9 numeric not null default 0,
  add column if not exists score_axe10 numeric not null default 0,
  add column if not exists score_axe11 numeric not null default 0,
  add column if not exists score_axe12 numeric not null default 0;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end $$;
