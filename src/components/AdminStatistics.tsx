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
import { Drena, EvaluationStatus, User } from '../types';

const TARGET_PER_DRENA = 15;

type DashboardEvaluation = {
  id: string;
  statut: EvaluationStatus;
  drena_nom?: string;
  iepp_nom?: string;
  etablissement_nom?: string;
  score_global?: number | null;
  classification?: string | null;
  validated_at?: string;
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

export default function AdminStatistics({ currentUser }: { currentUser: User }) {
  const [evaluations, setEvaluations] = useState<DashboardEvaluation[]>([]);
  const [drenas, setDrenas] = useState<Drena[]>([]);
  const [loading, setLoading] = useState(true);
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

  const exportCsv = () => {
    const header = [
      'DRENA',
      'Cible',
      'Saisies brutes',
      'Saisies retenues',
      'Validées retenues',
      'Reste à valider/collecter',
      'Évaluations excédentaires',
      'Taux de couverture (%)',
      'Taux de validation (%)',
      'Score moyen'
    ];
    const rows = statistics.regional.map(item => [
      item.drena,
      String(TARGET_PER_DRENA),
      String(item.rawEvaluations),
      String(item.cappedEvaluations),
      String(item.selectedValidated.length),
      String(item.remainingValidation),
      String(item.surplus),
      String(item.coverageRate).replace('.', ','),
      String(item.validationRate).replace('.', ','),
      item.averageScore === null ? '' : item.averageScore.toFixed(2).replace('.', ',')
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bilan-erof-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
                onClick={exportCsv}
                disabled={loading || statistics.regional.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                <Download className="h-4 w-4 text-amber-400" />
                Exporter
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
