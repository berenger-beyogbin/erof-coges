/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for "is this evaluation complete enough to submit?".
 * Reads required/validation/controle_coherence rules directly from
 * questions_erof.json so both the browser (dataService LocalDemoService) and
 * Supabase (dataService SupabaseDataService) paths stay in sync automatically
 * when the questionnaire config changes.
 */
import questionsErof from './questions_erof.json';
import {
  Evaluation,
  Etablissement,
  Coges,
  MembreBe,
  EquipeEvaluation,
  Recommandation,
  PreuveDocumentaire
} from './types';

export interface ValidationInput {
  evaluation: Partial<Evaluation>;
  etablissement: Partial<Etablissement>;
  coges: Partial<Coges>;
  reponses: Record<string, number>; // question_code -> valeur_numerique (evaluation_reponses is numeric-only today)
  membresBe: MembreBe[];
  equipes: EquipeEvaluation[];
  recommandations: Partial<Recommandation> | null;
  preuves: PreuveDocumentaire[];
}

const sections = questionsErof.sections as any[];

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function hasFilledMembreBeProfile(member: Partial<MembreBe> | undefined): boolean {
  if (!member) return false;
  return [
    member.nom_prenoms,
    member.profession,
    member.module_formation
  ].some(value => typeof value === 'string' && value.trim().length > 0)
    || member.formation_coges === true
    || member.lit_ecrit_francais !== true
    || member.lit_ecrit_langue_locale !== false
    || member.niveau_etude !== 'primaire'
    || member.maitrise_role !== 'moyenne';
}

function checkQuestion(code: string, libelle: string, required: boolean, validation: any, value: unknown, errors: string[]) {
  const label = `${code} (${libelle})`;
  if (required && isEmpty(value)) {
    errors.push(`${label} : champ obligatoire.`);
    return;
  }
  if (isEmpty(value) || !validation) return;

  if (validation.pattern && !new RegExp(validation.pattern).test(String(value))) {
    errors.push(`${label} : ${validation.message || 'format invalide.'}`);
  }
  if (validation.min !== undefined || validation.max !== undefined) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      if (validation.min !== undefined && n < validation.min) errors.push(`${label} : la valeur doit être ≥ ${validation.min}.`);
      if (validation.max !== undefined && n > validation.max) errors.push(`${label} : la valeur doit être ≤ ${validation.max}.`);
    }
  }
  if (validation.notFuture) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
      errors.push(`${label} : la date ne peut pas être postérieure à aujourd'hui.`);
    }
  }
}

const TABLE_SOURCES: Record<string, (input: ValidationInput) => Record<string, any> | null | undefined> = {
  evaluations: input => input.evaluation,
  etablissements: input => input.etablissement,
  coges: input => input.coges,
  recommandations: input => input.recommandations
};

