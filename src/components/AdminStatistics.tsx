/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  Gauge,
  Printer,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp
} from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Drena, Evaluation, EvaluationScore, User } from '../types';
import questionsErof from '../questions_erof.json';

const TARGET_PER_DRENA = 15;
const FORM_SECTIONS = questionsErof.sections as FormSection[];

type DashboardEvaluation = Partial<Evaluation> & Pick<Evaluation, 'id' | 'statut'> & {
  drena_nom?: string;
  iepp_nom?: string;
  etablissement_nom?: string;
  code_desps?: string;
  score_global?: number | null;
  classification?: string | null;
  validated_at?: string;
  scores?: Partial<EvaluationScore>;
};

type SelectedEvaluation = DashboardEvaluation & {
  score: number;
  drena: string;
};

type DrenaStatistic = {
  drena: string;
  rawEvaluations: number;
  cappedEvaluations: number;
  validatedAvailable: number;
  selectedValidated: SelectedEvaluation[];
  excludedValidated: SelectedEvaluation[];
  surplus: number;
  remainingCoverage: number;
  remainingValidation: number;
  coverageRate: number;
  validationRate: number;
  averageScore: number | null;
};

type FormQuestion = {
  code: string;
  libelle: string;
  storage_table?: string;
  storage_column?: string;
  type?: string;
  options?: { value: string | number | boolean; label: string }[];
  boolean_mapping?: Record<string, boolean>;
};

type FormSection = {
  num: number;
  titre: string;
  questions?: FormQuestion[];
};

type EvaluationDetails = NonNullable<Awaited<ReturnType<typeof DataService.getEvaluationDetails>>>;
type ExcelValue = string | number | boolean;

