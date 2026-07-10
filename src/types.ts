/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 
  | 'admin_national'
  | 'superviseur_drena'
  | 'superviseur_iepp'
  | 'enqueteur'
  | 'lecteur';

export type EvaluationStatus =
  | 'brouillon'
  | 'soumis'
  | 'en_revision'
  | 'valide'
  | 'rejete'
  | 'verrouille';

export interface User {
  id: string;
  email: string;
  nom_prenoms: string;
  role: UserRole;
  drena_id?: string;
  iepp_id?: string;
}

export interface Drena {
  id: string;
  nom: string;
}

export interface Iepp {
  id: string;
  nom: string;
  drena_id: string;
}

export interface Etablissement {
  id: string;
  nom: string;
  code_desps: string;
  type_etablissement: 'prescolaire' | 'primaire' | 'groupe_scolaire' | 'college' | 'lycee';
  iepp_id: string;
  localite: string;
  statut: 'public' | 'prive_laic' | 'prive_confessionnel';
  milieu: 'urbain' | 'periurbain' | 'rural';
  nombre_classes: number;
  nombre_enseignants: number;
  cantine: boolean;
  date_creation: string;
  latitude?: number;
  longitude?: number;
}

export interface Coges {
  id: string;
  etablissement_id: string;
  code_coges?: string;
  date_creation?: string;
  date_derniere_ag_elective: string;
}

export interface Campagne {
  id: string;
  nom: string;
  active: boolean;
}

export interface Evaluation {
  id: string;
  etablissement_id: string;
  coges_id: string;
  campagne_id: string;
  enqueteur_id: string;
  date_collecte: string;
  statut: EvaluationStatus;
  
  // Contacts & details
  president_nom: string;
  president_contact: string; // Keep as text
  conseiller_nom: string;
  conseiller_contact: string; // Keep as text
  conseiller_email: string;
  
  historique_creation: string;
  observations_generales?: string;
  
  // Effectifs
  effectif_total: number;
  effectif_filles: number;
  effectif_garcons: number;
  
  // System fields
  submitted_at?: string;
  validated_by?: string;
  validated_at?: string;
  locked: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface EvaluationReponse {
  id: string;
  evaluation_id: string;
  question_code: string;
  reponse_valeur: string; // Stored as string to match EAV pattern
}

export interface EvaluationScore {
  id: string;
  evaluation_id: string;
  score_global: number;
  classification: string;
  taux_disponibilite_preuves: number;
  axes_faibles: string[]; // Stored as text array or JSON
  score_axe1: number; // Structure institutionnelle
  score_axe2: number; // Fonctionnement interne
  score_axe3: number; // Gestion admin et doc
  score_axe4: number; // Gestion financière
  score_axe5: number; // Planification et redevabilité
  score_axe6: number; // Co-gestion et partenariats
  score_axe7: number; // Contribution qualité
  score_axe8: number; // Santé/protection/inclusion
  score_axe9: number; // Participation communautaire
  score_axe10: number; // Genre et représentativité
  score_axe11: number; // Résilience et durabilité
  score_axe12: number; // Formation et capacités
}

export interface PreuveDocumentaire {
  id: string;
  evaluation_id: string;
  type_preuve: string; // Match document label (e.g. "Textes réglementaires")
  statut: 'disponible_consultee' | 'disponible_non_consultee' | 'declaree_non_presentee' | 'non_disponible' | 'non_applicable';
  commentaire?: string;
  fichier_path?: string;
  fichier_nom_original?: string;
  uploaded_at?: string;
}

export interface MembreBe {
  id: string;
  evaluation_id: string;
  nom_prenoms: string;
  genre: 'homme' | 'femme';
  fonction: 'president' | 'vice_president' | 'secretaire_general' | 'secretaire_general_adjoint' | 'tresorier_general' | 'tresorier_general_adjoint' | 'parent_membre' | 'eleve';
  lit_ecrit_francais: boolean;
  lit_ecrit_langue_locale: boolean;
  niveau_etude: 'aucun' | 'primaire' | 'secondaire_1er_cycle' | 'secondaire_2nd_cycle' | 'superieur';
  profession: string;
  formation_coges: boolean;
  module_formation?: string;
  maitrise_role: 'faible' | 'moyenne' | 'bonne';
}

export interface EquipeEvaluation {
  id: string;
  evaluation_id: string;
  nom_prenoms: string;
  fonction_structure: string;
}

export interface Recommandation {
  id: string;
  evaluation_id: string;
  forces: string;
  faiblesses: string;
  difficultes: string;
  actions_urgentes: string;
  appuis_attendus: string;
  recommandations_prioritaires: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_cible: string;
  ligne_id: string;
  donnees_avant?: any;
  donnees_apres?: any;
  created_at: string;
}
