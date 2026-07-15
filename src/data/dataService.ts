/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  UserRole,
  Drena,
  Iepp,
  Etablissement,
  Coges,
  Campagne,
  CampagneStatut,
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
import { validateEvaluationForSubmission } from '../validation';

const PREUVES_BUCKET = 'preuves-erof';

function cleanUuid(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanTimestamp(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nullIfBlank<T>(value: T): T | null {
  return value === '' ? null : value;
}

function cleanDraftPayload<T extends Record<string, any>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, nullIfBlank(value)])
  ) as T;
}

// Builds the upsert payload for a storage_table-scoped side entity (etablissements / coges)
// linked to an evaluation. Guards against sending an update with a blank/missing parent id
// (never send "" as a UUID) instead of silently dropping the data.
function buildLinkedUpdatePayload<T extends { id?: string }>(
  parentId: string | undefined,
  updates: Partial<T> | undefined,
  entityLabel: string
): { payload: (Partial<T> & { id: string }) | null; error?: string } {
  if (!updates || Object.keys(updates).length === 0) return { payload: null };
  const cleanParentId = cleanUuid(parentId);
  if (!cleanParentId) {
    return { payload: null, error: `Impossible d'enregistrer les informations "${entityLabel}" : aucun identifiant n'est associé à cette évaluation.` };
  }
  const { id: _ignored, ...rest } = updates as any;
  return { payload: { ...(rest as Partial<T>), id: cleanParentId } };
}

function buildEquipeEvaluationPayload(
  member: EquipeEvaluation,
  evaluationId: string,
  now: string
): EquipeEvaluation & { created_at: string; updated_at: string } {
  const raw = member as EquipeEvaluation & { created_at?: unknown; updated_at?: unknown };
  return {
    id: cleanUuid(member.id) || crypto.randomUUID(),
    evaluation_id: evaluationId,
    nom_prenoms: typeof member.nom_prenoms === 'string' ? member.nom_prenoms : '',
    fonction_structure: typeof member.fonction_structure === 'string' ? member.fonction_structure : '',
    created_at: cleanTimestamp(raw.created_at) || now,
    updated_at: now
  };
}