const CLASSIFICATION_STYLES: Record<string, { bar: string; badge: string }> = {
  'Performant / avancé': {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  'Fonctionnel': {
    bar: 'bg-green-500',
    badge: 'bg-green-50 text-green-800 border-green-200'
  },
  'Moyennement fonctionnel': {
    bar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  'Faiblement fonctionnel': {
    bar: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-800 border-orange-200'
  },
  'Non fonctionnel / critique': {
    bar: 'bg-rose-600',
    badge: 'bg-rose-50 text-rose-800 border-rose-200'
  }
};

const CLASSIFICATION_ORDER = [
  'Performant / avancé',
  'Fonctionnel',
  'Moyennement fonctionnel',
  'Faiblement fonctionnel',
  'Non fonctionnel / critique'
];

function normalizeName(value: string | undefined): string {
  return (value || '').trim().toLocaleUpperCase('fr-FR');
}

function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function scoreValue(evaluation: DashboardEvaluation): number {
  const score = Number(evaluation.score_global);
  return Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY;
}

function validationTime(evaluation: DashboardEvaluation): number {
  const timestamp = evaluation.validated_at ? new Date(evaluation.validated_at).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function formatScore(value: number | null): string {
  return value === null ? '—' : value.toFixed(2).replace('.', ',');
}

function numericValue(value: unknown): number | '' {
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function excelValue(value: unknown): ExcelValue {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function objectField(source: unknown, column: string | undefined): unknown {
  if (!source || typeof source !== 'object' || !column) return undefined;
  const record = source as Record<string, unknown>;
  if (!column.includes(',')) return record[column];

  const values = column.split(',').map(part => record[part.trim()]);
  return values.some(value => value === undefined || value === null)
    ? undefined
    : values.join(', ');
}

function rawQuestionValue(details: EvaluationDetails, question: FormQuestion): ExcelValue {
  const evaluation = details.evaluation;
  const table = question.storage_table || 'evaluation_reponses';

  if (table === 'reference') {
    if (question.code === '1.1') return evaluation.drena?.nom || '';
    if (question.code === '1.2') return evaluation.iepp?.nom || evaluation.etablissement?.iepp_id || '';
    return '';
  }
  if (table === 'etablissements') return excelValue(objectField(evaluation.etablissement, question.storage_column));
  if (table === 'coges') return excelValue(objectField(evaluation.coges, question.storage_column));
  if (table === 'evaluations') return excelValue(objectField(evaluation, question.storage_column));
  if (table === 'recommandations') return excelValue(objectField(details.recommandations, question.storage_column));
  if (table === 'preuves_documentaires') {
    return details.preuves.find(proof => proof.type_preuve === question.libelle)?.statut || '';
  }

  const answer = details.reponses.find(response => response.question_code === question.code);
  return excelValue(
    answer?.valeur_numerique
    ?? answer?.valeur_texte
    ?? answer?.valeur_date
    ?? answer?.valeur_json
  );
}

function answerLabel(question: FormQuestion, value: ExcelValue): string {
  if (value === '') return '';

  let normalizedValue = String(value);
  if (question.boolean_mapping && typeof value === 'boolean') {
    const mapping = Object.entries(question.boolean_mapping).find(([, mapped]) => mapped === value);
    normalizedValue = mapping?.[0] || normalizedValue;
  }
  return question.options?.find(option => String(option.value) === normalizedValue)?.label || String(value);
}

export default function AdminStatistics({ currentUser }: { currentUser: User }) {
  const [evaluations, setEvaluations] = useState<DashboardEvaluation[]>([]);
  const [drenas, setDrenas] = useState<Drena[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [rawExporting, setRawExporting] = useState(false);
  const [rawExportProgress, setRawExportProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStatistics = useCallback(async () => {
    if (currentUser.role !== 'admin_national') return;
    setLoading(true);
    setError(null);
    try {
      const [evaluationRows, drenaRows] = await Promise.all([
        DataService.getEvaluations(currentUser),
        DataService.getDrenas()
      ]);
      setEvaluations(evaluationRows as DashboardEvaluation[]);
      setDrenas(drenaRows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(formatUserFacingError('le chargement du bilan statistique', err));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const statistics = useMemo(() => {
    const rowsByDrena = new Map<string, DashboardEvaluation[]>();
    evaluations.forEach(evaluation => {
      const key = normalizeName(evaluation.drena_nom) || 'SANS DRENA';
      const current = rowsByDrena.get(key) || [];
      current.push(evaluation);
      rowsByDrena.set(key, current);
    });

    const drenaNames = drenas.length > 0
      ? drenas.map(drena => drena.nom)
      : Array.from(rowsByDrena.keys());

    const regional: DrenaStatistic[] = drenaNames.map(drenaName => {
      const rows = rowsByDrena.get(normalizeName(drenaName)) || [];
      const validated = rows
        .filter(row => row.statut === 'valide' || row.statut === 'verrouille')
        .map(row => ({
          ...row,
          drena: drenaName,
          score: scoreValue(row)
        }))
        .sort((a, b) => {
          const scoreDifference = b.score - a.score;
          if (scoreDifference !== 0) return scoreDifference;
          const dateDifference = validationTime(a) - validationTime(b);
          if (dateDifference !== 0) return dateDifference;
          return (a.etablissement_nom || '').localeCompare(b.etablissement_nom || '', 'fr');
        });

      const selectedValidated = validated.slice(0, TARGET_PER_DRENA);
      const finiteScores = selectedValidated.map(row => row.score).filter(Number.isFinite);
      const cappedEvaluations = Math.min(rows.length, TARGET_PER_DRENA);
      const selectedCount = selectedValidated.length;

      return {
        drena: drenaName,
        rawEvaluations: rows.length,
        cappedEvaluations,
        validatedAvailable: validated.length,
        selectedValidated,
        excludedValidated: validated.slice(TARGET_PER_DRENA),
        surplus: Math.max(0, rows.length - TARGET_PER_DRENA),
        remainingCoverage: Math.max(0, TARGET_PER_DRENA - cappedEvaluations),
        remainingValidation: Math.max(0, TARGET_PER_DRENA - selectedCount),
        coverageRate: percent(cappedEvaluations, TARGET_PER_DRENA),
        validationRate: percent(selectedCount, TARGET_PER_DRENA),
        averageScore: finiteScores.length > 0
          ? finiteScores.reduce((sum, score) => sum + score, 0) / finiteScores.length
          : null
      };
    });

    const selected = regional.flatMap(item => item.selectedValidated);
    const excluded = regional.flatMap(item => item.excludedValidated);
    const finiteScores = selected.map(row => row.score).filter(Number.isFinite);
    const target = regional.length * TARGET_PER_DRENA;
    const cappedEvaluations = regional.reduce((sum, item) => sum + item.cappedEvaluations, 0);
    const surplus = regional.reduce((sum, item) => sum + item.surplus, 0);
    const classifications = new Map<string, number>();

    selected.forEach(row => {
      const label = row.classification || 'Non classé';
      classifications.set(label, (classifications.get(label) || 0) + 1);
    });

    const orderedClassifications = [
      ...CLASSIFICATION_ORDER.map(label => ({ label, count: classifications.get(label) || 0 })),
      ...Array.from(classifications.entries())
        .filter(([label]) => !CLASSIFICATION_ORDER.includes(label))
        .map(([label, count]) => ({ label, count }))
    ];

    return {
      regional: regional.sort((a, b) => b.validationRate - a.validationRate || a.drena.localeCompare(b.drena, 'fr')),
      priority: [...regional].sort((a, b) => b.remainingValidation - a.remainingValidation || a.drena.localeCompare(b.drena, 'fr')),
      selected,
      excluded,
      target,
      cappedEvaluations,
      surplus,
      coverageRate: percent(cappedEvaluations, target),
      validationRate: percent(selected.length, target),
      averageScore: finiteScores.length > 0
        ? finiteScores.reduce((sum, score) => sum + score, 0) / finiteScores.length
        : null,
      minimumScore: finiteScores.length > 0 ? Math.min(...finiteScores) : null,
      maximumScore: finiteScores.length > 0 ? Math.max(...finiteScores) : null,
      classifications: orderedClassifications
    };
  }, [drenas, evaluations]);

  const exportExcel = async () => {
    setExporting(true);
    setError(null);

    try {
      const XLSX = await import('@e965/xlsx');
      const workbook = XLSX.utils.book_new();
      const generatedAt = new Date();
      const selectedIds = new Set(statistics.selected.map(item => item.id));
      const excludedIds = new Set(statistics.excluded.map(item => item.id));
      const validationRanks = new Map<string, number>();

      statistics.regional.forEach(item => {
        [...item.selectedValidated, ...item.excludedValidated].forEach((evaluation, index) => {
          validationRanks.set(evaluation.id, index + 1);
        });
      });

      const addSheet = (
        name: string,
        rows: Record<string, string | number | boolean>[],
        widths: number[]
      ) => {
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = widths.map(width => ({ wch: width }));
        if (sheet['!ref'] && rows.length > 0) {
          const range = XLSX.utils.decode_range(sheet['!ref']);
          sheet['!autofilter'] = {
            ref: XLSX.utils.encode_range({
              s: { r: range.s.r, c: range.s.c },
              e: { r: range.s.r, c: range.e.c }
            })
          };
        }
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet('Synthèse nationale', [
        { Indicateur: 'Date de génération', Valeur: generatedAt.toLocaleString('fr-FR') },
        { Indicateur: 'Nombre de DRENA', Valeur: statistics.regional.length },
        { Indicateur: 'Cible par DRENA', Valeur: TARGET_PER_DRENA },
        { Indicateur: 'Cible nationale', Valeur: statistics.target },
        { Indicateur: 'Saisies retenues', Valeur: statistics.cappedEvaluations },
        { Indicateur: 'Saisies brutes', Valeur: evaluations.length },
        { Indicateur: 'Taux de couverture (%)', Valeur: statistics.coverageRate },
        { Indicateur: 'Validations retenues', Valeur: statistics.selected.length },
        { Indicateur: 'Taux de validation (%)', Valeur: statistics.validationRate },
        { Indicateur: 'Score moyen retenu', Valeur: numericValue(statistics.averageScore) },
        { Indicateur: 'Score minimum retenu', Valeur: numericValue(statistics.minimumScore) },
        { Indicateur: 'Score maximum retenu', Valeur: numericValue(statistics.maximumScore) },
        { Indicateur: 'Évaluations hors plafond', Valeur: statistics.surplus },
        { Indicateur: 'Validations exclues du Top 15', Valeur: statistics.excluded.length }
      ], [34, 24]);

      addSheet('Bilan par DRENA', statistics.regional.map(item => ({
        DRENA: item.drena,
        Cible: TARGET_PER_DRENA,
        'Saisies brutes': item.rawEvaluations,
        'Saisies retenues': item.cappedEvaluations,
        'Validées disponibles': item.validatedAvailable,
        'Validées retenues': item.selectedValidated.length,
        'Reste à collecter': item.remainingCoverage,
        'Reste à valider/collecter': item.remainingValidation,
        'Évaluations excédentaires': item.surplus,
        'Taux de couverture (%)': item.coverageRate,
        'Taux de validation (%)': item.validationRate,
        'Score moyen retenu': numericValue(item.averageScore)
      })), [28, 10, 16, 17, 19, 18, 18, 24, 25, 23, 23, 22]);

      addSheet('Toutes les évaluations', evaluations.map(evaluation => {
        const score = evaluation.scores || {};
        const retained = selectedIds.has(evaluation.id);
        const excluded = excludedIds.has(evaluation.id);

        return {
          'ID évaluation': evaluation.id,
          DRENA: evaluation.drena_nom || '',
          IEPP: evaluation.iepp_nom || '',
          Établissement: evaluation.etablissement_nom || '',
          'Code DESPS': evaluation.code_desps || '',
          Statut: evaluation.statut,
          'Retenue dans le bilan': retained ? 'Oui' : 'Non',
          'Position dans la DRENA': validationRanks.get(evaluation.id) || '',
          'Motif de sélection': retained
            ? 'Retenue dans le Top 15'
            : excluded
              ? 'Validée hors Top 15'
              : 'Non validée',
          'Date de collecte': evaluation.date_collecte || '',
          'Date de soumission': evaluation.submitted_at || '',
          'Date de validation': evaluation.validated_at || '',
          Enquêteur: evaluation.enqueteur_id || '',
          Président: evaluation.president_nom || '',
          'Contact président': evaluation.president_contact || '',
          Conseiller: evaluation.conseiller_nom || '',
          'Contact conseiller': evaluation.conseiller_contact || '',
          'Email conseiller': evaluation.conseiller_email || '',
          'Effectif total': numericValue(evaluation.effectif_total),
          Filles: numericValue(evaluation.effectif_filles),
          Garçons: numericValue(evaluation.effectif_garcons),
          'Score global': numericValue(evaluation.score_global),
          Classification: evaluation.classification || '',
          'Taux disponibilité preuves (%)': numericValue(score.taux_disponibilite_preuves),
          'Axe 1 - Structure institutionnelle': numericValue(score.score_axe1),
          'Axe 2 - Fonctionnement interne': numericValue(score.score_axe2),
          'Axe 3 - Gestion administrative': numericValue(score.score_axe3),
          'Axe 4 - Gestion financière': numericValue(score.score_axe4),
          'Axe 5 - Planification': numericValue(score.score_axe5),
          'Axe 6 - Partenariats': numericValue(score.score_axe6),
          'Axe 7 - Contribution qualité': numericValue(score.score_axe7),
          'Axe 8 - Santé et inclusion': numericValue(score.score_axe8),
          'Axe 9 - Participation communautaire': numericValue(score.score_axe9),
          'Axe 10 - Genre': numericValue(score.score_axe10),
          'Axe 11 - Résilience': numericValue(score.score_axe11),
          'Axe 12 - Formation': numericValue(score.score_axe12),
          'Observations générales': evaluation.observations_generales || '',
          'Créée le': evaluation.created_at || '',
          'Mise à jour le': evaluation.updated_at || ''
        };
      }), [
        38, 25, 25, 35, 18, 16, 20, 22, 24, 18, 20, 20, 36, 28, 20, 28, 20, 28,
        14, 12, 12, 15, 30, 30, 24, 24, 27, 24, 22, 22, 25, 24, 32, 20, 22, 22, 45, 20, 20
      ]);

      addSheet('Classifications', statistics.classifications.map(item => ({
        Classification: item.label,
        'Nombre d’évaluations retenues': item.count,
        'Part des évaluations retenues (%)': percent(item.count, statistics.selected.length)
      })), [36, 32, 36]);

      workbook.Props = {
        Title: 'Bilan statistique EROF',
        Subject: 'Export complet du bilan statistique national',
        Author: 'EROF',
        CreatedDate: generatedAt
      };

      XLSX.writeFile(workbook, `bilan-statistique-erof-${generatedAt.toISOString().slice(0, 10)}.xlsx`, {
        compression: true
      });
    } catch (err) {
      setError(formatUserFacingError('l’export Excel du bilan statistique', err));
    } finally {
      setExporting(false);
    }
  };

  const exportRawDatabase = async () => {
    setRawExporting(true);
    setRawExportProgress({ loaded: 0, total: evaluations.length });
    setError(null);

    try {
      const detailsList: EvaluationDetails[] = [];
      const batchSize = 10;

      for (let index = 0; index < evaluations.length; index += batchSize) {
        const batch = evaluations.slice(index, index + batchSize);
        const batchDetails = await Promise.all(
          batch.map(evaluation => DataService.getEvaluationDetails(evaluation.id))
        );
        if (batchDetails.some(details => details === null)) {
          throw new Error('Une ou plusieurs évaluations sont introuvables.');
        }
        detailsList.push(...batchDetails.filter((details): details is EvaluationDetails => details !== null));
        setRawExportProgress({
          loaded: Math.min(index + batch.length, evaluations.length),
          total: evaluations.length
        });
      }

      const XLSX = await import('@e965/xlsx');
      const workbook = XLSX.utils.book_new();
      const generatedAt = new Date();
      const fixedQuestions = FORM_SECTIONS
        .filter(section => section.num !== 16 && section.num !== 20)
        .flatMap(section => (section.questions || []).map(question => ({ section, question })));

      const addSheet = (
        name: string,
        rows: Record<string, ExcelValue>[],
        widths: number[]
      ) => {
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet['!cols'] = widths.map(width => ({ wch: width }));
        if (sheet['!ref'] && rows.length > 0) {
          const range = XLSX.utils.decode_range(sheet['!ref']);
          sheet['!autofilter'] = {
            ref: XLSX.utils.encode_range({
              s: { r: range.s.r, c: range.s.c },
              e: { r: range.s.r, c: range.e.c }
            })
          };
        }
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      const baseRows = detailsList.map(details => {
        const evaluation = details.evaluation;
        const summary = evaluations.find(item => item.id === evaluation.id);
        const row: Record<string, ExcelValue> = {
          'ID évaluation': evaluation.id,
          DRENA: evaluation.drena?.nom || summary?.drena_nom || '',
          IEPP: evaluation.iepp?.nom || summary?.iepp_nom || '',
          Établissement: evaluation.etablissement?.nom || summary?.etablissement_nom || '',
          'Code DESPS': evaluation.etablissement?.code_desps || summary?.code_desps || '',
          Statut: evaluation.statut,
          'Date de collecte': evaluation.date_collecte || '',
          'Score global': numericValue(details.score?.score_global ?? summary?.score_global),
          Classification: details.score?.classification || summary?.classification || ''
        };

        fixedQuestions.forEach(({ question }) => {
          row[`${question.code} - ${question.libelle}`] = rawQuestionValue(details, question);
        });
        return row;
      });

      addSheet(
        'Base brute',
        baseRows,
        [38, 25, 25, 35, 18, 16, 18, 16, 30, ...fixedQuestions.map(() => 24)]
      );

      const detailedRows: Record<string, ExcelValue>[] = [];
      detailsList.forEach(details => {
        const evaluation = details.evaluation;
        const common = {
          'ID évaluation': evaluation.id,
          DRENA: evaluation.drena?.nom || '',
          IEPP: evaluation.iepp?.nom || '',
          Établissement: evaluation.etablissement?.nom || ''
        };

        FORM_SECTIONS.forEach(section => {
          const questions = section.questions || [];
          if (section.num === 16) {
            details.membresBe.forEach((member, instanceIndex) => {
              questions.forEach(question => {
                const value = excelValue(objectField(member, question.storage_column));
                detailedRows.push({
                  ...common,
                  Section: section.num,
                  'Titre de section': section.titre,
                  'N° instance': instanceIndex + 1,
                  'Code question': question.code,
                  Question: question.libelle,
                  'Valeur brute': value,
                  'Libellé de réponse': answerLabel(question, value),
                  Commentaire: ''
                });
              });
            });
            return;
          }

          if (section.num === 20) {
            details.equipes.forEach((member, instanceIndex) => {
              questions.forEach(question => {
                const value = excelValue(objectField(member, question.storage_column));
                detailedRows.push({
                  ...common,
                  Section: section.num,
                  'Titre de section': section.titre,
                  'N° instance': instanceIndex + 1,
                  'Code question': question.code,
                  Question: question.libelle,
                  'Valeur brute': value,
                  'Libellé de réponse': answerLabel(question, value),
                  Commentaire: ''
                });
              });
            });
            return;
          }

          questions.forEach(question => {
            const value = rawQuestionValue(details, question);
            const response = details.reponses.find(item => item.question_code === question.code);
            const proof = question.storage_table === 'preuves_documentaires'
              ? details.preuves.find(item => item.type_preuve === question.libelle)
              : undefined;
            detailedRows.push({
              ...common,
              Section: section.num,
              'Titre de section': section.titre,
              'N° instance': 1,
              'Code question': question.code,
              Question: question.libelle,
              'Valeur brute': value,
              'Libellé de réponse': answerLabel(question, value),
              Commentaire: response?.commentaire || proof?.commentaire || ''
            });
          });
        });
      });

      addSheet('Réponses détaillées', detailedRows, [38, 25, 25, 35, 10, 42, 12, 16, 55, 24, 32, 45]);

      addSheet('Membres BE', detailsList.flatMap(details => details.membresBe.map((member, index) => ({
        'ID évaluation': details.evaluation.id,
        DRENA: details.evaluation.drena?.nom || '',
        Établissement: details.evaluation.etablissement?.nom || '',
        'N° membre': index + 1,
        'Nom et prénoms': member.nom_prenoms,
        Genre: member.genre,
        Fonction: member.fonction,
        'Lit et écrit le français': member.lit_ecrit_francais,
        'Lit et écrit une langue locale': member.lit_ecrit_langue_locale,
        'Niveau d’étude': member.niveau_etude || '',
        Profession: member.profession || '',
        'Formation COGES': member.formation_coges,
        'Module de formation': member.module_formation || '',
        'Maîtrise du rôle': member.maitrise_role
      }))), [38, 25, 35, 12, 32, 14, 28, 24, 30, 22, 25, 20, 30, 20]);

      addSheet('Preuves documentaires', detailsList.flatMap(details => details.preuves.map(proof => ({
        'ID évaluation': details.evaluation.id,
        DRENA: details.evaluation.drena?.nom || '',
        Établissement: details.evaluation.etablissement?.nom || '',
        'Type de preuve': proof.type_preuve,
        Statut: proof.statut,
        Commentaire: proof.commentaire || '',
        'Nom du fichier': proof.fichier_nom_original || '',
        'Date de téléversement': proof.uploaded_at || ''
      }))), [38, 25, 35, 55, 30, 45, 35, 24]);

      addSheet('Équipes évaluation', detailsList.flatMap(details => details.equipes.map((member, index) => ({
        'ID évaluation': details.evaluation.id,
        DRENA: details.evaluation.drena?.nom || '',
        Établissement: details.evaluation.etablissement?.nom || '',
        'N° évaluateur': index + 1,
        'Nom et prénoms': member.nom_prenoms,
        'Fonction / structure': member.fonction_structure
      }))), [38, 25, 35, 14, 35, 35]);

      workbook.Props = {
        Title: 'Base brute des évaluations EROF',
        Subject: 'Toutes les réponses aux questions du formulaire EROF',
        Author: 'EROF',
        CreatedDate: generatedAt
      };
      XLSX.writeFile(workbook, `base-brute-erof-${generatedAt.toISOString().slice(0, 10)}.xlsx`, {
        compression: true
      });
    } catch (err) {
      setError(formatUserFacingError('l’extraction de la base brute', err));
    } finally {
      setRawExporting(false);
    }
  };

  if (currentUser.role !== 'admin_national') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">
        Ce bilan statistique est réservé à l’administrateur national.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A] text-white shadow-lg">
        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-amber-500/10 to-transparent" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                <ShieldCheck className="h-4 w-4" />
                <span>Accès administrateur national</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Bilan national des saisies EROF</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Pilotage sur une cible de 15 évaluations par DRENA. Au-delà de cette borne, seules les
                15 évaluations validées ayant les meilleurs scores sont retenues.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadStatistics}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={exportExcel}
                disabled={loading || exporting || rawExporting || statistics.regional.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                {exporting
                  ? <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                  : <Download className="h-4 w-4 text-amber-400" />}
                {exporting ? 'Export en cours…' : 'Exporter vers Excel'}
              </button>
              <button
                type="button"
                onClick={exportRawDatabase}
                disabled={loading || exporting || rawExporting || evaluations.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                {rawExporting
                  ? <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                  : <Download className="h-4 w-4 text-amber-400" />}
                {rawExporting
                  ? `Extraction ${rawExportProgress.loaded}/${rawExportProgress.total}`
                  : 'Base brute'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-extrabold text-slate-950 transition-colors hover:bg-amber-400"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </div>
          </div>
          {lastUpdated && (
            <p className="relative mt-4 text-[10px] font-medium text-slate-400">
              Données actualisées le {lastUpdated.toLocaleString('fr-FR')}.
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
          <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm font-semibold text-slate-500">Calcul du bilan selon la règle des 15…</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Couverture plafonnée</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{statistics.coverageRate}%</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {statistics.cappedEvaluations} sur {statistics.target} saisies
                  </p>
                </div>
                <span className="rounded-lg bg-blue-100 p-2 text-blue-700"><Target className="h-5 w-5" /></span>
              </div>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Validations retenues</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{statistics.selected.length}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{statistics.validationRate}% de la cible nationale</p>
                </div>
                <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><FileCheck2 className="h-5 w-5" /></span>
              </div>
            </article>

            <article className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Score moyen retenu</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{formatScore(statistics.averageScore)}<span className="text-base text-slate-400">/5</span></p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Min. {formatScore(statistics.minimumScore)} · Max. {formatScore(statistics.maximumScore)}
                  </p>
                </div>
                <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><Gauge className="h-5 w-5" /></span>
              </div>
            </article>

            <article className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Hors plafond</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{statistics.surplus}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{statistics.excluded.length} validation(s) exclue(s) du score</p>
                </div>
                <span className="rounded-lg bg-purple-100 p-2 text-purple-700"><BarChart3 className="h-5 w-5" /></span>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-xs font-extrabold text-amber-950">Règle de calcul appliquée</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900">
                  Chaque DRENA dispose d’une cible fixe de 15. Les saisies sont plafonnées à 15 pour la couverture.
                  Pour les résultats, les évaluations validées sont classées par score décroissant ; les 15 meilleures
                  sont retenues. En cas d’égalité, la validation la plus ancienne est prioritaire.
                </p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Performance par DRENA</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">Classement selon le taux de validation sur la cible de 15.</p>
                </div>
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">DRENA</th>
                      <th className="px-3 py-3 text-center font-bold">Saisies</th>
                      <th className="px-3 py-3 text-center font-bold">Validées</th>
                      <th className="px-3 py-3 text-center font-bold">Reste</th>
                      <th className="px-3 py-3 text-center font-bold">Score</th>
                      <th className="min-w-[160px] px-4 py-3 text-left font-bold">Progression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statistics.regional.map(item => (
                      <tr key={item.drena} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-extrabold text-slate-800">{item.drena}</p>
                          {item.surplus > 0 && (
                            <p className="mt-0.5 text-[9px] font-bold text-purple-600">+{item.surplus} hors plafond</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{item.cappedEvaluations}/15</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex min-w-8 justify-center rounded px-2 py-1 font-mono font-bold ${
                            item.selectedValidated.length === 15
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.selectedValidated.length >= 10
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.selectedValidated.length}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-600">{item.remainingValidation}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">{formatScore(item.averageScore)}</td>
                        <td className="px-4 py-3">
                          <div className="mb-1 flex items-center justify-between text-[9px] font-bold text-slate-500">
                            <span>{item.validationRate}% validé</span>
                            <span>{item.coverageRate}% saisi</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                item.validationRate >= 80
                                  ? 'bg-emerald-500'
                                  : item.validationRate >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                              }`}
                              style={{ width: `${item.validationRate}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-extrabold text-slate-900">Niveaux de fonctionnalité</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Répartition des {statistics.selected.length} évaluations retenues.</p>
              </div>
              <div className="space-y-4">
                {statistics.classifications.map(item => {
                  const style = CLASSIFICATION_STYLES[item.label] || {
                    bar: 'bg-slate-500',
                    badge: 'bg-slate-50 text-slate-700 border-slate-200'
                  };
                  const rate = percent(item.count, statistics.selected.length);
                  return (
                    <div key={item.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>{item.label}</span>
                        <span className="font-mono text-xs font-extrabold text-slate-800">{item.count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className="w-10 text-right text-[10px] font-bold text-slate-500">{rate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Priorités de finalisation</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">DRENA ayant le plus grand écart à la cible validée.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {statistics.priority.slice(0, 6).map((item, index) => (
                  <div key={item.drena} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      index < 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-slate-800">{item.drena}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{item.remainingValidation} à valider/collecter</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Contrôle du plafonnement</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">Évaluations validées non retenues dans les scores.</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-purple-500" />
              </div>
              {statistics.excluded.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs font-semibold text-slate-500">
                  Aucune évaluation validée ne dépasse actuellement la borne des 15 meilleurs scores.
                </div>
              ) : (
                <div className="space-y-2">
                  {statistics.excluded.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-purple-100 bg-purple-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-800">{item.etablissement_nom || item.id}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-purple-700">{item.drena} · hors Top 15</p>
                      </div>
                      <span className="shrink-0 rounded border border-purple-200 bg-white px-2 py-1 font-mono text-xs font-extrabold text-purple-800">
                        {formatScore(item.score)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
