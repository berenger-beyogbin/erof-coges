-- Repair installations where selections_erof predates the finalized level-2 schema.
alter table public.selections_erof
  add column if not exists score_erof numeric;

update public.selections_erof s
set score_erof = coalesce(es.score_global, 0)
from public.evaluation_scores es
where es.evaluation_id = s.evaluation_id
  and s.score_erof is null;

update public.selections_erof set score_erof = 0 where score_erof is null;

alter table public.selections_erof
  alter column score_erof set not null;

alter table public.selections_erof
  drop constraint if exists selections_erof_score_erof_check;
alter table public.selections_erof
  add constraint selections_erof_score_erof_check check (score_erof between 0 and 5);

notify pgrst, 'reload schema';
