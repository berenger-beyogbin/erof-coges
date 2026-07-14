-- Type de COGES now has only two values:
-- PRESCOLAIRE-PRIMAIRE or SECONDAIRE.

alter table public.etablissements
drop constraint if exists etablissements_type_etablissement_check;

alter table public.etablissements
drop constraint if exists etablissements_type_etablissement_allowed_chk;

alter table public.etablissements
alter column type_etablissement type text
using type_etablissement::text;

update public.etablissements
set type_etablissement = case
  when type_etablissement in ('prescolaire', 'primaire', 'groupe_scolaire') then 'prescolaire_primaire'
  when type_etablissement in ('college', 'lycee') then 'secondaire'
  else type_etablissement
end
where type_etablissement in ('prescolaire', 'primaire', 'groupe_scolaire', 'college', 'lycee');

update public.etablissements
set type_etablissement = null
where type_etablissement is not null
  and type_etablissement not in ('prescolaire_primaire', 'secondaire');

drop type if exists public.type_etablissement;

create type public.type_etablissement as enum (
  'prescolaire_primaire',
  'secondaire'
);

alter table public.etablissements
alter column type_etablissement type public.type_etablissement
using type_etablissement::public.type_etablissement;