function normalizePreuveStoragePath(filePath: string): string {
  return filePath
    .trim()
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${PREUVES_BUCKET}/+`), '');
}

// Regional structure (MENAET / DAPS-COGES). Populate via the app once real data is available.
export const PRE_SEEDED_DRENAS: Drena[] = [
  { id: 'drena_agboville', nom: 'AGBOVILLE' },
  { id: 'drena_daloa', nom: 'DALOA' },
  { id: 'drena_tiassale', nom: 'TIASSALÉ' },
  { id: 'drena_guiglo', nom: 'GUIGLO' },
  { id: 'drena_duekoue', nom: 'DUÉKOUÉ' },
  { id: 'drena_minignan', nom: 'MINIGNAN' },
  { id: 'drena_odienne', nom: 'ODIENNÉ' },
  { id: 'drena_touba', nom: 'TOUBA' },
  { id: 'drena_issia', nom: 'ISSIA' },
  { id: 'drena_ferke', nom: 'FERKÉ' },
  { id: 'drena_man', nom: 'MAN' },
  { id: 'drena_danane', nom: 'DANANÉ' }
];

export const PRE_SEEDED_IEPPS: Iepp[] = [];

export const PRE_SEEDED_ETABLISSEMENTS: Etablissement[] = [];

export const PRE_SEEDED_COGES: Coges[] = [];

export const PRE_SEEDED_CAMPAGNES: Campagne[] = [];

export const PRE_SEEDED_USERS: User[] = [];

export function computeEvaluationScores(
  evaluationId: string,
  responses: EvaluationReponse[],
  membresBe: MembreBe[],
  preuves: PreuveDocumentaire[]
): EvaluationScore {
  const answerMap = new Map<string, number>();
  responses.forEach(r => {
    if (r.valeur_numerique !== null && r.valeur_numerique !== undefined) answerMap.set(r.question_code, r.valeur_numerique);
  });

  const getNumVal = (code: string, def = 1): number => {
    const val = answerMap.get(code);
    return val === undefined || isNaN(val) ? def : val;
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

const SEEDED_EVALUATIONS: Evaluation[] = [];

const SEEDED_REPONSES: EvaluationReponse[] = [];

const SEEDED_MEMBRES_BE: MembreBe[] = [];

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

    getStoredItem<Evaluation[]>('evaluations', SEEDED_EVALUATIONS);
    getStoredItem<EvaluationReponse[]>('reponses', SEEDED_REPONSES);
    getStoredItem<MembreBe[]>('membres_be', SEEDED_MEMBRES_BE);
    getStoredItem<PreuveDocumentaire[]>('preuves', []);
    getStoredItem<EvaluationScore[]>('scores', []);
    getStoredItem<EquipeEvaluation[]>('equipes', []);
    getStoredItem<Recommandation[]>('recommandations', []);
    getStoredItem<AuditLog[]>('audit_logs', []);
  }

  static async registerEnqueteur(input: {
    email: string;
    nom: string;
    prenom: string;
    drena_id: string;
    iepp_id?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email) return { success: false, error: 'L\'adresse e-mail est obligatoire.' };
    if (!input.nom.trim() || !input.prenom.trim()) return { success: false, error: 'Le nom et le prénom sont obligatoires.' };
    if (!input.drena_id) return { success: false, error: 'Veuillez sélectionner votre DRENA de rattachement.' };

    const users = getStoredItem<User[]>('users', []);
    if (users.some(u => u.email.toLowerCase() === email)) {
      return { success: false, error: 'Un compte existe déjà avec cette adresse e-mail.' };
    }

    const newUser: User = {
      id: `enqueteur_${Date.now()}`,
      email,
      nom: input.nom.trim(),
      prenom: input.prenom.trim(),
      role: 'enqueteur',
      drena_id: input.drena_id,
      iepp_id: undefined,
      actif: true
    };
    setStoredItem<User[]>('users', [...users, newUser]);
    return { success: true, user: newUser };
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

  static async createCampagne(input: {
    nom: string;
    annee_scolaire: string;
    date_debut: string;
    date_fin?: string;
    statut: CampagneStatut;
  }): Promise<{ success: boolean; campagne?: Campagne; error?: string }> {
    const campagnes = getStoredItem<Campagne[]>('campagnes', []);
    const now = new Date().toISOString();
    const newCampagne: Campagne = {
      id: `campagne_${Date.now()}`,
      nom: input.nom.trim(),
      annee_scolaire: input.annee_scolaire.trim(),
      date_debut: input.date_debut,
      date_fin: input.date_fin || undefined,
      statut: input.statut,
      created_at: now,
      updated_at: now
    };

    let updated = [...campagnes, newCampagne];
    if (newCampagne.statut === 'ouverte') {
      updated = updated.map(c => c.id === newCampagne.id ? c : { ...c, statut: 'fermee' as CampagneStatut });
    }
    setStoredItem<Campagne[]>('campagnes', updated);
    return { success: true, campagne: newCampagne };
  }

  static async updateCampagne(
    id: string,
    updates: Partial<Pick<Campagne, 'nom' | 'annee_scolaire' | 'date_debut' | 'date_fin' | 'statut'>>
  ): Promise<{ success: boolean; error?: string }> {
    const campagnes = getStoredItem<Campagne[]>('campagnes', []);
    const index = campagnes.findIndex(c => c.id === id);
    if (index < 0) return { success: false, error: 'Campagne introuvable.' };

    let updated = campagnes.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c);
    if (updates.statut === 'ouverte') {
      updated = updated.map(c => c.id === id ? c : { ...c, statut: 'fermee' as CampagneStatut });
    }
    setStoredItem<Campagne[]>('campagnes', updated);
    return { success: true };
  }

  static async deleteCampagne(id: string): Promise<{ success: boolean; error?: string }> {
    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    if (evals.some(e => e.campagne_id === id)) {
      return { success: false, error: 'Impossible de supprimer : des évaluations sont déjà rattachées à cette campagne.' };
    }
    const campagnes = getStoredItem<Campagne[]>('campagnes', []);
    setStoredItem<Campagne[]>('campagnes', campagnes.filter(c => c.id !== id));
    return { success: true };
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
      if (user.iepp_id) {
        // Enquêteur rattaché à une IEPP : ne voit que les saisies de cette IEPP.
        const ieppEtabs = etabs.filter(e => e.iepp_id === user.iepp_id).map(e => e.id);
        return rawEvals.filter(e => ieppEtabs.includes(e.etablissement_id));
      } else if (user.drena_id) {
        // Enquêteur rattaché à une DRENA : voit les saisies de toutes les IEPP de cette DRENA.
        const drenaIepps = iepps.filter(i => i.drena_id === user.drena_id).map(i => i.id);
        const drenaEtabs = etabs.filter(e => drenaIepps.includes(e.iepp_id)).map(e => e.id);
        return rawEvals.filter(e => drenaEtabs.includes(e.etablissement_id));
      }
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
    userId: string,
    etablissementUpdates?: Partial<Etablissement>,
    cogesUpdates?: Partial<Coges>
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const existingDetails = await this.getEvaluationDetails(evaluation.id);
    if (existingDetails) {
      const currentStatut = existingDetails.evaluation.statut;
      if (currentStatut !== 'brouillon' && currentStatut !== 'en_revision') {
        return { success: false, error: 'Modification impossible: l\'évaluation n\'est plus modifiable (statut: ' + currentStatut + ').' };
      }
    }

    const etabResult = buildLinkedUpdatePayload<Etablissement>(evaluation.etablissement_id, etablissementUpdates, "de l'établissement");
    if (etabResult.error) return { success: false, error: etabResult.error };
    const cogesResult = buildLinkedUpdatePayload<Coges>(evaluation.coges_id, cogesUpdates, 'du COGES');
    if (cogesResult.error) return { success: false, error: cogesResult.error };
    if (cogesResult.payload && evaluation.etablissement_id) {
      cogesResult.payload.etablissement_id = evaluation.etablissement_id;
    }
    const cogesPayload = cogesResult.payload || (
      evaluation.coges_id && evaluation.etablissement_id
        ? { id: evaluation.coges_id, etablissement_id: evaluation.etablissement_id }
        : null
    );

    if (etabResult.payload) {
      const etabs = getStoredItem<Etablissement[]>('etablissements', []);
      const etabIndex = etabs.findIndex(e => e.id === etabResult.payload!.id);
      if (etabIndex >= 0) {
        etabs[etabIndex] = { ...etabs[etabIndex], ...etabResult.payload } as Etablissement;
      } else {
        etabs.push(etabResult.payload as Etablissement);
      }
      setStoredItem<Etablissement[]>('etablissements', etabs);
    }
    if (cogesPayload) {
      const cogesList = getStoredItem<Coges[]>('coges', []);
      const cogesIndex = cogesList.findIndex(c => c.id === cogesPayload.id);
      if (cogesIndex >= 0) {
        cogesList[cogesIndex] = { ...cogesList[cogesIndex], ...cogesPayload } as Coges;
      } else {
        cogesList.push(cogesPayload as Coges);
      }
      setStoredItem<Coges[]>('coges', cogesList);
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

    const { evaluation, reponses, membresBe, equipes, recommandations, preuves } = details;

    const reponsesMap: Record<string, number> = {};
    reponses.forEach(r => {
      if (r.valeur_numerique !== null && r.valeur_numerique !== undefined) reponsesMap[r.question_code] = r.valeur_numerique;
    });

    const errors = validateEvaluationForSubmission({
      evaluation,
      etablissement: evaluation.etablissement || {},
      coges: evaluation.coges || {},
      reponses: reponsesMap,
      membresBe,
      equipes,
      recommandations,
      preuves
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
        statut: 'valide',
        submitted_at: now,
        validated_at: now,
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

    this.addAuditLog(userId, 'Soumission et validation automatique (contrôles de conformité réussis)', 'evaluations', id);
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

  static async getPreuveFileUrl(
    filePath: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!filePath) return { success: false, error: 'Aucun fichier associÃ© Ã  cette preuve.' };
    if (/^https?:\/\//i.test(filePath)) return { success: true, url: filePath };

    return {
      success: false,
      error: 'La consultation des fichiers locaux de dÃ©monstration n\'est pas disponible.'
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

  static async getAllUsers(): Promise<User[]> {
    return getStoredItem<User[]>('users', []);
  }

  static async createUserAdmin(input: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: UserRole;
    drena_id?: string;
    iepp_id?: string;
    telephone?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const email = input.email.trim().toLowerCase();
    if (!email) return { success: false, error: "L'adresse e-mail est obligatoire." };
    if (!input.nom.trim() || !input.prenom.trim()) return { success: false, error: 'Le nom et le prénom sont obligatoires.' };
    if ((input.role === 'superviseur_drena' || input.role === 'superviseur_iepp' || input.role === 'enqueteur') && !input.drena_id) {
      return { success: false, error: 'La DRENA de rattachement est obligatoire pour ce rôle.' };
    }
    if (input.role === 'superviseur_iepp' && !input.iepp_id) {
      return { success: false, error: "L'IEPP de rattachement est obligatoire pour ce rôle." };
    }

    const users = getStoredItem<User[]>('users', []);
    if (users.some(u => u.email.toLowerCase() === email)) {
      return { success: false, error: 'Un compte existe déjà avec cette adresse e-mail.' };
    }

    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      nom: input.nom.trim(),
      prenom: input.prenom.trim(),
      role: input.role,
      drena_id: input.drena_id || undefined,
      iepp_id: input.role === 'superviseur_iepp' ? (input.iepp_id || undefined) : undefined,
      telephone: input.telephone || undefined,
      actif: true
    };
    setStoredItem<User[]>('users', [...users, newUser]);
    return { success: true, user: newUser };
  }

  static async updateUserProfile(
    id: string,
    updates: Partial<Pick<User, 'nom' | 'prenom' | 'role' | 'telephone' | 'actif'>> & { drena_id?: string | null; iepp_id?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    const users = getStoredItem<User[]>('users', []);
    const index = users.findIndex(u => u.id === id);
    if (index < 0) return { success: false, error: 'Utilisateur introuvable.' };
    // Explicit null means "clear the field" (e.g. role no longer needs a DRENA/IEPP rattachement);
    // it must not be conflated with undefined, which would otherwise leave the old value in place.
    const normalized: typeof updates = { ...updates };
    if ('drena_id' in updates) normalized.drena_id = updates.drena_id === null ? undefined : updates.drena_id;
    if ('iepp_id' in updates) normalized.iepp_id = updates.iepp_id === null ? undefined : updates.iepp_id;
    if (updates.role && updates.role !== 'superviseur_iepp') normalized.iepp_id = undefined;
    users[index] = { ...users[index], ...normalized };
    setStoredItem<User[]>('users', users);
    return { success: true };
  }

  static async deleteUserProfile(id: string): Promise<{ success: boolean; error?: string }> {
    const evals = getStoredItem<Evaluation[]>('evaluations', []);
    if (evals.some(e => e.enqueteur_id === id)) {
      return { success: false, error: 'Impossible de supprimer : des évaluations sont rattachées à cet utilisateur. Désactivez-le plutôt.' };
    }
    const users = getStoredItem<User[]>('users', []);
    setStoredItem<User[]>('users', users.filter(u => u.id !== id));
    return { success: true };
  }

  static async resetUserPassword(_id: string, _newPassword: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "La réinitialisation de mot de passe n'est disponible qu'en mode Supabase (production)." };
  }
}

// REAL SUPABASE PRODUCTION STORAGE SERVICE
export class SupabaseDataService {
  static async registerEnqueteur(input: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    drena_id: string;
    iepp_id?: string;
  }): Promise<{ success: boolean; user?: User; error?: string; requiresEmailConfirmation?: boolean }> {
    // The profile row in public.users is provisioned server-side by the
    // on_auth_user_created_enqueteur trigger (RLS only allows admin_national to
    // write to that table directly), fed by this signup metadata.
    const { data, error } = await supabase!.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          registration_type: 'enqueteur',
          nom: input.nom.trim(),
          prenom: input.prenom.trim(),
          drena_id: input.drena_id,
          iepp_id: null
        }
      }
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) {
      return { success: false, error: 'Inscription refusée : aucun utilisateur renvoyé par le service d\'authentification.' };
    }

    const newUser: User = {
      id: data.user.id,
      email: input.email.trim(),
      nom: input.nom.trim(),
      prenom: input.prenom.trim(),
      role: 'enqueteur',
      drena_id: input.drena_id,
      iepp_id: undefined,
      actif: true
    };

    // Without an active session (email confirmation required), the profile
    // exists in the database but the client can't be logged in yet.
    if (!data.session) {
      return { success: true, user: newUser, requiresEmailConfirmation: true };
    }

    const profileResult = await this.getAuthenticatedUserProfile(data.user.id);
    if (!profileResult.user) {
      return {
        success: false,
        error: profileResult.error || 'Compte cree, mais le profil utilisateur est introuvable.'
      };
    }

    return { success: true, user: profileResult.user };
  }

  static async getAuthenticatedUserProfile(
    authUserId: string,
    repairMissing = true
  ): Promise<{ user?: User; error?: string }> {
    const loadProfile = async () => {
      return await supabase!
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();
    };

    let { data: profile, error: profileError } = await loadProfile();
    if (profileError) {
      return { error: `Impossible de charger votre profil utilisateur : ${profileError.message}` };
    }

    if (!profile && repairMissing) {
      const { error: repairError } = await supabase!.rpc('ensure_own_user_profile');
      if (repairError) {
        return {
          error: `Compte introuvable : la reparation automatique du profil a echoue (${repairError.message}).`
        };
      }

      const retry = await loadProfile();
      profile = retry.data;
      profileError = retry.error;
      if (profileError) {
        return { error: `Profil repare, mais lecture impossible : ${profileError.message}` };
      }
    }

    if (!profile) {
      return { error: 'Compte introuvable : Votre identifiant n\'a pas de profil configure dans la table "users".' };
    }

    return { user: profile as User };
  }

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
      .select('*')
      .order('date_debut', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createCampagne(input: {
    nom: string;
    annee_scolaire: string;
    date_debut: string;
    date_fin?: string;
    statut: CampagneStatut;
  }): Promise<{ success: boolean; campagne?: Campagne; error?: string }> {
    if (input.statut === 'ouverte') {
      const { error: closeErr } = await supabase!
        .from('campagnes')
        .update({ statut: 'fermee' })
        .eq('statut', 'ouverte');
      if (closeErr) return { success: false, error: 'Erreur lors de la clôture des campagnes existantes: ' + closeErr.message };
    }

    // Generated client-side (rather than relying on .select() to read back
    // the DB-assigned id) so the insert can go out with Prefer: return=minimal
    // — see the comment in supabaseClient.ts for why representation is avoided.
    const newCampagne: Campagne = {
      id: crypto.randomUUID(),
      nom: input.nom.trim(),
      annee_scolaire: input.annee_scolaire.trim(),
      date_debut: input.date_debut,
      date_fin: input.date_fin || undefined,
      statut: input.statut
    };
    const { error } = await supabase!.from('campagnes').insert({
      id: newCampagne.id,
      nom: newCampagne.nom,
      annee_scolaire: newCampagne.annee_scolaire,
      date_debut: newCampagne.date_debut,
      date_fin: newCampagne.date_fin || null,
      statut: newCampagne.statut
    });
    if (error) return { success: false, error: 'Erreur lors de la création de la campagne: ' + error.message };
    return { success: true, campagne: newCampagne };
  }

  static async updateCampagne(
    id: string,
    updates: Partial<Pick<Campagne, 'nom' | 'annee_scolaire' | 'date_debut' | 'date_fin' | 'statut'>>
  ): Promise<{ success: boolean; error?: string }> {
    if (updates.statut === 'ouverte') {
      const { error: closeErr } = await supabase!
        .from('campagnes')
        .update({ statut: 'fermee' })
        .eq('statut', 'ouverte')
        .neq('id', id);
      if (closeErr) return { success: false, error: 'Erreur lors de la clôture des campagnes existantes: ' + closeErr.message };
    }

    const { error } = await supabase!
      .from('campagnes')
      .update(updates)
      .eq('id', id);
    if (error) return { success: false, error: 'Erreur lors de la mise à jour de la campagne: ' + error.message };
    return { success: true };
  }

  static async deleteCampagne(id: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase!
      .from('campagnes')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: 'Suppression impossible (des évaluations sont probablement rattachées à cette campagne): ' + error.message };
    return { success: true };
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
    userId: string,
    etablissementUpdates?: Partial<Etablissement>,
    cogesUpdates?: Partial<Coges>
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    const existingDetails = await this.getEvaluationDetails(evaluation.id);
    if (existingDetails) {
      const currentStatut = existingDetails.evaluation.statut;
      if (currentStatut !== 'brouillon' && currentStatut !== 'en_revision') {
        return { success: false, error: 'Modification impossible: l\'évaluation n\'est plus modifiable (statut: ' + currentStatut + ').' };
      }
    }

    const evaluationId = cleanUuid(evaluation.id);
    const etablissementId = cleanUuid(evaluation.etablissement_id);
    const cogesId = cleanUuid(evaluation.coges_id);
    const campagneId = cleanUuid(evaluation.campagne_id);
    const enqueteurId = cleanUuid(evaluation.enqueteur_id);
    const createdBy = cleanUuid(evaluation.created_by) || userId;

    if (!evaluationId) return { success: false, error: "Impossible d'enregistrer : identifiant d'évaluation absent." };
    if (!campagneId) return { success: false, error: "Impossible d'enregistrer : aucune campagne active n'est associée à l'évaluation." };
    if (!enqueteurId) return { success: false, error: "Impossible d'enregistrer : aucun enquêteur n'est associé à l'évaluation." };
    if (!etablissementId || !cogesId) return { success: false, error: "Impossible d'enregistrer : identifiants COGES incomplets." };

    const etablissementDraft = cleanDraftPayload({ ...(etablissementUpdates || {}) } as Record<string, any>) as Partial<Etablissement>;
    const cogesDraft = cleanDraftPayload({ ...(cogesUpdates || {}) } as Record<string, any>) as Partial<Coges>;
    const existingEtablissement = existingDetails?.evaluation.etablissement;
    const existingCoges = existingDetails?.evaluation.coges;
    const ieppId = cleanUuid(etablissementDraft.iepp_id) || cleanUuid(existingEtablissement?.iepp_id);

    if (!ieppId) {
      return { success: false, error: "Impossible d'enregistrer le brouillon : sélectionnez d'abord l'IEPP de rattachement." };
    }

    const fallbackSuffix = evaluationId.slice(0, 8).toUpperCase();
    const etablissementNom = cleanText(etablissementDraft.nom) || cleanText(existingEtablissement?.nom);
    if (!etablissementNom || /^COGES BROUILLON\b/i.test(etablissementNom)) {
      return { success: false, error: "Impossible d'enregistrer le brouillon : renseignez d'abord le nom du COGES." };
    }
    const etablissementType = (
      cleanText(etablissementDraft.type_etablissement) ||
      cleanText(existingEtablissement?.type_etablissement) ||
      'prescolaire_primaire'
    ) as Etablissement['type_etablissement'];
    const etablissementPayload = cleanDraftPayload({
      ...(existingEtablissement || {}),
      ...etablissementDraft,
      id: etablissementId,
      iepp_id: ieppId,
      nom: etablissementNom,
      code_desps: cleanText(etablissementDraft.code_desps) || cleanText(existingEtablissement?.code_desps) || `DRAFT-${fallbackSuffix}`,
      type_etablissement: etablissementType
    });
    const cogesPayload = cleanDraftPayload({
      ...(existingCoges || {}),
      ...cogesDraft,
      id: cogesId,
      etablissement_id: etablissementId
    });

    const { error: etabErr } = await supabase!.from('etablissements').upsert(etablissementPayload);
    if (etabErr) return { success: false, error: "Erreur de sauvegarde de l'établissement: " + etabErr.message };

    const { error: cogesErr } = await supabase!.from('coges').upsert(cogesPayload);
    if (cogesErr) return { success: false, error: 'Erreur de sauvegarde du COGES: ' + cogesErr.message };

    // Save core evaluation. Deliberately INSERT for a brand-new evaluation
    // rather than upsert(): upsert compiles to INSERT ... ON CONFLICT DO
    // UPDATE, and Postgres requires the UPDATE policy to also hold for that
    // statement shape even when there's no actual conflict. evaluation_editable()
    // only matches existing brouillon/en_revision rows, so it's always false
    // for a row that doesn't exist yet — every first save would be rejected
    // by RLS. Once the row exists, a plain update() is unambiguous anyway.
    const evaluationRow = {
      id: evaluationId,
      etablissement_id: etablissementId,
      coges_id: cogesId,
      campagne_id: campagneId,
      enqueteur_id: enqueteurId,
      date_collecte: evaluation.date_collecte || new Date().toISOString().split('T')[0],
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
      created_by: createdBy,
      created_at: evaluation.created_at || now,
      updated_at: now
    };
    const { error: evErr } = existingDetails
      ? await supabase!.from('evaluations').update(evaluationRow).eq('id', evaluationId)
      : await supabase!.from('evaluations').insert(evaluationRow);
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
      const equipesPayload = equipes.map(member => buildEquipeEvaluationPayload(member, evaluationId, now));
      const { error: eqErr } = await supabase!.from('equipes_evaluation').upsert(equipesPayload);
      if (eqErr) return { success: false, error: 'Erreur de sauvegarde de l\'équipe: ' + eqErr.message };
    }
    if (recommandations) {
      const { error: recErr } = await supabase!.from('recommandations').upsert({
        id: recommandations.id,
        evaluation_id: evaluationId,
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
      await this.addAuditLog(userId, 'Sauvegarde de brouillon', 'evaluations', evaluationId);
    } catch (_) {}

    return { success: true };
  }

  static async submitEvaluation(id: string, userId: string): Promise<{ success: boolean; errors?: string[] }> {
    const now = new Date().toISOString();

    const details = await this.getEvaluationDetails(id);
    if (!details) {
      return { success: false, errors: ['Évaluation introuvable.'] };
    }

    const { evaluation, reponses, membresBe, equipes, recommandations, preuves } = details;

    const reponsesMap: Record<string, number> = {};
    reponses.forEach(r => {
      if (r.valeur_numerique !== null && r.valeur_numerique !== undefined) reponsesMap[r.question_code] = r.valeur_numerique;
    });

    const errors = validateEvaluationForSubmission({
      evaluation,
      etablissement: evaluation.etablissement || {},
      coges: evaluation.coges || {},
      reponses: reponsesMap,
      membresBe,
      equipes,
      recommandations,
      preuves
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const { error: evErr } = await supabase!
      .from('evaluations')
      .update({
        statut: 'valide',
        submitted_at: now,
        validated_at: now,
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
      // Calculate and save preview score since no database-side calculation was found.
      // Deliberately insert() rather than upsert(): upsert compiles to INSERT ... ON
      // CONFLICT DO UPDATE, which requires the UPDATE RLS policy to hold too even
      // though there's no actual conflict here (same reasoning as the evaluations
      // insert above) — the owning enqueteur only has an INSERT policy for their
      // own evaluation's score, not UPDATE, so upsert() would be silently rejected.
      const computedScore = computeEvaluationScores(id, reponses, membresBe, preuves);
      const finalScore = {
        id: crypto.randomUUID(),
        evaluation_id: computedScore.evaluation_id,
        score_global: computedScore.score_global,
        classification: computedScore.classification,
        taux_disponibilite_preuves: computedScore.taux_disponibilite_preuves,
        axes_faibles: computedScore.axes_faibles
      };
      const { error: scoreErr } = await supabase!.from('evaluation_scores').insert(finalScore);
      if (scoreErr) {
        console.warn('Scoring trigger may be handled natively in database. score_save_warning : ', scoreErr.message);
      }
    }

    try {
      await this.addAuditLog(userId, 'Soumission et validation automatique (contrôles de conformité réussis)', 'evaluations', id, evaluation, { ...evaluation, statut: 'valide', submitted_at: now, validated_at: now });
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

  static async getPreuveFileUrl(
    filePath: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!filePath) return { success: false, error: 'Aucun fichier associÃ© Ã  cette preuve.' };
    if (/^https?:\/\//i.test(filePath)) return { success: true, url: filePath };

    const normalizedPath = normalizePreuveStoragePath(filePath);
    const { data, error } = await supabase!.storage
      .from(PREUVES_BUCKET)
      .createSignedUrl(normalizedPath, 60 * 10);

    if (error || !data?.signedUrl) {
      return {
        success: false,
        error: 'Impossible de gÃ©nÃ©rer le lien de consultation du document : ' + (error?.message || 'URL absente')
      };
    }

    return { success: true, url: data.signedUrl };
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

  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .order('nom');
    if (error) throw error;
    return data || [];
  }

  static async createUserAdmin(input: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: UserRole;
    drena_id?: string;
    iepp_id?: string;
    telephone?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    const body = {
      ...input,
      iepp_id: input.role === 'superviseur_iepp' ? input.iepp_id : undefined
    };
    const { data, error } = await supabase!.functions.invoke('admin-create-user', {
      body
    });

    if (error) {
      // Supabase functions client surfaces non-2xx responses as a generic error;
      // try to recover the specific message the function returned in its JSON body.
      let message = error.message || "Échec de la création du compte.";
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const parsed = await ctx.json();
          if (parsed?.error) message = parsed.error;
        }
      } catch (_) {}
      return { success: false, error: message };
    }
    if (data?.error) return { success: false, error: data.error };
    return { success: true, user: data.user as User };
  }

  static async updateUserProfile(
    id: string,
    updates: Partial<Pick<User, 'nom' | 'prenom' | 'role' | 'telephone' | 'actif'>> & { drena_id?: string | null; iepp_id?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    const sanitizedUpdates = updates.role
      ? {
          ...updates,
          iepp_id: updates.role === 'superviseur_iepp' ? updates.iepp_id : null
        }
      : updates;
    const { error } = await supabase!
      .from('users')
      .update(sanitizedUpdates)
      .eq('id', id);
    if (error) return { success: false, error: 'Erreur lors de la mise à jour du profil : ' + error.message };
    return { success: true };
  }

  static async deleteUserProfile(id: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase!
      .from('users')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: 'Suppression impossible (des données sont probablement rattachées à cet utilisateur, désactivez-le plutôt) : ' + error.message };
    return { success: true };
  }

  static async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase!.functions.invoke('admin-reset-password', {
      body: { userId: id, newPassword }
    });

    if (error) {
      let message = error.message || 'Échec de la réinitialisation du mot de passe.';
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const parsed = await ctx.json();
          if (parsed?.error) message = parsed.error;
        }
      } catch (_) {}
      return { success: false, error: message };
    }
    if (data?.error) return { success: false, error: data.error };
    return { success: true };
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

  static async registerEnqueteur(input: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    drena_id: string;
    iepp_id?: string;
  }): Promise<{ success: boolean; user?: User; error?: string; requiresEmailConfirmation?: boolean }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.registerEnqueteur(input);
    }
    return await LocalDemoService.registerEnqueteur(input);
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

  static async createCampagne(input: {
    nom: string;
    annee_scolaire: string;
    date_debut: string;
    date_fin?: string;
    statut: CampagneStatut;
  }): Promise<{ success: boolean; campagne?: Campagne; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.createCampagne(input);
    }
    return await LocalDemoService.createCampagne(input);
  }

  static async updateCampagne(
    id: string,
    updates: Partial<Pick<Campagne, 'nom' | 'annee_scolaire' | 'date_debut' | 'date_fin' | 'statut'>>
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.updateCampagne(id, updates);
    }
    return await LocalDemoService.updateCampagne(id, updates);
  }

  static async deleteCampagne(id: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.deleteCampagne(id);
    }
    return await LocalDemoService.deleteCampagne(id);
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
    userId: string,
    etablissementUpdates?: Partial<Etablissement>,
    cogesUpdates?: Partial<Coges>
  ): Promise<{ success: boolean; error?: string }> {
    if (!evaluation.campagne_id) {
      return { success: false, error: 'Impossible d\'enregistrer : aucune campagne active n\'est associée à l\'évaluation.' };
    }
    if (isSupabaseConfigured) {
      return await SupabaseDataService.saveDraft(evaluation, reponses, membresBe, equipes, recommandations, preuves, userId, etablissementUpdates, cogesUpdates);
    }
    return await LocalDemoService.saveDraft(evaluation, reponses, membresBe, equipes, recommandations, preuves, userId, etablissementUpdates, cogesUpdates);
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

  static async getPreuveFileUrl(
    filePath: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getPreuveFileUrl(filePath);
    }
    return await LocalDemoService.getPreuveFileUrl(filePath);
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

  static async getAllUsers(): Promise<User[]> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.getAllUsers();
    }
    return await LocalDemoService.getAllUsers();
  }

  static async createUserAdmin(input: {
    email: string;
    password: string;
    nom: string;
    prenom: string;
    role: UserRole;
    drena_id?: string;
    iepp_id?: string;
    telephone?: string;
  }): Promise<{ success: boolean; user?: User; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.createUserAdmin(input);
    }
    return await LocalDemoService.createUserAdmin(input);
  }

  static async updateUserProfile(
    id: string,
    updates: Partial<Pick<User, 'nom' | 'prenom' | 'role' | 'telephone' | 'actif'>> & { drena_id?: string | null; iepp_id?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.updateUserProfile(id, updates);
    }
    return await LocalDemoService.updateUserProfile(id, updates);
  }

  static async deleteUserProfile(id: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.deleteUserProfile(id);
    }
    return await LocalDemoService.deleteUserProfile(id);
  }

  static async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured) {
      return await SupabaseDataService.resetUserPassword(id, newPassword);
    }
    return await LocalDemoService.resetUserPassword(id, newPassword);
  }
}
