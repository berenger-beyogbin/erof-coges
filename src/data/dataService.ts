/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, 
  Drena, 
  Iepp, 
  Etablissement, 
  Coges, 
  Campagne, 
  Evaluation, 
  EvaluationReponse, 
  EvaluationScore, 
  PreuveDocumentaire, 
  MembreBe, 
  EquipeEvaluation, 
  Recommandation, 
  AuditLog,
  EvaluationStatus
} from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

// Pre-seeded static data representing the MENAET / DAPS-COGES regional structure
export const PRE_SEEDED_DRENAS: Drena[] = [
  { id: 'drena_01', nom: 'Abidjan 1 (Lagunes)' },
  { id: 'drena_02', nom: 'Bouaké 2 (Gbêkê)' },
  { id: 'drena_03', nom: 'Yamoussoukro (Lacs)' },
  { id: 'drena_04', nom: 'Korhogo (Poro)' },
  { id: 'drena_05', nom: 'San Pedro (Bas-Sassandra)' }
];

export const PRE_SEEDED_IEPPS: Iepp[] = [
  { id: 'iepp_cocody', nom: 'Cocody (Abidjan 1)', drena_id: 'drena_01' },
  { id: 'iepp_plateau', nom: 'Plateau (Abidjan 1)', drena_id: 'drena_01' },
  { id: 'iepp_bouake_v', nom: 'Bouaké Ville (Bouaké 2)', drena_id: 'drena_02' },
  { id: 'iepp_yam_est', nom: 'Yamoussoukro Est', drena_id: 'drena_03' },
  { id: 'iepp_korhogo_n', nom: 'Korhogo Nord', drena_id: 'drena_04' },
  { id: 'iepp_sp_ville', nom: 'San Pedro Ville', drena_id: 'drena_05' }
];

export const PRE_SEEDED_ETABLISSEMENTS: Etablissement[] = [
  {
    id: 'etab_01',
    nom: 'EPP Cocody Centre',
    code_desps: 'DESPS-00124-CO',
    type_etablissement: 'groupe_scolaire',
    iepp_id: 'iepp_cocody',
    localite: 'Cocody Cité',
    statut: 'public',
    milieu: 'urbain',
    nombre_classes: 12,
    nombre_enseignants: 14,
    cantine: true,
    date_creation: '1985-09-15',
    latitude: 5.3484,
    longitude: -3.9842
  },
  {
    id: 'etab_02',
    nom: 'EPP Bouaké Nimbo',
    code_desps: 'DESPS-00512-BO',
    type_etablissement: 'primaire',
    iepp_id: 'iepp_bouake_v',
    localite: 'Nimbo',
    statut: 'public',
    milieu: 'urbain',
    nombre_classes: 6,
    nombre_enseignants: 7,
    cantine: false,
    date_creation: '1998-10-01',
    latitude: 7.6901,
    longitude: -5.0264
  },
  {
    id: 'etab_03',
    nom: 'GS Yamoussoukro Résidentiel',
    code_desps: 'DESPS-00819-YA',
    type_etablissement: 'groupe_scolaire',
    iepp_id: 'iepp_yam_est',
    localite: 'Quartier Résidentiel',
    statut: 'prive_laic',
    milieu: 'periurbain',
    nombre_classes: 18,
    nombre_enseignants: 22,
    cantine: true,
    date_creation: '2005-09-01',
    latitude: 6.8120,
    longitude: -5.2710
  },
  {
    id: 'etab_04',
    nom: 'EPP Korhogo Koko',
    code_desps: 'DESPS-00941-KO',
    type_etablissement: 'primaire',
    iepp_id: 'iepp_korhogo_n',
    localite: 'Koko',
    statut: 'public',
    milieu: 'rural',
    nombre_classes: 6,
    nombre_enseignants: 5,
    cantine: true,
    date_creation: '2010-02-14',
    latitude: 9.4580,
    longitude: -5.6290
  }
];

export const PRE_SEEDED_COGES: Coges[] = [
  {
    id: 'coges_01',
    etablissement_id: 'etab_01',
    code_coges: 'COG-001-AB',
    date_creation: '1995-10-20',
    date_derniere_ag_elective: '2025-11-05'
  },
  {
    id: 'coges_02',
    etablissement_id: 'etab_02',
    code_coges: 'COG-012-BU',
    date_creation: '2000-01-10',
    date_derniere_ag_elective: '2024-10-15'
  },
  {
    id: 'coges_03',
    etablissement_id: 'etab_03',
    code_coges: 'COG-055-YA',
    date_creation: '2006-03-12',
    date_derniere_ag_elective: '2025-12-01'
  },
  {
    id: 'coges_04',
    etablissement_id: 'etab_04',
    code_coges: 'COG-088-KO',
    date_creation: '2012-05-18',
    date_derniere_ag_elective: '2023-11-20'
  }
];

export const PRE_SEEDED_CAMPAGNES: Campagne[] = [
  { id: 'camp_2026', nom: 'Évaluation Annuelle COGES 2026', active: true }
];

export const PRE_SEEDED_USERS: User[] = [
  {
    id: 'user_admin',
    email: 'admin@erof-coges.ci',
    nom_prenoms: 'Dr. Bakary Koné (Directeur DAPS-COGES)',
    role: 'admin_national'
  },
  {
    id: 'user_drena_gbeke',
    email: 'drena.gbeke@erof-coges.ci',
    nom_prenoms: 'Mme Jeanne Koffi (Superviseur DRENA Bouaké 2)',
    role: 'superviseur_drena',
    drena_id: 'drena_02'
  },
  {
    id: 'user_iepp_cocody',
    email: 'iepp.cocody@erof-coges.ci',
    nom_prenoms: 'M. Albert Coulibaly (Inspecteur IEPP Cocody)',
    role: 'superviseur_iepp',
    iepp_id: 'iepp_cocody'
  },
  {
    id: 'user_enqueteur_01',
    email: 'enqueteur1@erof-coges.ci',
    nom_prenoms: 'Jean-Pierre Touré (Enquêteur Lagunes)',
    role: 'enqueteur'
  },
  {
    id: 'user_lecteur_national',
    email: 'lecteur@erof-coges.ci',
    nom_prenoms: 'Observateur National (MENAET)',
    role: 'lecteur'
  }
];

