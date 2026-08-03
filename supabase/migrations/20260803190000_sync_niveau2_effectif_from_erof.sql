-- The level-2 enrolment is inherited from the linked EROF evaluation and cannot be overridden.
create or replace function public.compute_niveau2_scores()
returns trigger language plpgsql as $$
declare
  erof_effectif integer;
begin
  select ev.effectif_total into erof_effectif
  from public.selections_erof s
  join public.evaluations ev on ev.id = s.evaluation_id
  where s.id = new.selection_erof_id;

  new.effectif_coges := coalesce(erof_effectif, 0);
  if not new.existence_prescolaire then new.effectif_prescolaire := 0; end if;
  new.score_prescolaire := case when new.existence_prescolaire then 1 else 0 end;
  new.score_effectif_prescolaire := case
    when new.effectif_prescolaire = 0 then 0 when new.effectif_prescolaire <= 20 then 1
    when new.effectif_prescolaire <= 40 then 2 else 3 end;
  new.score_distance_iepp := case when new.distance_iepp_km <= 20 then 1 when new.distance_iepp_km <= 40 then 2 else 3 end;
  new.score_acces_coges := case new.difficulte_acces when 'facile' then 0 when 'moyennement_difficile' then 1 when 'difficile' then 2 else 3 end;
  new.score_distance_sante := case when new.distance_centre_sante_km <= 10 then 1 when new.distance_centre_sante_km <= 25 then 2 else 3 end;
  new.score_acces_sante := case new.difficulte_acces_sante when 'facile' then 0 when 'moyennement_difficile' then 1 when 'difficile' then 2 else 3 end;
  new.score_total := new.score_prescolaire + new.score_effectif_prescolaire + new.score_distance_iepp
    + new.score_acces_coges + new.score_distance_sante + new.score_acces_sante;
  new.niveau_priorite := case when new.score_total >= 13 then 'Tres prioritaire'
    when new.score_total >= 9 then 'Prioritaire' when new.score_total >= 5 then 'Priorite moderee' else 'Faible priorite' end;
  new.updated_at := now();
  if new.statut = 'valide' and (tg_op = 'INSERT' or old.statut <> 'valide') then new.validated_at := now(); end if;
  return new;
end;
$$;

update public.evaluations_niveau_2 n2
set effectif_coges = ev.effectif_total
from public.selections_erof s
join public.evaluations ev on ev.id = s.evaluation_id
where n2.selection_erof_id = s.id
  and n2.effectif_coges is distinct from ev.effectif_total;
