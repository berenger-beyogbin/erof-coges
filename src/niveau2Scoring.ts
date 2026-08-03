import { AccessDifficulty, EvaluationNiveau2 } from './types';

export type Niveau2Input = Pick<EvaluationNiveau2,
  | 'existence_prescolaire'
  | 'effectif_prescolaire'
  | 'distance_iepp_km'
  | 'difficulte_acces'
  | 'distance_centre_sante_km'
  | 'difficulte_acces_sante'
>;

const difficultyPoints: Record<AccessDifficulty, number> = {
  facile: 0,
  moyennement_difficile: 1,
  difficile: 2,
  tres_difficile: 3
};

export function computeNiveau2Scores(input: Niveau2Input) {
  const score_prescolaire = input.existence_prescolaire ? 1 : 0;
  const effectif = input.existence_prescolaire ? Math.max(0, Number(input.effectif_prescolaire) || 0) : 0;
  const score_effectif_prescolaire = effectif === 0 ? 0 : effectif <= 20 ? 1 : effectif <= 40 ? 2 : 3;
  const distanceIepp = Math.max(0, Number(input.distance_iepp_km) || 0);
  const score_distance_iepp = distanceIepp <= 20 ? 1 : distanceIepp <= 40 ? 2 : 3;
  const score_acces_coges = difficultyPoints[input.difficulte_acces] ?? 0;
  const distanceSante = Math.max(0, Number(input.distance_centre_sante_km) || 0);
  const score_distance_sante = distanceSante <= 10 ? 1 : distanceSante <= 25 ? 2 : 3;
  const score_acces_sante = difficultyPoints[input.difficulte_acces_sante] ?? 0;
  const score_total = score_prescolaire + score_effectif_prescolaire + score_distance_iepp
    + score_acces_coges + score_distance_sante + score_acces_sante;
  const niveau_priorite = score_total >= 13 ? 'Tres prioritaire'
    : score_total >= 9 ? 'Prioritaire'
    : score_total >= 5 ? 'Priorite moderee'
    : 'Faible priorite';

  return {
    score_prescolaire,
    score_effectif_prescolaire,
    score_distance_iepp,
    score_acces_coges,
    score_distance_sante,
    score_acces_sante,
    score_total,
    niveau_priorite
  };
}

export function needsAccessJustification(value: AccessDifficulty): boolean {
  return value === 'difficile' || value === 'tres_difficile';
}