export function validateEvaluationForSubmission(input: ValidationInput): string[] {
  const errors: string[] = [];

  for (const section of sections) {
    if (section.num === 16 || section.num === 20) continue; // repeat blocks, handled below

    for (const q of section.questions || []) {
      if (q.storage_table === 'reference') continue; // UI-only filter (e.g. DRENA), not persisted directly

      const table = q.storage_table || section.storage_table_defaut;
      let value: unknown;
      if (table === 'preuves_documentaires') {
        value = input.preuves.find(p => p.type_preuve === q.libelle)?.statut;
      } else if (table === 'evaluation_reponses') {
        value = input.reponses[q.code];
      } else {
        value = TABLE_SOURCES[table]?.(input)?.[q.storage_column];
      }
      checkQuestion(q.code, q.libelle, !!q.required, q.validation, value, errors);
    }
  }

  // Section 16: fixed 11-poste Bureau Exécutif roster, one membresBe row per repeat_instance (same order).
  const section16 = sections.find(s => s.num === 16);
  const instances: any[] = section16?.repeat_instances || [];
  instances.forEach((inst, idx) => {
    const membre = input.membresBe[idx];
    if (!hasFilledMembreBeProfile(membre)) {
      return;
    }
    for (const q of section16.questions) {
      if (q.conditional) {
        const dependsOnCol = section16.questions.find((x: any) => x.code === q.conditional.dependsOn)?.storage_column;
        const triggerValue = dependsOnCol ? (membre as any)[dependsOnCol] : undefined;
        if (triggerValue !== (q.conditional.showWhen === 'oui')) continue;
      }
      checkQuestion(q.code, `${inst.poste_libelle} - ${q.libelle}`, !!q.required, q.validation, (membre as any)[q.storage_column], errors);
    }
  });

  // Section 20: 1 to 4 members of the evaluation team.
  const section20 = sections.find(s => s.num === 20);
  if (section20) {
    const { min, max } = section20.repeat_instances;
    if (input.equipes.length < min) errors.push(`Équipe d'évaluation : au moins ${min} évaluateur(s) requis.`);
    if (input.equipes.length > max) errors.push(`Équipe d'évaluation : maximum ${max} évaluateurs.`);
    input.equipes.forEach((membre, idx) => {
      for (const q of section20.questions) {
        checkQuestion(q.code, `Évaluateur ${idx + 1} - ${q.libelle}`, !!q.required, q.validation, (membre as any)[q.storage_column], errors);
      }
    });
  }

  // --- Cross-field coherence rules declared in controle_coherence but not mechanically derivable above ---
  const ev = input.evaluation;
  const effectifSum = (ev.effectif_filles || 0) + (ev.effectif_garcons || 0);
  if ((ev.effectif_total || 0) !== effectifSum) {
    errors.push(`Incohérence effectif (1.10) : le total (${ev.effectif_total ?? 0}) doit être égal à filles + garçons (${effectifSum}).`);
  }

  const dateEcole = input.etablissement.date_creation;
  const dateCoges = input.coges.date_creation;
  const dateAg = input.coges.date_derniere_ag_elective;
  if (dateEcole && dateCoges && new Date(dateCoges) < new Date(dateEcole)) {
    errors.push('Incohérence dates (1.8) : la date de création du COGES ne peut précéder celle de l\'école (1.7).');
  }
  if (dateCoges && dateAg && new Date(dateAg) < new Date(dateCoges)) {
    errors.push('Incohérence dates (1.9) : la date de la dernière AG élective ne peut précéder la création du COGES (1.8).');
  }

  const totalPostesBE = instances.length || 11;
  const femmesBE = input.reponses['5.3'];
  if (femmesBE !== undefined && femmesBE > totalPostesBE) {
    errors.push(`Incohérence (5.3) : le nombre de femmes au Bureau Exécutif (${femmesBE}) ne peut excéder l'effectif total du BE (${totalPostesBE}).`);
  }
  if (femmesBE === 0 && input.reponses['5.4'] !== undefined && input.reponses['5.4'] !== 1) {
    errors.push('Incohérence (5.4) : si 5.3 = 0 (aucune femme au BE), 5.4 doit valoir "Aucune femme au Bureau Exécutif".');
  }

  const elevesBE = input.reponses['5.5'];
  if (elevesBE !== undefined && elevesBE > totalPostesBE) {
    errors.push(`Incohérence (5.5) : le nombre d'élèves au Bureau Exécutif (${elevesBE}) ne peut excéder l'effectif total du BE (${totalPostesBE}).`);
  }
  if (elevesBE === 0 && input.reponses['5.6'] !== undefined && input.reponses['5.6'] !== 1) {
    errors.push('Incohérence (5.6) : si 5.5 = 0 (aucun élève au BE), 5.6 doit valoir "Aucun élève au Bureau Exécutif".');
  }

  // Notes maîtrisées (≥ 4) sur des axes sensibles doivent être adossées à une preuve disponible et consultée,
  // ou à une explication écrite substantielle dans le commentaire de la preuve correspondante.
  const criticalPreuvesRules: { code: string; docName: string }[] = [
    { code: '3.2', docName: 'Textes réglementaires' },
    { code: '5.1', docName: 'Règlement intérieur' },
    { code: '5.7', docName: 'PV de la dernière AG élective' },
    { code: '9.1', docName: 'PACC' },
    { code: '9.2', docName: 'Budget annuel' },
    { code: '9.4', docName: 'Rapport d\'activités' },
    { code: '9.5', docName: 'Rapport financier' },
    { code: '9.6', docName: 'Bilan financier' },
    { code: '8.2', docName: 'Journal de caisse' },
    { code: '8.3', docName: 'Journal de banque' },
    { code: '8.1', docName: 'RIB ou document bancaire' },
    { code: '8.4', docName: 'Registre des biens' }
  ];

  criticalPreuvesRules.forEach(rule => {
    const rating = input.reponses[rule.code] || 0;
    if (rating >= 4) {
      const pDoc = input.preuves.find(p => p.type_preuve === rule.docName);
      const hasValidDoc = pDoc && pDoc.statut === 'disponible_consultee';
      const hasExplanation = pDoc && pDoc.commentaire && pDoc.commentaire.trim().length > 5;
      if (!hasValidDoc && !hasExplanation) {
        errors.push(
          `Preuve critique requise : la note de la question ${rule.code} vaut ${rating} (≥ 4), vous devez obligatoirement fournir le document "${rule.docName}" au statut "Disponible et consultée" dans la Section 17, ou saisir une explication justificative détaillée dans le commentaire de la preuve.`
        );
      }
    }
  });

  return errors;
}