export function computeEvaluationScores(
  evaluationId: string,
  responses: EvaluationReponse[],
  membresBe: MembreBe[],
  preuves: PreuveDocumentaire[]
): EvaluationScore {
  const answerMap = new Map<string, string>();
  responses.forEach(r => answerMap.set(r.question_code, r.reponse_valeur));

  const getNumVal = (code: string, def = 1): number => {
    const val = answerMap.get(code);
    if (!val) return def;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? def : parsed;
  };

  const avgCodes = (codes: string[]): number => {
    let sum = 0;
    let count = 0;
    codes.forEach(c => {
      const val = getNumVal(c, 0);
      if (val > 0) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? parseFloat((sum / count).toFixed(2)) : 3.0;
  };

  const score_axe1 = avgCodes(['5.1', '5.2', '5.4', '5.6', '5.7', '5.8', '5.9']);
  const score_axe2 = avgCodes(['6.1', '6.2', '6.3', '6.4', '6.5', '6.6']);
  const score_axe3 = avgCodes(['7.1']);
  const score_axe4 = avgCodes(['8.1', '8.2', '8.3', '8.4', '8.5', '8.6']);
  const score_axe5 = avgCodes(['9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7']);
  const score_axe6 = avgCodes(['10.1', '10.2', '10.3', '10.4', '10.5', '10.6']);
  const score_axe7 = avgCodes(['11.1']);
  const score_axe8 = avgCodes(['12.1', '12.2']);
  const score_axe9 = avgCodes(['13.1', '13.2']);
  const score_axe10 = avgCodes(['14.1']);
  const score_axe11 = avgCodes(['15.1']);

  let score_axe12 = 3.0;
  if (membresBe.length > 0) {
    let trainingSum = 0;
    let masterySum = 0;
    membresBe.forEach(m => {
      trainingSum += m.formation_coges ? 5 : 1;
      masterySum += m.maitrise_role === 'bonne' ? 5 : m.maitrise_role === 'moyenne' ? 3 : 1;
    });
    score_axe12 = parseFloat(((trainingSum / membresBe.length + masterySum / membresBe.length) / 2).toFixed(2));
  }

  const weights = {
    axe1: 0.10,
    axe2: 0.10,
    axe3: 0.08,
    axe4: 0.15,
    axe5: 0.10,
    axe6: 0.08,
    axe7: 0.10,
    axe8: 0.08,
    axe9: 0.07,
    axe10: 0.05,
    axe11: 0.04,
    axe12: 0.05
  };

  const score_global = parseFloat(
    (
      score_axe1 * weights.axe1 +
      score_axe2 * weights.axe2 +
      score_axe3 * weights.axe3 +
      score_axe4 * weights.axe4 +
      score_axe5 * weights.axe5 +
      score_axe6 * weights.axe6 +
      score_axe7 * weights.axe7 +
      score_axe8 * weights.axe8 +
      score_axe9 * weights.axe9 +
      score_axe10 * weights.axe10 +
      score_axe11 * weights.axe11 +
      score_axe12 * weights.axe12
    ).toFixed(2)
  );

  let classification = 'Faiblement fonctionnel';
  if (score_global < 2.0) {
    classification = 'Non fonctionnel / critique';
  } else if (score_global < 3.0) {
    classification = 'Faiblement fonctionnel';
  } else if (score_global < 3.50) {
    classification = 'Moyennement fonctionnel';
  } else if (score_global < 4.25) {
    classification = 'Fonctionnel';
  } else {
    classification = 'Performant / avancé';
  }

  const availableDocs = preuves.filter(p => p.statut === 'disponible_consultee').length;
  const totalExpectedDocs = 20;
  const taux_disponibilite_preuves = parseFloat(((availableDocs / totalExpectedDocs) * 100).toFixed(0));

  const axes_faibles: string[] = [];
  if (score_axe1 < 3.0) axes_faibles.push('Structure institutionnelle');
  if (score_axe2 < 3.0) axes_faibles.push('Fonctionnement interne');
  if (score_axe3 < 3.0) axes_faibles.push('Gestion administrative et documentaire');
  if (score_axe4 < 3.0) axes_faibles.push('Gestion financière');
  if (score_axe5 < 3.0) axes_faibles.push('Planification et redevabilité');
  if (score_axe6 < 3.0) axes_faibles.push('Co-gestion et partenariats');
  if (score_axe7 < 3.0) axes_faibles.push('Contribution à la qualité de l\'éducation');
  if (score_axe8 < 3.0) axes_faibles.push('Santé, protection de l\'enfant et inclusion');
  if (score_axe9 < 3.0) axes_faibles.push('Participation communautaire');
  if (score_axe10 < 3.0) axes_faibles.push('Genre et représentativité');
  if (score_axe11 < 3.0) axes_faibles.push('Résilience et durabilité');
  if (score_axe12 < 3.0) axes_faibles.push('Formation et capacités des membres');

  return {
    id: `score_${evaluationId}`,
    evaluation_id: evaluationId,
    score_global,
    classification,
    taux_disponibilite_preuves,
    axes_faibles,
    score_axe1,
    score_axe2,
    score_axe3,
    score_axe4,
    score_axe5,
    score_axe6,
    score_axe7,
    score_axe8,
    score_axe9,
    score_axe10,
    score_axe11,
    score_axe12
  };
}

const STORAGE_KEY_PREFIX = 'erof_coges_db_';

function getStoredItem<T>(key: string, defaultValue: T): T {
  const fullKey = STORAGE_KEY_PREFIX + key;
  const raw = localStorage.getItem(fullKey);
  if (!raw) {
    localStorage.setItem(fullKey, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    return defaultValue;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
}

const SEEDED_EVALUATIONS: Evaluation[] = [
  {
    id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
    etablissement_id: 'etab_01',
    coges_id: 'coges_01',
    campagne_id: 'camp_2026',
    enqueteur_id: 'user_enqueteur_01',
    date_collecte: '2026-07-01',
    statut: 'valide',
    president_nom: 'M. Mamadou Konaté',
    president_contact: '0102030405',
    conseiller_nom: 'Mme Aminata Sylla',
    conseiller_contact: '0506070809',
    conseiller_email: 'aminata.sylla@mena.ci',
    historique_creation: 'Le COGES a été créé en 1995 à l\'initiative des parents d\'élèves pour faire face au manque de salles de classe. Il a été redynamisé en 2025.',
    observations_generales: 'Excellente mobilisation du Bureau Exécutif. Les registres financiers sont bien tenus.',
    effectif_total: 540,
    effectif_filles: 280,
    effectif_garcons: 260,
    submitted_at: '2026-07-02T10:00:00Z',
    validated_by: 'user_admin',
    validated_at: '2026-07-03T14:30:00Z',
    locked: true,
    created_by: 'user_enqueteur_01',
    created_at: '2026-07-01T08:00:00Z'
  },
  {
    id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035',
    etablissement_id: 'etab_02',
    coges_id: 'coges_02',
    campagne_id: 'camp_2026',
    enqueteur_id: 'user_enqueteur_01',
    date_collecte: '2026-07-05',
    statut: 'soumis',
    president_nom: 'M. Koffi Yao',
    president_contact: '0707070707',
    conseiller_nom: 'M. Soro Kafalo',
    conseiller_contact: '0101010101',
    conseiller_email: 'soro.kafalo@mena.ci',
    historique_creation: 'Créé en 2000. Fonctionne difficilement suite à des dissensions internes résolues récemment.',
    observations_generales: 'Bureau d\'élèves très motivé, mais manque de formation sur les rôles financiers.',
    effectif_total: 320,
    effectif_filles: 150,
    effectif_garcons: 170,
    submitted_at: '2026-07-06T11:20:00Z',
    locked: false,
    created_by: 'user_enqueteur_01',
    created_at: '2026-07-05T09:00:00Z'
  },
  {
    id: 'a062828b-b6fb-45eb-92f7-b7e3e2d6fa21',
    etablissement_id: 'etab_03',
    coges_id: 'coges_03',
    campagne_id: 'camp_2026',
    enqueteur_id: 'user_enqueteur_01',
    date_collecte: '2026-07-10',
    statut: 'brouillon',
    president_nom: 'Mme Florence Diallo',
    president_contact: '0505050505',
    conseiller_nom: 'M. Tanoh Marc',
    conseiller_contact: '0707080910',
    conseiller_email: 'tanoh.marc@mena.ci',
    historique_creation: 'Nouveau COGES installé récemment dans le quartier résidentiel.',
    effectif_total: 600,
    effectif_filles: 310,
    effectif_garcons: 290,
    locked: false,
    created_by: 'user_enqueteur_01',
    created_at: '2026-07-10T08:15:00Z'
  }
];

const SEEDED_REPONSES: EvaluationReponse[] = [
  { id: 'r1', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '3.2', reponse_valeur: '5' },
  { id: 'r2', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '4.1', reponse_valeur: '5' },
  { id: 'r3', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '4.2', reponse_valeur: '4' },
  { id: 'r4', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '4.3', reponse_valeur: '5' },
  { id: 'r5', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.1', reponse_valeur: '5' },
  { id: 'r6', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.2', reponse_valeur: '4' },
  { id: 'r7', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.3', reponse_valeur: '4' },
  { id: 'r8', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.4', reponse_valeur: '4' },
  { id: 'r9', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.5', reponse_valeur: '2' },
  { id: 'r10', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.6', reponse_valeur: '5' },
  { id: 'r11', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.7', reponse_valeur: '5' },
  { id: 'r12', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.8', reponse_valeur: '5' },
  { id: 'r13', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '5.9', reponse_valeur: '5' },
  { id: 'r14', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.1', reponse_valeur: '5' },
  { id: 'r15', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.2', reponse_valeur: '4' },
  { id: 'r16', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.3', reponse_valeur: '5' },
  { id: 'r17', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.4', reponse_valeur: '5' },
  { id: 'r18', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.5', reponse_valeur: '5' },
  { id: 'r19', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '6.6', reponse_valeur: '5' },
  { id: 'r20', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '7.1', reponse_valeur: '5' },
  { id: 'r21', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.1', reponse_valeur: '5' },
  { id: 'r22', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.2', reponse_valeur: '4' },
  { id: 'r23', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.3', reponse_valeur: '5' },
  { id: 'r24', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.4', reponse_valeur: '5' },
  { id: 'r25', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.5', reponse_valeur: '4' },
  { id: 'r26', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '8.6', reponse_valeur: '5' },
  { id: 'r27', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.1', reponse_valeur: '4' },
  { id: 'r28', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.2', reponse_valeur: '5' },
  { id: 'r29', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.3', reponse_valeur: '4' },
  { id: 'r30', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.4', reponse_valeur: '5' },
  { id: 'r31', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.5', reponse_valeur: '5' },
  { id: 'r32', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.6', reponse_valeur: '5' },
  { id: 'r33', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '9.7', reponse_valeur: '4' },
  { id: 'r34', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.1', reponse_valeur: '5' },
  { id: 'r35', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.2', reponse_valeur: '5' },
  { id: 'r36', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.3', reponse_valeur: '5' },
  { id: 'r37', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.4', reponse_valeur: '4' },
  { id: 'r38', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.5', reponse_valeur: '5' },
  { id: 'r39', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '10.6', reponse_valeur: '5' },
  { id: 'r40', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '11.1', reponse_valeur: '5' },
  { id: 'r41', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '12.1', reponse_valeur: '5' },
  { id: 'r42', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '12.2', reponse_valeur: '5' },
  { id: 'r43', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '13.1', reponse_valeur: '5' },
  { id: 'r44', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '13.2', reponse_valeur: '5' },
  { id: 'r45', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '14.1', reponse_valeur: '4' },
  { id: 'r46', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', question_code: '15.1', reponse_valeur: '4' },

  { id: 'r101', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '3.2', reponse_valeur: '3' },
  { id: 'r102', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '4.1', reponse_valeur: '3' },
  { id: 'r103', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '4.2', reponse_valeur: '2' },
  { id: 'r104', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '4.3', reponse_valeur: '3' },
  { id: 'r105', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.1', reponse_valeur: '2' },
  { id: 'r106', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.2', reponse_valeur: '3' },
  { id: 'r107', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.3', reponse_valeur: '1' },
  { id: 'r108', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.4', reponse_valeur: '2' },
  { id: 'r109', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.5', reponse_valeur: '2' },
  { id: 'r110', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.6', reponse_valeur: '3' },
  { id: 'r111', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.7', reponse_valeur: '4' },
  { id: 'r112', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.8', reponse_valeur: '2' },
  { id: 'r113', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '5.9', reponse_valeur: '3' },
  { id: 'r114', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.1', reponse_valeur: '3' },
  { id: 'r115', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.2', reponse_valeur: '3' },
  { id: 'r116', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.3', reponse_valeur: '2' },
  { id: 'r117', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.4', reponse_valeur: '3' },
  { id: 'r118', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.5', reponse_valeur: '2' },
  { id: 'r119', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '6.6', reponse_valeur: '3' },
  { id: 'r120', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '7.1', reponse_valeur: '3' },
  { id: 'r121', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.1', reponse_valeur: '2' },
  { id: 'r122', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.2', reponse_valeur: '2' },
  { id: 'r123', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.3', reponse_valeur: '2' },
  { id: 'r124', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.4', reponse_valeur: '3' },
  { id: 'r125', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.5', reponse_valeur: '2' },
  { id: 'r126', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '8.6', reponse_valeur: '3' },
  { id: 'r127', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.1', reponse_valeur: '2' },
  { id: 'r128', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.2', reponse_valeur: '3' },
  { id: 'r129', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.3', reponse_valeur: '2' },
  { id: 'r130', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.4', reponse_valeur: '3' },
  { id: 'r131', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.5', reponse_valeur: '2' },
  { id: 'r132', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.6', reponse_valeur: '3' },
  { id: 'r133', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '9.7', reponse_valeur: '2' },
  { id: 'r134', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.1', reponse_valeur: '3' },
  { id: 'r135', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.2', reponse_valeur: '3' },
  { id: 'r136', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.3', reponse_valeur: '2' },
  { id: 'r137', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.4', reponse_valeur: '2' },
  { id: 'r138', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.5', reponse_valeur: '3' },
  { id: 'r139', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '10.6', reponse_valeur: '2' },
  { id: 'r140', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '11.1', reponse_valeur: '3' },
  { id: 'r141', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '12.1', reponse_valeur: '3' },
  { id: 'r142', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '12.2', reponse_valeur: '2' },
  { id: 'r143', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '13.1', reponse_valeur: '3' },
  { id: 'r144', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '13.2', reponse_valeur: '2' },
  { id: 'r145', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '14.1', reponse_valeur: '2' },
  { id: 'r146', evaluation_id: 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035', question_code: '15.1', reponse_valeur: '1' }
];

const SEEDED_MEMBRES_BE: MembreBe[] = [
  {
    id: 'm1_1',
    evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
    nom_prenoms: 'M. Mamadou Konaté',
    genre: 'homme',
    fonction: 'president',
    lit_ecrit_francais: true,
    lit_ecrit_langue_locale: true,
    niveau_etude: 'superieur',
    profession: 'Enseignant retraité',
    formation_coges: true,
    module_formation: 'Gestion administrative & financière',
    maitrise_role: 'bonne'
  },
  {
    id: 'm1_2',
    evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
    nom_prenoms: 'Mme Florence Kouadio',
    genre: 'femme',
    fonction: 'vice_president',
    lit_ecrit_francais: true,
    lit_ecrit_langue_locale: false,
    niveau_etude: 'secondaire_2nd_cycle',
    profession: 'Commerçante',
    formation_coges: true,
    module_formation: 'Rôle des femmes dans les COGES',
    maitrise_role: 'bonne'
  },
  {
    id: 'm1_3',
    evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
    nom_prenoms: 'M. Ibrahim Sylla',
    genre: 'homme',
    fonction: 'secretaire_general',
    lit_ecrit_francais: true,
    lit_ecrit_langue_locale: false,
    niveau_etude: 'superieur',
    profession: 'Planteur',
    formation_coges: true,
    module_formation: 'Secrétariat et rédaction de PV',
    maitrise_role: 'bonne'
  },
  {
    id: 'm1_4',
    evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
    nom_prenoms: 'Mlle Aminata Touré',
    genre: 'femme',
    fonction: 'eleve',
    lit_ecrit_francais: true,
    lit_ecrit_langue_locale: false,
    niveau_etude: 'primaire',
    profession: 'Élève CM2',
    formation_coges: false,
    maitrise_role: 'bonne'
  }
];

const DOCUMENT_NAMES = [
  "Textes réglementaires",
  "Règlement intérieur",
  "Liste actualisée des membres du Bureau Exécutif",
  "PV de la dernière AG élective",
  "PV des réunions du Bureau Exécutif",
  "Liste de présence aux réunions",
  "PACC",
  "Budget annuel",
  "Rapport d'activités",
  "Rapport financier",
  "Bilan financier",
  "Journal de caisse",
  "Journal de banque",
  "Registre des biens",
  "RIB ou document bancaire",
  "Carnet d'activités et de retrait",
  "Cahier de visite",
  "Preuves d'appuis reçus des partenaires",
  "Documents relatifs aux AGR",
  "Documents liés aux actions de protection de l'enfant ou de santé scolaire"
];

function seedPreuves(evalId: string, isFull = true): PreuveDocumentaire[] {
  return DOCUMENT_NAMES.map((name, index) => {
    const isCritical = [0, 1, 3, 6, 7, 8, 9, 10, 11, 12, 14, 13].includes(index);
    const statut = isFull 
      ? ('disponible_consultee' as const) 
      : isCritical 
        ? ('declaree_non_presentee' as const) 
        : ('non_disponible' as const);

    return {
      id: `p_${evalId}_${index}`,
      evaluation_id: evalId,
      type_preuve: name,
      statut: statut,
      commentaire: isFull ? 'Vérifié avec succès.' : 'Déclaré par le président mais pièce physique introuvable.',
      fichier_path: isFull ? `preuves-erof/${evalId}/document_${index}.pdf` : undefined,
      fichier_nom_original: isFull ? `preuve_${name.toLowerCase().replace(/\s+/g, '_')}.pdf` : undefined,
      uploaded_at: isFull ? '2026-07-02T09:15:00Z' : undefined
    };
  });
}

// LOCAL DEMO STORAGE SERVICE
export class LocalDemoService {
  static getSessionUser(): User | null {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + 'current_session_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch (e) {
      return null;
    }
  }

  static setSessionUser(user: User): void {
    setStoredItem<User>('current_session_user', user);
  }

  static clearSessionUser(): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'current_session_user');
  }

  static initialize(): void {
    getStoredItem<Drena[]>('drenas', PRE_SEEDED_DRENAS);
    getStoredItem<Iepp[]>('iepps', PRE_SEEDED_IEPPS);
    getStoredItem<Etablissement[]>('etablissements', PRE_SEEDED_ETABLISSEMENTS);
    getStoredItem<Coges[]>('coges', PRE_SEEDED_COGES);
    getStoredItem<Campagne[]>('campagnes', PRE_SEEDED_CAMPAGNES);
    getStoredItem<User[]>('users', PRE_SEEDED_USERS);
    
    const evals = getStoredItem<Evaluation[]>('evaluations', SEEDED_EVALUATIONS);
    const reps = getStoredItem<EvaluationReponse[]>('reponses', SEEDED_REPONSES);
    const members = getStoredItem<MembreBe[]>('membres_be', SEEDED_MEMBRES_BE);
    
    const savedPreuves = getStoredItem<PreuveDocumentaire[]>('preuves', []);
    if (savedPreuves.length === 0) {
      const allPreuves = [
        ...seedPreuves('8cb3850b-4171-460d-a0e4-b78f87e6fa56', true),
        ...seedPreuves('cd4e9d01-ffb0-461d-8473-b26a6c1bf035', false),
        ...seedPreuves('a062828b-b6fb-45eb-92f7-b7e3e2d6fa21', false)
      ];
      setStoredItem<PreuveDocumentaire[]>('preuves', allPreuves);
    }

    const savedScores = getStoredItem<EvaluationScore[]>('scores', []);
    if (savedScores.length === 0) {
      const initialScores = [
        computeEvaluationScores('8cb3850b-4171-460d-a0e4-b78f87e6fa56', reps.filter(r => r.evaluation_id === '8cb3850b-4171-460d-a0e4-b78f87e6fa56'), members.filter(m => m.evaluation_id === '8cb3850b-4171-460d-a0e4-b78f87e6fa56'), seedPreuves('8cb3850b-4171-460d-a0e4-b78f87e6fa56', true)),
        computeEvaluationScores('cd4e9d01-ffb0-461d-8473-b26a6c1bf035', reps.filter(r => r.evaluation_id === 'cd4e9d01-ffb0-461d-8473-b26a6c1bf035'), [], seedPreuves('cd4e9d01-ffb0-461d-8473-b26a6c1bf035', false))
      ];
      setStoredItem<EvaluationScore[]>('scores', initialScores);
    }

    getStoredItem<EquipeEvaluation[]>('equipes', [
      { id: 'eq_1', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', nom_prenoms: 'Jean-Pierre Touré', fonction_structure: 'Enquêteur Principal / DAPS-COGES' },
      { id: 'eq_2', evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56', nom_prenoms: 'Awa Diomandé', fonction_structure: 'Superviseur National' }
    ]);

    getStoredItem<Recommandation[]>('recommandations', [
      {
        id: 'rec_demo_01',
        evaluation_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
        forces: '1. Bureau très actif et dynamique\n2. Mobilisation communautaire exceptionnelle\n3. Clarté des rapports financiers',
        faiblesses: '1. Faible participation des élèves dans les prises de décision\n2. Manque de formation sur les modules de résilience\n3. Salles de classe encore surchargées',
        difficultes: 'Difficulté à mobiliser des appuis extérieurs hors cotisations locales.',
        actions_urgentes: '1. Organiser une séance de renforcement de capacités des membres sur la planification.\n2. Renforcer le pouvoir de décision du comité élèves.',
        appuis_attendus: 'Plaidoyer auprès de la Mairie pour l\'obtention d\'un budget d\'entretien.',
        recommandations_prioritaires: '1. Accompagner le COGES dans le démarrage de son AGR agricole.\n2. Équiper la bibliothèque en livres.'
      }
    ]);

    getStoredItem<AuditLog[]>('audit_logs', [
      {
        id: 'log_01',
        user_id: 'user_enqueteur_01',
        action: 'Création de l\'évaluation',
        table_cible: 'evaluations',
        ligne_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
        created_at: '2026-07-01T08:00:00Z'
      },
      {
        id: 'log_02',
        user_id: 'user_admin',
        action: 'Validation finale',
        table_cible: 'evaluations',
        ligne_id: '8cb3850b-4171-460d-a0e4-b78f87e6fa56',
        created_at: '2026-07-03T14:30:00Z'
      }
    ]);
  }

  static async getDrenas(): Promise<Drena[]> {
    return getStoredItem<Drena[]>('drenas', []);
  }

  static async getIepps(drenaId?: string): Promise<Iepp[]> {
    const iepps = getStoredItem<Iepp[]>('iepps', []);
    return drenaId ? iepps.filter(i => i.drena_id === drenaId) : iepps;
  }

  static async getEtablissements(ieppId?: string): Promise<Etablissement[]> {
    const etabs = getStoredItem<Etablissement[]>('etablissements', []);
    return ieppId ? etabs.filter(e => e.iepp_id === ieppId) : etabs;
  }

  static async getCoges(etablissementId: string): Promise<Coges | null> {
    const cogesList = getStoredItem<Coges[]>('coges', []);
    return cogesList.find(c => c.etablissement_id === etablissementId) || null;
  }

  static async getCampagnes(): Promise<Campagne[]> {
    return getStoredItem<Campagne[]>('campagnes', []);
  }

  static async getEvaluations(user: User): Promise<(Evaluation & { etablissement_nom?: string; drena_nom?: string; iepp_nom?: string; score_global?: number; classification?: string; scores?: any })[]> {
    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    const etabs = getStoredItem<Etablissement[]>('etablissements', []);
    const iepps = getStoredItem<Iepp[]>('iepps', []);
    const drenas = getStoredItem<Drena[]>('drenas', []);
    const scores = getStoredItem<EvaluationScore[]>('scores', []);

    let rawEvals = evals.map(ev => {
      const etab = etabs.find(e => e.id === ev.etablissement_id);
      const iepp = etab ? iepps.find(i => i.id === etab.iepp_id) : undefined;
      const drena = iepp ? drenas.find(d => d.id === iepp.drena_id) : undefined;
      const sc = scores.find(s => s.evaluation_id === ev.id);

      return {
        ...ev,
        etablissement_nom: etab?.nom,
        iepp_nom: iepp?.nom,
        drena_nom: drena?.nom,
        score_global: sc?.score_global,
        classification: sc?.classification,
        scores: sc
      };
    });

    if (user.role === 'enqueteur') {
      return rawEvals.filter(e => e.enqueteur_id === user.id);
    } else if (user.role === 'superviseur_iepp') {
      const userIeppId = user.iepp_id;
      const ieppEtabs = etabs.filter(e => e.iepp_id === userIeppId).map(e => e.id);
      return rawEvals.filter(e => ieppEtabs.includes(e.etablissement_id));
    } else if (user.role === 'superviseur_drena') {
      const userDrenaId = user.drena_id;
      const drenaIepps = iepps.filter(i => i.drena_id === userDrenaId).map(i => i.id);
      const drenaEtabs = etabs.filter(e => drenaIepps.includes(e.iepp_id)).map(e => e.id);
      return rawEvals.filter(e => drenaEtabs.includes(e.etablissement_id));
    }

    return rawEvals;
  }

  static async getEvaluationDetails(id: string): Promise<{
    evaluation: Evaluation & { etablissement?: Etablissement; drena?: Drena; iepp?: Iepp; coges?: Coges };
    reponses: EvaluationReponse[];
    membresBe: MembreBe[];
    equipes: EquipeEvaluation[];
    recommandations: Recommandation | null;
    preuves: PreuveDocumentaire[];
    score: EvaluationScore | null;
  } | null> {
    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    const ev = evals.find(e => e.id === id);
    if (!ev) return null;

    const etabs = getStoredItem<Etablissement[]>('etablissements', []);
    const iepps = getStoredItem<Iepp[]>('iepps', []);
    const drenas = getStoredItem<Drena[]>('drenas', []);
    const cogesList = getStoredItem<Coges[]>('coges', []);

    const etab = etabs.find(e => e.id === ev.etablissement_id);
    const iepp = etab ? iepps.find(i => i.id === etab.iepp_id) : undefined;
    const drena = iepp ? drenas.find(d => d.id === iepp.drena_id) : undefined;
    const cogesObj = cogesList.find(c => c.etablissement_id === ev.etablissement_id);

    const reps = getStoredItem<EvaluationReponse[]>('reponses', []).filter(r => r.evaluation_id === id);
    const members = getStoredItem<MembreBe[]>('membres_be', []).filter(m => m.evaluation_id === id);
    const teams = getStoredItem<EquipeEvaluation[]>('equipes', []).filter(t => t.evaluation_id === id);
    const recList = getStoredItem<Recommandation[]>('recommandations', []);
    const rec = recList.find(r => r.evaluation_id === id) || null;
    const proofs = getStoredItem<PreuveDocumentaire[]>('preuves', []).filter(p => p.evaluation_id === id);
    const scores = getStoredItem<EvaluationScore[]>('scores', []);
    const sc = scores.find(s => s.evaluation_id === id) || null;

    return {
      evaluation: {
        ...ev,
        etablissement: etab,
        iepp: iepp,
        drena: drena,
        coges: cogesObj
      },
      reponses: reps,
      membresBe: members,
      equipes: teams,
      recommandations: rec,
      preuves: proofs,
      score: sc
    };
  }

  static async saveDraft(
    evaluation: Partial<Evaluation> & { id: string },
    reponses: EvaluationReponse[],
    membresBe: MembreBe[],
    equipes: EquipeEvaluation[],
    recommandations: Partial<Recommandation> | null,
    preuves: PreuveDocumentaire[],
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const existingDetails = await this.getEvaluationDetails(evaluation.id);
    if (existingDetails) {
      const currentStatut = existingDetails.evaluation.statut;
      if (currentStatut !== 'brouillon' && currentStatut !== 'en_revision') {
        return { success: false, error: 'Modification impossible: l\'évaluation n\'est plus modifiable (statut: ' + currentStatut + ').' };
      }
    }

    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    const evIndex = evals.findIndex(e => e.id === evaluation.id);
    let updatedEv: Evaluation;
    if (evIndex >= 0) {
      updatedEv = {
        ...evals[evIndex],
        ...evaluation,
        updated_at: now
      } as Evaluation;
      evals[evIndex] = updatedEv;
    } else {
      updatedEv = {
        ...evaluation,
        statut: 'brouillon',
        locked: false,
        created_by: userId,
        created_at: now,
        updated_at: now
      } as Evaluation;
      evals.push(updatedEv);
    }
    setStoredItem<Evaluation[]>('evaluations', evals);

    const allReponses = getStoredItem<EvaluationReponse[]>('reponses', []);
    const filteredReps = allReponses.filter(r => r.evaluation_id !== evaluation.id);
    setStoredItem<EvaluationReponse[]>('reponses', [...filteredReps, ...reponses]);

    const allMembers = getStoredItem<MembreBe[]>('membres_be', []);
    const filteredMembers = allMembers.filter(m => m.evaluation_id !== evaluation.id);
    setStoredItem<MembreBe[]>('membres_be', [...filteredMembers, ...membresBe]);

    const allTeams = getStoredItem<EquipeEvaluation[]>('equipes', []);
    const filteredTeams = allTeams.filter(t => t.evaluation_id !== evaluation.id);
    setStoredItem<EquipeEvaluation[]>('equipes', [...filteredTeams, ...equipes]);

    const allRecs = getStoredItem<Recommandation[]>('recommandations', []);
    const recIndex = allRecs.findIndex(r => r.evaluation_id === evaluation.id);
    if (recommandations) {
      const updatedRec = {
        id: recommandations.id || `rec_${evaluation.id}`,
        evaluation_id: evaluation.id,
        forces: recommandations.forces || '',
        faiblesses: recommandations.faiblesses || '',
        difficultes: recommandations.difficultes || '',
        actions_urgentes: recommandations.actions_urgentes || '',
        appuis_attendus: recommandations.appuis_attendus || '',
        recommandations_prioritaires: recommandations.recommandations_prioritaires || ''
      };
      if (recIndex >= 0) {
        allRecs[recIndex] = updatedRec;
      } else {
        allRecs.push(updatedRec);
      }
      setStoredItem<Recommandation[]>('recommandations', allRecs);
    }

    const allPreuves = getStoredItem<PreuveDocumentaire[]>('preuves', []);
    const otherPreuves = allPreuves.filter(p => p.evaluation_id !== evaluation.id);
    setStoredItem<PreuveDocumentaire[]>('preuves', [...otherPreuves, ...preuves]);

    this.addAuditLog(userId, 'Sauvegarde de brouillon', 'evaluations', evaluation.id);
    return { success: true };
  }

  static async submitEvaluation(id: string, userId: string): Promise<{ success: boolean; errors?: string[] }> {
    const now = new Date().toISOString();

    const details = await this.getEvaluationDetails(id);
    if (!details) {
      return { success: false, errors: ['Évaluation introuvable.'] };
    }

    const { evaluation, reponses, membresBe, preuves } = details;
    const errors: string[] = [];

    if (!evaluation.president_nom) errors.push('Le nom du Président du Bureau Exécutif est obligatoire.');
    if (!evaluation.president_contact || !/^[0-9]{10}$/.test(evaluation.president_contact)) {
      errors.push('Le numéro de téléphone du Président doit comporter exactement 10 chiffres.');
    }
    if (!evaluation.conseiller_nom) errors.push('Le nom du Conseiller chargé des COGES est obligatoire.');
    if (!evaluation.conseiller_contact || !/^[0-9]{10}$/.test(evaluation.conseiller_contact)) {
      errors.push('Le numéro de téléphone du Conseiller doit comporter exactement 10 chiffres.');
    }
    if (!evaluation.conseiller_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(evaluation.conseiller_email)) {
      errors.push('L\'adresse e-mail du Conseiller est invalide.');
    }

    if (evaluation.effectif_total !== ((evaluation.effectif_filles || 0) + (evaluation.effectif_garcons || 0))) {
      errors.push(`Incohérence effectif: Effectif total (${evaluation.effectif_total}) doit être égal à Filles (${evaluation.effectif_filles || 0}) + Garçons (${evaluation.effectif_garcons || 0}).`);
    }

    const expectedCodes = [
      '3.2', '4.1', '4.2', '4.3', '5.1', '5.2', '5.4', '5.6', '5.7', '5.8', '5.9',
      '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '7.1', '8.1', '8.2', '8.3', '8.4', '8.5', '8.6',
      '9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6',
      '11.1', '12.1', '12.2', '13.1', '13.2', '14.1', '15.1'
    ];

    const answerMap = new Map<string, string>();
    reponses.forEach(r => answerMap.set(r.question_code, r.reponse_valeur));

    expectedCodes.forEach(code => {
      if (!answerMap.has(code) || !answerMap.get(code)) {
        errors.push(`La question ${code} est obligatoire et n'a pas été renseignée.`);
      }
    });

    const criticalPreuvesRules = [
      { code: '3.2', docName: 'Textes réglementaires' },
      { code: '5.1', docName: 'Règlement intérieur' },
      { code: '5.7', docName: 'PV de la dernière AG élective' },
      { code: '9.1', docName: 'PACC' },
      { code: '9.2', docName: 'Budget annuel' },
      { code: '9.4', docName: "Rapport d'activités" },
      { code: '9.5', docName: 'Rapport financier' },
      { code: '9.6', docName: 'Bilan financier' },
      { code: '8.2', docName: 'Journal de caisse' },
      { code: '8.3', docName: 'Journal de banque' },
      { code: '8.1', docName: 'RIB ou document bancaire' },
      { code: '8.4', docName: 'Registre des biens' }
    ];

    criticalPreuvesRules.forEach(rule => {
      const rating = parseInt(answerMap.get(rule.code) || '0', 10);
      if (rating >= 4) {
        const pDoc = preuves.find(p => p.type_preuve === rule.docName);
        const hasValidDoc = pDoc && pDoc.statut === 'disponible_consultee';
        const hasExplanation = pDoc && pDoc.commentaire && pDoc.commentaire.trim().length > 5;
        
        if (!hasValidDoc && !hasExplanation) {
          errors.push(
            `Preuve critique requise: La note de la question ${rule.code} vaut ${rating} (≥ 4), vous devez obligatoirement fournir le document "${rule.docName}" au statut "Disponible et consultée" dans la Section 17, ou saisir une explication justificative détaillée dans le commentaire de la preuve.`
          );
        }
      }
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const finalScore = computeEvaluationScores(id, reponses, membresBe, preuves);

    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    const evIndex = evals.findIndex(e => e.id === id);
    if (evIndex >= 0) {
      evals[evIndex] = {
        ...evals[evIndex],
        statut: 'soumis',
        submitted_at: now,
        updated_at: now
      };
      setStoredItem<Evaluation[]>('evaluations', evals);
    }

    const allScores = getStoredItem<EvaluationScore[]>('scores', []);
    const scIndex = allScores.findIndex(s => s.evaluation_id === id);
    if (scIndex >= 0) {
      allScores[scIndex] = finalScore;
    } else {
      allScores.push(finalScore);
    }
    setStoredItem<EvaluationScore[]>('scores', allScores);

    this.addAuditLog(userId, 'Soumission définitive', 'evaluations', id);
    return { success: true };
  }

  static async updateStatus(
    id: string,
    newStatus: EvaluationStatus,
    comment: string | undefined,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    const evIndex = evals.findIndex(e => e.id === id);
    let auditApres: any = { statut: newStatus };

    if (evIndex >= 0) {
      const updatedEval = {
        ...evals[evIndex],
        statut: newStatus,
        validated_by: (newStatus === 'valide' || newStatus === 'rejete') ? userId : evals[evIndex].validated_by,
        validated_at: (newStatus === 'valide' || newStatus === 'rejete') ? now : evals[evIndex].validated_at,
        locked: newStatus === 'verrouille' ? true : evals[evIndex].locked,
        updated_at: now
      } as any;

      if (comment) {
        if ('rejected_reason' in updatedEval) {
          updatedEval.rejected_reason = comment;
        } else if ('supervision_comment' in updatedEval) {
          updatedEval.supervision_comment = comment;
        } else if ('motif_revision' in updatedEval) {
          updatedEval.motif_revision = comment;
        } else {
          auditApres.supervision_comment = comment;
        }
      }

      evals[evIndex] = updatedEval;
      setStoredItem<Evaluation[]>('evaluations', evals);
    }

    this.addAuditLog(userId, `Changement de statut vers ${newStatus}`, 'evaluations', id, null, auditApres);
    return { success: true };
  }

  static async uploadPreuveFile(
    evaluationId: string,
    typePreuve: string,
    file: File
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const fileNameClean = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    return {
      success: true,
      filePath: `preuves-erof/${evaluationId}/${fileNameClean}`
    };
  }

  static addAuditLog(
    userId: string,
    action: string,
    tableCible: string,
    ligneId: string,
    donneesAvant?: any,
    donneesApres?: any
  ): void {
    const logs = getStoredItem<AuditLog[]>('audit_logs', []);
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      user_id: userId,
      action,
      table_cible: tableCible,
      ligne_id: ligneId,
      donnees_avant: donneesAvant,
      donnees_apres: donneesApres,
      created_at: new Date().toISOString()
    };
    logs.unshift(newLog);
    setStoredItem<AuditLog[]>('audit_logs', logs);
  }

  static async getAuditLogs(): Promise<AuditLog[]> {
    return getStoredItem<AuditLog[]>('audit_logs', []);
  }
}

// REAL SUPABASE PRODUCTION STORAGE SERVICE
export class SupabaseDataService {
  static async getDrenas(): Promise<Drena[]> {
    const { data, error } = await supabase!
      .from('drenas')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  static async getIepps(drenaId?: string): Promise<Iepp[]> {
    let query = supabase!.from('iepps').select('*');
    if (drenaId) {
      query = query.eq('drena_id', drenaId);
    }
    const { data, error } = await query.order('nom');
    if (error) throw error;
    return data || [];
  }

  static async getEtablissements(ieppId?: string): Promise<Etablissement[]> {
    let query = supabase!.from('etablissements').select('*');
    if (ieppId) {
      query = query.eq('iepp_id', ieppId);
    }
    const { data, error } = await query.order('nom');
    if (error) throw error;
    return data || [];
  }

  static async getCoges(etablissementId: string): Promise<Coges | null> {
    const { data, error } = await supabase!
      .from('coges')
      .select('*')
      .eq('etablissement_id', etablissementId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async getCampagnes(): Promise<Campagne[]> {
    const { data, error } = await supabase!
      .from('campagnes')
      .select('*');
    if (error) throw error;
    return data || [];
  }

  static async getEvaluations(user: User): Promise<(Evaluation & { etablissement_nom?: string; drena_nom?: string; iepp_nom?: string; score_global?: number; classification?: string; scores?: any })[]> {
    // In production we query evaluations from Supabase.
    // It will be filtered by RLS policies natively at the database level!
    const { data, error } = await supabase!
      .from('evaluations')
      .select(`
        *,
        etablissements (
          nom,
          iepp_id,
          iepps (
            nom,
            drena_id,
            drenas (
              nom
            )
          )
        ),
        evaluation_scores (
          *
        )
      `);
    
    if (error) throw error;

    return (data || []).map((d: any) => {
      const etab = d.etablissements;
      const iepp = etab?.iepps;
      const drena = iepp?.drenas;
      const scoreObj = d.evaluation_scores?.[0] || d.evaluation_scores;
      const score_global = Array.isArray(scoreObj) ? scoreObj[0]?.score_global : scoreObj?.score_global;
      const classification = Array.isArray(scoreObj) ? scoreObj[0]?.classification : scoreObj?.classification;

      return {
        ...d,
        etablissement_nom: etab?.nom,
        iepp_nom: iepp?.nom,
        drena_nom: drena?.nom,
        score_global: score_global,
        classification: classification,
        scores: Array.isArray(scoreObj) ? scoreObj[0] : scoreObj
      };
    });
  }

  static async getEvaluationDetails(id: string): Promise<{
    evaluation: Evaluation & { etablissement?: Etablissement; drena?: Drena; iepp?: Iepp; coges?: Coges };
    reponses: EvaluationReponse[];
    membresBe: MembreBe[];
    equipes: EquipeEvaluation[];
    recommandations: Recommandation | null;
    preuves: PreuveDocumentaire[];
    score: EvaluationScore | null;
  } | null> {
    const { data: ev, error: evError } = await supabase!
      .from('evaluations')
      .select('*, etablissements(*), coges(*)')
      .eq('id', id)
      .maybeSingle();

    if (evError) throw evError;
    if (!ev) return null;

    // Get cascading details of IEPP/DRENA
    let ieppObj: Iepp | undefined;
    let drenaObj: Drena | undefined;
    if (ev.etablissements && ev.etablissements.iepp_id) {
      const { data: iepp } = await supabase!.from('iepps').select('*').eq('id', ev.etablissements.iepp_id).maybeSingle();
      if (iepp) {
        ieppObj = iepp;
        const { data: drena } = await supabase!.from('drenas').select('*').eq('id', iepp.drena_id).maybeSingle();
        if (drena) drenaObj = drena;
      }
    }

    const [reps, members, teams, recs, proofs, sc] = await Promise.all([
      supabase!.from('evaluation_reponses').select('*').eq('evaluation_id', id),
      supabase!.from('membres_be').select('*').eq('evaluation_id', id),
      supabase!.from('equipes_evaluation').select('*').eq('evaluation_id', id),
      supabase!.from('recommandations').select('*').eq('evaluation_id', id).maybeSingle(),
      supabase!.from('preuves_documentaires').select('*').eq('evaluation_id', id),
      supabase!.from('evaluation_scores').select('*').eq('evaluation_id', id).maybeSingle()
    ]);

    if (reps.error) throw reps.error;
    if (members.error) throw members.error;
    if (teams.error) throw teams.error;
    if (recs.error) throw recs.error;
    if (proofs.error) throw proofs.error;
    if (sc.error) throw sc.error;

    return {
      evaluation: {
        ...ev,
        etablissement: ev.etablissements || undefined,
        coges: ev.coges || undefined,
        iepp: ieppObj,
        drena: drenaObj
      },
      reponses: reps.data || [],
      membresBe: members.data || [],
      equipes: teams.data || [],
      recommandations: recs.data || null,
      preuves: proofs.data || [],
      score: sc.data || null
    };
  }

  static async saveDraft(
    evaluation: Partial<Evaluation> & { id: string },
    reponses: EvaluationReponse[],
    membresBe: MembreBe[],
    equipes: EquipeEvaluation[],
    recommandations: Partial<Recommandation> | null,
    preuves: PreuveDocumentaire[],
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const existingDetails = await this.getEvaluationDetails(evaluation.id);
    if (existingDetails) {
      const currentStatut = existingDetails.evaluation.statut;
      if (currentStatut !== 'brouillon' && currentStatut !== 'en_revision') {
        return { success: false, error: 'Modification impossible: l\'évaluation n\'est plus modifiable (statut: ' + currentStatut + ').' };
      }
    }

    // Save core evaluation
    const { error: evErr } = await supabase!.from('evaluations').upsert({
      id: evaluation.id,
      etablissement_id: evaluation.etablissement_id,
      coges_id: evaluation.coges_id,
      campagne_id: evaluation.campagne_id,
      enqueteur_id: evaluation.enqueteur_id,
      date_collecte: evaluation.date_collecte,
      statut: evaluation.statut || 'brouillon',
      president_nom: evaluation.president_nom,
      president_contact: evaluation.president_contact,
      conseiller_nom: evaluation.conseiller_nom,
      conseiller_contact: evaluation.conseiller_contact,
      conseiller_email: evaluation.conseiller_email,
      historique_creation: evaluation.historique_creation,
      observations_generales: evaluation.observations_generales,
      effectif_total: evaluation.effectif_total || 0,
      effectif_filles: evaluation.effectif_filles || 0,
      effectif_garcons: evaluation.effectif_garcons || 0,
      created_by: evaluation.created_by || userId,
      created_at: evaluation.created_at || now,
      updated_at: now
    });
    if (evErr) return { success: false, error: 'Erreur de sauvegarde d\'évaluation: ' + evErr.message };

    // Batch upserts of related entities
    if (reponses.length > 0) {
      const { error: repErr } = await supabase!.from('evaluation_reponses').upsert(reponses);
      if (repErr) return { success: false, error: 'Erreur de sauvegarde des réponses: ' + repErr.message };
    }
    if (membresBe.length > 0) {
      const { error: memErr } = await supabase!.from('membres_be').upsert(membresBe);
      if (memErr) return { success: false, error: 'Erreur de sauvegarde du BE: ' + memErr.message };
    }
    if (equipes.length > 0) {
      const { error: eqErr } = await supabase!.from('equipes_evaluation').upsert(equipes);
      if (eqErr) return { success: false, error: 'Erreur de sauvegarde de l\'équipe: ' + eqErr.message };
    }
    if (recommandations) {
      const { error: recErr } = await supabase!.from('recommandations').upsert({
        id: recommandations.id,
        evaluation_id: evaluation.id,
        forces: recommandations.forces || '',
        faiblesses: recommandations.faiblesses || '',
        difficultes: recommandations.difficultes || '',
        actions_urgentes: recommandations.actions_urgentes || '',
        appuis_attendus: recommandations.appuis_attendus || '',
        recommandations_prioritaires: recommandations.recommandations_prioritaires || ''
      });
      if (recErr) return { success: false, error: 'Erreur de sauvegarde des recommandations: ' + recErr.message };
    }
    if (preuves.length > 0) {
      const { error: prfErr } = await supabase!.from('preuves_documentaires').upsert(preuves);
      if (prfErr) return { success: false, error: 'Erreur de sauvegarde des preuves: ' + prfErr.message };
    }

    try {
      await this.addAuditLog(userId, 'Sauvegarde de brouillon', 'evaluations', evaluation.id);
    } catch (_) {}

    return { success: true };
  }

  static async submitEvaluation(id: string, userId: string): Promise<{ success: boolean; errors?: string[] }> {
    const now = new Date().toISOString();

    const details = await this.getEvaluationDetails(id);
    if (!details) {
      return { success: false, errors: ['Évaluation introuvable.'] };
    }

    const { evaluation, reponses, membresBe, preuves } = details;
    const errors: string[] = [];

    if (!evaluation.president_nom) errors.push('Le nom du Président du Bureau Exécutif est obligatoire.');
    if (!evaluation.president_contact || !/^[0-9]{10}$/.test(evaluation.president_contact)) {
      errors.push('Le numéro de téléphone du Président doit comporter exactement 10 chiffres.');
    }
    if (!evaluation.conseiller_nom) errors.push('Le nom du Conseiller chargé des COGES est obligatoire.');
    if (!evaluation.conseiller_contact || !/^[0-9]{10}$/.test(evaluation.conseiller_contact)) {
      errors.push('Le numéro de téléphone du Conseiller doit comporter exactement 10 chiffres.');
    }
    if (!evaluation.conseiller_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(evaluation.conseiller_email)) {
      errors.push('L\'adresse e-mail du Conseiller est invalide.');
    }

    if (evaluation.effectif_total !== ((evaluation.effectif_filles || 0) + (evaluation.effectif_garcons || 0))) {
      errors.push(`Incohérence effectif: Effectif total (${evaluation.effectif_total}) doit être égal à Filles (${evaluation.effectif_filles || 0}) + Garçons (${evaluation.effectif_garcons || 0}).`);
    }

    const expectedCodes = [
      '3.2', '4.1', '4.2', '4.3', '5.1', '5.2', '5.4', '5.6', '5.7', '5.8', '5.9',
      '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '7.1', '8.1', '8.2', '8.3', '8.4', '8.5', '8.6',
      '9.1', '9.2', '9.3', '9.4', '9.5', '9.6', '9.7', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6',
      '11.1', '12.1', '12.2', '13.1', '13.2', '14.1', '15.1'
    ];

    const answerMap = new Map<string, string>();
    reponses.forEach(r => answerMap.set(r.question_code, r.reponse_valeur));

    expectedCodes.forEach(code => {
      if (!answerMap.has(code) || !answerMap.get(code)) {
        errors.push(`La question ${code} est obligatoire et n'a pas été renseignée.`);
      }
    });

    const criticalPreuvesRules = [
      { code: '3.2', docName: 'Textes réglementaires' },
      { code: '5.1', docName: 'Règlement intérieur' },
      { code: '5.7', docName: 'PV de la dernière AG élective' },
      { code: '9.1', docName: 'PACC' },
      { code: '9.2', docName: 'Budget annuel' },
      { code: '9.4', docName: "Rapport d'activités" },
      { code: '9.5', docName: 'Rapport financier' },
      { code: '9.6', docName: 'Bilan financier' },
      { code: '8.2', docName: 'Journal de caisse' },
      { code: '8.3', docName: 'Journal de banque' },
      { code: '8.1', docName: 'RIB ou document bancaire' },
      { code: '8.4', docName: 'Registre des biens' }
    ];

    criticalPreuvesRules.forEach(rule => {
      const rating = parseInt(answerMap.get(rule.code) || '0', 10);
      if (rating >= 4) {
        const pDoc = preuves.find(p => p.type_preuve === rule.docName);
        const hasValidDoc = pDoc && pDoc.statut === 'disponible_consultee';
        const hasExplanation = pDoc && pDoc.commentaire && pDoc.commentaire.trim().length > 5;
        
        if (!hasValidDoc && !hasExplanation) {
          errors.push(
            `Preuve critique requise: La note de la question ${rule.code} vaut ${rating} (≥ 4), vous devez obligatoirement fournir le document "${rule.docName}" au statut "Disponible et consultée" dans la Section 17, ou saisir une explication justificative détaillée dans le commentaire de la preuve.`
          );
        }
      }
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const { error: evErr } = await supabase!
      .from('evaluations')
      .update({
        statut: 'soumis',
        submitted_at: now,
        updated_at: now
      })
      .eq('id', id);

    if (evErr) return { success: false, errors: ['Erreur lors de la soumission : ' + evErr.message] };

    // Query official scores from Supabase first (in case a database trigger calculated them on status update)
    const { data: officialScore } = await supabase!
      .from('evaluation_scores')
      .select('*')
      .eq('evaluation_id', id)
      .maybeSingle();

    if (!officialScore) {
      // Calculate and save preview score since no database-side calculation was found
      const finalScore = computeEvaluationScores(id, reponses, membresBe, preuves);
      const { error: scoreErr } = await supabase!.from('evaluation_scores').upsert(finalScore);
      if (scoreErr) {
        console.warn('Scoring trigger may be handled natively in database. score_save_warning : ', scoreErr.message);
      }
    }

    try {
      await this.addAuditLog(userId, 'Soumission définitive', 'evaluations', id, evaluation, { ...evaluation, statut: 'soumis', submitted_at: now });
    } catch (_) {}

    return { success: true };
  }

  static async updateStatus(
    id: string,
    newStatus: EvaluationStatus,
    comment: string | undefined,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const updatePayload: any = {
      statut: newStatus,
      updated_at: now
    };
    if (newStatus === 'valide' || newStatus === 'rejete') {
      updatePayload.validated_by = userId;
      updatePayload.validated_at = now;
    }
    if (newStatus === 'verrouille') {
      updatePayload.locked = true;
    }

    let auditApres: any = { statut: newStatus };

    if (comment) {
      // Query the evaluation to see what columns exist
      const { data: currentEval } = await supabase!
        .from('evaluations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (currentEval) {
        if ('rejected_reason' in currentEval) {
          updatePayload.rejected_reason = comment;
        } else if ('supervision_comment' in currentEval) {
          updatePayload.supervision_comment = comment;
        } else if ('motif_revision' in currentEval) {
          updatePayload.motif_revision = comment;
        } else {
          // No dedicated comment columns exist, do not overwrite observations_generales
          // Log comment in audit_logs instead
          auditApres.supervision_comment = comment;
        }
      } else {
        auditApres.supervision_comment = comment;
      }
    }

    const { error: evErr } = await supabase!
      .from('evaluations')
      .update(updatePayload)
      .eq('id', id);

    if (evErr) return { success: false, error: 'Erreur lors du changement de statut: ' + evErr.message };

    try {
      await this.addAuditLog(userId, `Changement statut vers ${newStatus}`, 'evaluations', id, null, auditApres);
    } catch (_) {}

    return { success: true };
  }

  static async uploadPreuveFile(
    evaluationId: string,
    typePreuve: string,
    file: File
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const fileNameClean = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const fullPath = `${evaluationId}/${fileNameClean}`;

    const { data, error } = await supabase!.storage
      .from('preuves-erof')
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      return { success: false, error: 'Échec d\'upload vers le bucket preuves-erof : ' + error.message };
    }
    return { success: true, filePath: data.path };
  }

  static async addAuditLog(
    userId: string,
    action: string,
    tableCible: string,
    ligneId: string,
    donneesAvant?: any,
    donneesApres?: any
  ): Promise<void> {
    const { error } = await supabase!.from('audit_logs').insert({
      user_id: userId,
      action: action,
      table_cible: tableCible,
      ligne_id: ligneId,
      donnees_avant: donneesAvant,
      donnees_apres: donneesApres
    });
    if (error) {
      console.warn('Could not insert audit_log into Supabase: ', error.message);
    }
  }

  static async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase!
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

// UNIFIED EXPORT SERVICE (DATA ROUTER)
export class DataService {
  static getSessionUser(): User | null {
    if (isSupabaseConfigured) {
      // Session user will be loaded directly from Supabase Auth state in React
      throw new Error('Please fetch session user directly from Supabase Auth state in the frontend.');
    }
    return LocalDemoService.getSessionUser();
  }

  static setSessionUser(user: User): void {
    if (!isSupabaseConfigured) {
      LocalDemoService.setSessionUser(user);
    }
  }

  static clearSessionUser(): void {
    if (!isSupabaseConfigured) {
      LocalDemoService.clearSessionUser();
    }
  }

  static initialize(): void {
    if (!isSupabaseConfigured) {
      LocalDemoService.initialize();
    }
  }

  static async getDrenas(): Promise<Drena[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getDrenas();
    }
    return await LocalDemoService.getDrenas();
  }

  static async getIepps(drenaId?: string): Promise<Iepp[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getIepps(drenaId);
    }
    return await LocalDemoService.getIepps(drenaId);
  }

  static async getEtablissements(ieppId?: string): Promise<Etablissement[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getEtablissements(ieppId);
    }
    return await LocalDemoService.getEtablissements(ieppId);
  }

  static async getCoges(etablissementId: string): Promise<Coges | null> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getCoges(etablissementId);
    }
    return await LocalDemoService.getCoges(etablissementId);
  }

  static async getCampagnes(): Promise<Campagne[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getCampagnes();
    }
    return await LocalDemoService.getCampagnes();
  }

  static async getEvaluations(user: User): Promise<(Evaluation & { etablissement_nom?: string; drena_nom?: string; iepp_nom?: string; score_global?: number; classification?: string; scores?: any })[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getEvaluations(user);
    }
    return await LocalDemoService.getEvaluations(user);
  }

  static async getEvaluationDetails(id: string): Promise<{
    evaluation: Evaluation & { etablissement?: Etablissement; drena?: Drena; iepp?: Iepp; coges?: Coges };
    reponses: EvaluationReponse[];
    membresBe: MembreBe[];
    equipes: EquipeEvaluation[];
    recommandations: Recommandation | null;
    preuves: PreuveDocumentaire[];
    score: EvaluationScore | null;
  } | null> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getEvaluationDetails(id);
    }
    return await LocalDemoService.getEvaluationDetails(id);
  }

  static async saveDraft(
    evaluation: Partial<Evaluation> & { id: string },
    reponses: EvaluationReponse[],
    membresBe: MembreBe[],
    equipes: EquipeEvaluation[],
    recommandations: Partial<Recommandation> | null,
    preuves: PreuveDocumentaire[],
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.saveDraft(evaluation, reponses, membresBe, equipes, recommandations, preuves, userId);
    }
    return await LocalDemoService.saveDraft(evaluation, reponses, membresBe, equipes, recommandations, preuves, userId);
  }

  static async submitEvaluation(id: string, userId: string): Promise<{ success: boolean; errors?: string[] }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.submitEvaluation(id, userId);
    }
    return await LocalDemoService.submitEvaluation(id, userId);
  }

  static async updateStatus(
    id: string,
    newStatus: EvaluationStatus,
    comment: string | undefined,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.updateStatus(id, newStatus, comment, userId);
    }
    return await LocalDemoService.updateStatus(id, newStatus, comment, userId);
  }

  static async uploadPreuveFile(
    evaluationId: string,
    typePreuve: string,
    file: File
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.uploadPreuveFile(evaluationId, typePreuve, file);
    }
    return await LocalDemoService.uploadPreuveFile(evaluationId, typePreuve, file);
  }

  static async getAuditLogs(): Promise<AuditLog[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getAuditLogs();
    }
    return await LocalDemoService.getAuditLogs();
  }

  static async addAuditLog(
    userId: string,
    action: string,
    tableCible: string,
    ligneId: string,
    donneesAvant?: any,
    donneesApres?: any
  ): Promise<void> {
    if (isSupabaseConfigured) {
      await SupabaseDataService.addAuditLog(userId, action, tableCible, ligneId, donneesAvant, donneesApres);
    } else {
      LocalDemoService.addAuditLog(userId, action, tableCible, ligneId, donneesAvant, donneesApres);
    }
  }
}
