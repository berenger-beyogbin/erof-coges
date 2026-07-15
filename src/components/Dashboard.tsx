/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DataService } from '../data/dataService';
import { Evaluation, User, EvaluationScore, PreuveDocumentaire, MembreBe, Recommandation, EvaluationStatus, Drena, Iepp } from '../types';
import questionsErof from '../questions_erof.json';
import { 
  School, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Lock, 
  Unlock, 
  Clock, 
  TrendingUp, 
  Download, 
  RefreshCw, 
  Eye, 
  AlertTriangle,
  Award,
  ExternalLink
} from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onEditEvaluation: (id: string) => void;
  onNewEvaluation: () => void;
}

const formSections = questionsErof.sections as any[];

const emptyDisplay = 'Non renseigne';
const ROWS_PER_PAGE = 10;

function optionLabel(question: any, value: unknown): string {
  if (value === undefined || value === null || value === '') return emptyDisplay;

  let normalizedValue = String(value);
  if (question.boolean_mapping && typeof value === 'boolean') {
    const match = Object.entries(question.boolean_mapping).find(([, mapped]) => mapped === value);
    normalizedValue = match?.[0] || normalizedValue;
  }

  const option = question.options?.find((opt: any) => String(opt.value) === normalizedValue);
  if (!option) return String(value);

  if (question.type === 'rating_1_5') {
    return `${option.value} - ${option.label}`;
  }
  return option.label;
}

function fieldValue(source: any, column: string | undefined): unknown {
  if (!source || !column) return undefined;
  if (column.includes(',')) {
    const [first, second] = column.split(',').map(part => part.trim());
    const firstValue = source[first];
    const secondValue = source[second];
    if (firstValue === undefined || secondValue === undefined) return undefined;
    return `${firstValue}, ${secondValue}`;
  }
  return source[column];
}

function formatQuestionValue(details: any, question: any): string {
  const evaluation = details?.evaluation || {};
  const table = question.storage_table || 'evaluation_reponses';

  if (table === 'reference') {
    if (question.code === '1.1') return evaluation.drena?.nom || emptyDisplay;
    if (question.code === '1.2') return evaluation.iepp?.nom || evaluation.etablissement?.iepp_id || emptyDisplay;
    return emptyDisplay;
  }

  if (table === 'etablissements') {
    return optionLabel(question, fieldValue(evaluation.etablissement, question.storage_column));
  }

  if (table === 'coges') {
    return optionLabel(question, fieldValue(evaluation.coges, question.storage_column));
  }

  if (table === 'evaluations') {
    if (question.storage_column === 'enqueteur_id') {
      return evaluation.enqueteur_nom || evaluation.enqueteur_id || emptyDisplay;
    }
    return optionLabel(question, fieldValue(evaluation, question.storage_column));
  }

  if (table === 'recommandations') {
    return optionLabel(question, fieldValue(details.recommandations, question.storage_column));
  }

  if (table === 'preuves_documentaires') {
    const proof = details.preuves?.find((item: any) => item.type_preuve === question.libelle);
    return optionLabel(question, proof?.statut);
  }

  const answer = details.reponses?.find((item: any) => item.question_code === question.code);
  return optionLabel(question, answer?.valeur_numerique ?? answer?.valeur_texte ?? answer?.valeur_date);
}

function FilledFormViewer({
  details,
  onClose,
  onOpenProof
}: {
  details: any;
  onClose: () => void;
  onOpenProof: (proof: PreuveDocumentaire) => void;
}) {
  const evaluation = details?.evaluation || {};

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-lg border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#0F172A] text-white flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Formulaire renseigne</p>
            <h3 className="text-lg font-bold">{evaluation.etablissement?.nom || 'Evaluation EROF'}</h3>
            <p className="text-xs text-slate-300 font-mono mt-1">ID: {evaluation.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
          >
            Fermer
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 bg-slate-50">
          {formSections.map((section: any) => {
            if (section.num === 16) {
              const memberQuestions = section.questions || [];
              return (
                <section key={section.num} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
                    <h4 className="text-sm font-extrabold text-slate-800">{section.num}. {section.titre}</h4>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {(details.membresBe || []).map((member: any, idx: number) => (
                      <div key={member.id || idx} className="border border-slate-200 rounded p-3 bg-white">
                        <p className="text-xs font-bold text-slate-800 mb-2">
                          {idx + 1}. {member.nom_prenoms || emptyDisplay}
                        </p>
                        <div className="space-y-1.5">
                          {memberQuestions.map((question: any) => (
                            <div key={question.code} className="flex justify-between gap-3 text-[11px] border-t border-slate-100 pt-1.5">
                              <span className="text-slate-500">{question.libelle}</span>
                              <span className="text-slate-800 font-semibold text-right">
                                {optionLabel(question, fieldValue(member, question.storage_column))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.num === 17) {
              return (
                <section key={section.num} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
                    <h4 className="text-sm font-extrabold text-slate-800">{section.num}. {section.titre}</h4>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(details.preuves || []).map((proof: any, idx: number) => (
                      <div key={proof.id || idx} className="flex items-start justify-between gap-3 border border-slate-200 rounded p-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{idx + 1}. {proof.type_preuve}</p>
                          {proof.fichier_nom_original && (
                            <p className="text-[11px] text-emerald-700 font-medium mt-1">
                              Fichier joint : {proof.fichier_nom_original}
                            </p>
                          )}
                          {proof.commentaire && <p className="text-[11px] text-slate-500 mt-1">{proof.commentaire}</p>}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                            {optionLabel({ options: section.questions?.[idx]?.options }, proof.statut)}
                          </span>
                          {proof.fichier_path && (
                            <button
                              type="button"
                              onClick={() => onOpenProof(proof as PreuveDocumentaire)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-[#0F172A] text-white hover:bg-slate-800"
                            >
                              <ExternalLink className="h-3 w-3 text-amber-400" />
                              <span>Voir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            if (section.num === 20) {
              return (
                <section key={section.num} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
                    <h4 className="text-sm font-extrabold text-slate-800">{section.num}. {section.titre}</h4>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(details.equipes || []).map((member: any, idx: number) => (
                      <div key={member.id || idx} className="border border-slate-200 rounded p-3">
                        <p className="text-xs font-bold text-slate-800">{member.nom_prenoms || emptyDisplay}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{member.fonction_structure || emptyDisplay}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            return (
              <section key={section.num} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-100">
                  <h4 className="text-sm font-extrabold text-slate-800">{section.num}. {section.titre}</h4>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(section.questions || []).map((question: any) => (
                    <div key={question.code} className={`border border-slate-200 rounded p-3 ${question.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                      <p className="text-[11px] uppercase tracking-wide font-bold text-slate-400">{question.code}</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1">{question.libelle}</p>
                      <p className="text-sm font-bold text-slate-900 mt-2 whitespace-pre-wrap">
                        {formatQuestionValue(details, question)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ currentUser, onEditEvaluation, onNewEvaluation }: DashboardProps) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreateEvaluation = currentUser.role === 'enqueteur' || currentUser.role === 'admin_national';
  const canEditEvaluation = (evaluation: any) => {
    return (
      (currentUser.role === 'admin_national' || currentUser.role === 'enqueteur') &&
      !evaluation.locked &&
      (evaluation.statut === 'brouillon' || evaluation.statut === 'en_revision')
    );
  };

  // Référentiels DRENA/IEPP (chargés dynamiquement via DataService)
  const [drenas, setDrenas] = useState<Drena[]>([]);
  const [iepps, setIepps] = useState<Iepp[]>([]);
  const [isLoadingReferentiels, setIsLoadingReferentiels] = useState(true);
  const [referentielError, setReferentielError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrena, setSelectedDrena] = useState('');
  const [selectedIepp, setSelectedIepp] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selected evaluation for details drawer/panel
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [supervisionComment, setSupervisionComment] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showFilledForm, setShowFilledForm] = useState(false);
  const [fileOpenError, setFileOpenError] = useState<string | null>(null);

  // Load evaluations
  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const data = await DataService.getEvaluations(currentUser);
      setEvaluations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, [currentUser]);

  // Load DRENA/IEPP referentials
  useEffect(() => {
    const loadReferentiels = async () => {
      setIsLoadingReferentiels(true);
      setReferentielError(null);
      try {
        const [drenasData, ieppsData] = await Promise.all([
          DataService.getDrenas(),
          DataService.getIepps()
        ]);
        setDrenas(drenasData);
        setIepps(ieppsData);
        if (drenasData.length === 0 || ieppsData.length === 0) {
          setReferentielError('Aucun référentiel DRENA/IEPP disponible. Veuillez vérifier la configuration Supabase ou les données initiales.');
        }
      } catch (err) {
        console.error(err);
        setReferentielError('Aucun référentiel DRENA/IEPP disponible. Veuillez vérifier la configuration Supabase ou les données initiales.');
      } finally {
        setIsLoadingReferentiels(false);
      }
    };
    loadReferentiels();
  }, []);

  // Lock the DRENA/IEPP filters to the connected user's own scope. This applies to
  // anyone rattaché to a DRENA or an IEPP — supervisors (superviseur_drena /
  // superviseur_iepp) as well as enquêteurs terrain, who self-register at either
  // level (see Login.tsx registration form).
  useEffect(() => {
    if (drenas.length === 0) return;
    if (currentUser.iepp_id) {
      const iepp = iepps.find(i => i.id === currentUser.iepp_id);
      if (iepp) {
        const drena = drenas.find(d => d.id === iepp.drena_id);
        if (drena) setSelectedDrena(drena.nom);
        setSelectedIepp(iepp.nom);
      }
    } else if (currentUser.drena_id) {
      const drena = drenas.find(d => d.id === currentUser.drena_id);
      if (drena) setSelectedDrena(drena.nom);
    }
  }, [drenas, iepps, currentUser]);

  // Users rattachés to a DRENA or IEPP can't widen their filters beyond that scope
  const isDrenaFilterLocked = !!currentUser.drena_id || !!currentUser.iepp_id;
  const isIeppFilterLocked = !!currentUser.iepp_id;

  // Handle detailed evaluation load
  useEffect(() => {
    if (selectedEvalId) {
      loadDetails(selectedEvalId);
    } else {
      setSelectedDetails(null);
      setShowFilledForm(false);
    }
  }, [selectedEvalId]);

  const loadDetails = async (id: string) => {
    setLoadingDetails(true);
    setActionSuccess(null);
    setActionError(null);
    setFileOpenError(null);
    setSupervisionComment('');
    try {
      const details = await DataService.getEvaluationDetails(id);
      setSelectedDetails(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Perform supervisor actions (validate, reject, request revision, lock)
  const handleStatusChange = async (newStatus: any) => {
    if (!selectedEvalId) return;
    setActionSuccess(null);
    setActionError(null);
    
    try {
      const result = await DataService.updateStatus(selectedEvalId, newStatus, supervisionComment, currentUser.id);
      if (result.success) {
        setActionSuccess(`Le statut de l'évaluation a été mis à jour avec succès vers : ${newStatus.toUpperCase()}`);
        setSupervisionComment('');
        // Reload details and main list
        await loadDetails(selectedEvalId);
        await loadEvaluations();
      } else {
        setActionError(result.error || 'Une erreur de sécurité ou de validation s\'est produite.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleUnlockForRevision = () => {
    if (!supervisionComment.trim()) {
      alert('Le motif est obligatoire pour dÃ©verrouiller une Ã©valuation.');
      return;
    }
    if (!window.confirm('DÃ©verrouiller cette Ã©valuation ? Elle repassera en rÃ©vision et redeviendra modifiable.')) {
      return;
    }
    handleStatusChange('en_revision');
  };

  const handleOpenPreuveFile = async (proof: PreuveDocumentaire) => {
    setFileOpenError(null);
    if (!proof.fichier_path) {
      setFileOpenError('Aucun fichier n\'est associÃ© Ã  cette preuve.');
      return;
    }

    const openedWindow = window.open('', '_blank');
    try {
      const result = await DataService.getPreuveFileUrl(proof.fichier_path);
      if (!result.success || !result.url) {
        openedWindow?.close();
        setFileOpenError(result.error || 'Impossible d\'ouvrir le document.');
        return;
      }

      if (openedWindow) {
        openedWindow.opener = null;
        openedWindow.location.href = result.url;
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      openedWindow?.close();
      setFileOpenError(err?.message || 'Impossible d\'ouvrir le document.');
    }
  };

  // Export to CSV helper
  const handleExportCSV = async (type: 'raw' | 'scores' | 'preuves') => {
    try {
      let headers: string[] = [];
      let rows: string[][] = [];
      let fileName = 'erof_export';

      if (type === 'raw') {
        headers = ['ID Évaluation', 'DRENA', 'IEPP', 'École', 'Code DESPS', 'Enquêteur', 'Date Collecte', 'Statut', 'Président', 'Contact Président', 'Conseiller', 'Contact Conseiller', 'Effectif Total', 'Filles', 'Garçons'];
        rows = evaluations.map(e => [
          e.id,
          e.drena_nom || '',
          e.iepp_nom || '',
          e.etablissement_nom || '',
          e.code_desps || '',
          e.enqueteur_id || '',
          e.date_collecte || '',
          e.statut || '',
          e.president_nom || '',
          e.president_contact || '',
          e.conseiller_nom || '',
          e.conseiller_contact || '',
          String(e.effectif_total || 0),
          String(e.effectif_filles || 0),
          String(e.effectif_garcons || 0)
        ]);
        fileName = 'erof_donnees_brutes_export';
      } else if (type === 'scores') {
        headers = ['ID Évaluation', 'École', 'Score Global', 'Classification', 'Taux Preuves (%)', 'Axe 1 (Inst)', 'Axe 2 (Fonc)', 'Axe 3 (Doc)', 'Axe 4 (Fin)', 'Axe 5 (Plan)', 'Axe 6 (Part)', 'Axe 7 (Qual)', 'Axe 8 (Sante)', 'Axe 9 (Comm)', 'Axe 10 (Genr)', 'Axe 11 (Resil)', 'Axe 12 (Cap)'];
        rows = evaluations.map(e => {
          const sc = e.scores || {};
          return [
            e.id,
            e.etablissement_nom || '',
            e.score_global ? String(e.score_global) : 'N/A',
            e.classification || 'N/A',
            sc.taux_disponibilite_preuves !== undefined ? `${sc.taux_disponibilite_preuves}%` : 'N/A',
            sc.score_axe1 !== undefined ? String(sc.score_axe1) : 'N/A',
            sc.score_axe2 !== undefined ? String(sc.score_axe2) : 'N/A',
            sc.score_axe3 !== undefined ? String(sc.score_axe3) : 'N/A',
            sc.score_axe4 !== undefined ? String(sc.score_axe4) : 'N/A',
            sc.score_axe5 !== undefined ? String(sc.score_axe5) : 'N/A',
            sc.score_axe6 !== undefined ? String(sc.score_axe6) : 'N/A',
            sc.score_axe7 !== undefined ? String(sc.score_axe7) : 'N/A',
            sc.score_axe8 !== undefined ? String(sc.score_axe8) : 'N/A',
            sc.score_axe9 !== undefined ? String(sc.score_axe9) : 'N/A',
            sc.score_axe10 !== undefined ? String(sc.score_axe10) : 'N/A',
            sc.score_axe11 !== undefined ? String(sc.score_axe11) : 'N/A',
            sc.score_axe12 !== undefined ? String(sc.score_axe12) : 'N/A'
          ];
        });
        fileName = 'erof_scores_synthese_export';
      } else {
        headers = ['ID Évaluation', 'École', 'Type de Document', 'Statut Vérification', 'Commentaire / Justification'];
        const allDetails = await Promise.all(
          evaluations.map(async e => {
            try {
              return await DataService.getEvaluationDetails(e.id);
            } catch {
              return null;
            }
          })
        );
        rows = [];
        allDetails.forEach((details, idx) => {
          if (details && details.preuves) {
            details.preuves.forEach((p: any) => {
              rows.push([
                details.evaluation.id,
                details.evaluation.etablissement?.nom || evaluations[idx].etablissement_nom || '',
                p.type_preuve || '',
                p.statut || 'non_disponible',
                p.commentaire || ''
              ]);
            });
          }
        });
        fileName = 'erof_preuves_documentaires_export';
      }

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(';'), ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate PDF print download
  const handlePrintPDF = () => {
    window.print();
  };

  // Filter evaluations based on user selections
  const filteredEvaluations = evaluations.filter(e => {
    const matchesSearch = e.etablissement_nom?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.president_nom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Scoped list filters (matching schema and selected options)
    const matchesDrena = !selectedDrena || e.drena_nom?.includes(selectedDrena);
    const matchesIepp = !selectedIepp || e.iepp_nom?.includes(selectedIepp);
    const matchesStatus = !selectedStatus || e.statut === selectedStatus;
    
    return matchesSearch && matchesDrena && matchesIepp && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDrena, selectedIepp, selectedStatus, evaluations.length]);

  const pageCount = Math.max(1, Math.ceil(filteredEvaluations.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const paginatedEvaluations = filteredEvaluations.slice(pageStart, pageStart + ROWS_PER_PAGE);
  const pageEnd = Math.min(pageStart + paginatedEvaluations.length, filteredEvaluations.length);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  // IEPP options scoped to the selected DRENA (if any)
  const selectedDrenaObj = drenas.find(d => d.nom === selectedDrena);
  const filteredIeppOptions = selectedDrenaObj
    ? iepps.filter(i => i.drena_id === selectedDrenaObj.id)
    : iepps;

  // Calculate stats
  const totalCount = filteredEvaluations.length;
  const submittedCount = filteredEvaluations.filter(e => e.statut === 'soumis').length;
  const validatedCount = filteredEvaluations.filter(e => e.statut === 'valide').length;
  const draftCount = filteredEvaluations.filter(e => e.statut === 'brouillon' || e.statut === 'en_revision').length;

  const averageScore = parseFloat(
    (filteredEvaluations.reduce((acc, curr) => acc + (curr.score_global || 0), 0) / 
    (filteredEvaluations.filter(e => e.score_global).length || 1)).toFixed(2)
  );

  return (
    <div className="w-full max-w-full mx-auto space-y-6 overflow-x-hidden">
      {showFilledForm && selectedDetails && (
        <FilledFormViewer
          details={selectedDetails}
          onClose={() => setShowFilledForm(false)}
          onOpenProof={handleOpenPreuveFile}
        />
      )}

      {/* Upper Status Banner / Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 justify-center" id="stats-bento">
        <div className="min-w-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="shrink-0 p-3 bg-slate-100 text-slate-700 rounded-lg">
            <School className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Évaluations totales</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>

        <div className="min-w-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="shrink-0 p-3 bg-slate-100 text-amber-500 rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brouillons / Révisions</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{draftCount}</p>
          </div>
        </div>

        <div className="min-w-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="shrink-0 p-3 bg-slate-100 text-blue-500 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Soumises à valider</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{submittedCount}</p>
          </div>
        </div>

        <div className="min-w-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="shrink-0 p-3 bg-slate-100 text-emerald-500 rounded-lg">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Validées & Officielles</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{validatedCount}</p>
          </div>
        </div>

        <div className="min-w-0 bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="shrink-0 p-3 bg-slate-100 text-[#0F172A] rounded-lg">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Moyenne Nationale</p>
            <p className="text-2xl font-mono font-bold text-slate-800 whitespace-nowrap">{isNaN(averageScore) ? 'N/A' : `${averageScore} / 5`}</p>
          </div>
        </div>
      </div>

      {/* Main operational panel divided into table (left/top) and details drawer (right/bottom) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 min-w-0">
        
        {/* Evaluations list - 2 cols on wide, full on mobile */}
        <div className="xl:col-span-2 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* Header & Search */}
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-500 rounded"></span>
                Registre des Évaluations EROF
              </h2>
              <p className="text-xs text-slate-500">Gérez, validez et filtrez les formulaires de collecte de terrain</p>
            </div>

            {canCreateEvaluation && (
              <button 
                id="btn-new-eval"
                onClick={onNewEvaluation}
                className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded text-xs uppercase tracking-wider transition-all shadow-sm shadow-amber-200 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nouvelle Évaluation</span>
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Rechercher école, ID..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div>
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                value={selectedDrena}
                onChange={(e) => {
                  setSelectedDrena(e.target.value);
                  setSelectedIepp('');
                }}
                disabled={isLoadingReferentiels || drenas.length === 0 || isDrenaFilterLocked}
                title={isDrenaFilterLocked ? 'Filtre verrouillé sur votre DRENA de rattachement' : undefined}
              >
                <option value="">Toutes les DRENA</option>
                {drenas.map(d => (
                  <option key={d.id} value={d.nom}>{d.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                value={selectedIepp}
                onChange={(e) => setSelectedIepp(e.target.value)}
                disabled={isLoadingReferentiels || filteredIeppOptions.length === 0 || isIeppFilterLocked}
                title={isIeppFilterLocked ? 'Filtre verrouillé sur votre IEPP de rattachement' : undefined}
              >
                <option value="">Toutes les IEPP</option>
                {filteredIeppOptions.map(i => (
                  <option key={i.id} value={i.nom}>{i.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="brouillon">Brouillon (Gris)</option>
                <option value="soumis">Soumis (Bleu)</option>
                <option value="en_revision">En Révision (Orange)</option>
                <option value="valide">Validé (Vert)</option>
                <option value="rejete">Rejeté (Rouge)</option>
                <option value="verrouille">Verrouillé (Violet)</option>
              </select>
            </div>
          </div>

          {referentielError && (
            <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-[11px] text-rose-800 font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>{referentielError}</span>
            </div>
          )}

          {canCreateEvaluation && draftCount > 0 && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{draftCount} brouillon(s) en cours. Utilisez le crayon pour reprendre, modifier ou finaliser la saisie.</span>
            </div>
          )}

          {/* Evaluations Table */}
          <div className="overflow-x-auto xl:overflow-x-hidden flex-1">
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Chargement des évaluations en cours...</span>
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm font-medium">
                Aucune évaluation ne correspond à vos critères de recherche ou à votre rôle.
              </div>
            ) : (
              <>
              <table className="w-full table-fixed divide-y divide-slate-200">
                <colgroup>
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead className="bg-[#0F172A] text-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Identifiant / Établissement</th>
                    <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Localisation</th>
                    <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Statut</th>
                    <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Score / Éval</th>
                    <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {paginatedEvaluations.map((ev) => {
                    const statusConfig = {
                      brouillon: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Brouillon' },
                      soumis: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Soumis' },
                      en_revision: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', label: 'En Révision' },
                      valide: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Validé' },
                      rejete: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', label: 'Rejeté' },
                      verrouille: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', label: 'Verrouillé' }
                    }[ev.statut as EvaluationStatus] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: ev.statut };

                    const isSelected = selectedEvalId === ev.id;
                    const isEditable = canEditEvaluation(ev);
                    const editLabel = currentUser.role === 'admin_national'
                      ? 'Modifier le brouillon'
                      : 'Reprendre et finaliser le brouillon';

                    return (
                      <tr 
                        key={ev.id} 
                        onClick={() => setSelectedEvalId(ev.id)}
                        className={`hover:bg-slate-50 cursor-pointer transition-all ${isSelected ? 'bg-amber-50/50 border-l-4 border-l-amber-500 font-medium' : ''}`}
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="p-2 bg-slate-100 text-slate-700 rounded shrink-0">
                              <School className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800 truncate">{ev.etablissement_nom || 'École inconnue'}</div>
                              <div className="text-[11px] font-mono text-slate-400">ID: {ev.id.substring(0, 13)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-xs font-semibold text-slate-600 truncate">{ev.drena_nom || 'DRENA N/A'}</div>
                          <div className="text-[10px] text-slate-400 font-medium truncate">{ev.iepp_nom || 'IEPP N/A'}</div>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex max-w-full items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5"></span>
                            <span className="truncate">{statusConfig.label}</span>
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          {ev.score_global ? (
                            <div className="min-w-0">
                              <div className="text-sm font-mono font-bold text-slate-800">{ev.score_global} / 5</div>
                              <div className="text-[9px] text-slate-400 tracking-tight font-bold uppercase truncate">{ev.classification}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Non calculé (brouillon)</span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-center text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                            <button 
                              onClick={() => setSelectedEvalId(ev.id)}
                              className="shrink-0 p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors border border-slate-200 bg-white shadow-sm"
                              title="Consulter le rapport"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {isEditable && (
                              <button 
                                onClick={() => onEditEvaluation(ev.id)}
                                className="shrink-0 p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors border border-blue-200 bg-white shadow-sm"
                                title={editLabel}
                                aria-label={editLabel}
                              >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">{editLabel}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Affichage {filteredEvaluations.length === 0 ? 0 : pageStart + 1}-{pageEnd} sur {filteredEvaluations.length} · 10 lignes par page
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="px-2.5 py-1.5 rounded border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <input
                    type="range"
                    min="1"
                    max={pageCount}
                    value={safeCurrentPage}
                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                    disabled={pageCount <= 1}
                    className="w-36 accent-amber-500 disabled:opacity-40"
                    aria-label="Navigation des pages du tableau"
                  />
                  <span className="min-w-14 text-center text-[11px] font-bold text-slate-600">
                    {safeCurrentPage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}
                    disabled={safeCurrentPage >= pageCount}
                    className="px-2.5 py-1.5 rounded border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Detailed reports drawer - 1 col on wide */}
        <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[500px]">
          {!selectedEvalId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-4">
              <FileText className="h-12 w-12 text-slate-200" />
              <div>
                <h3 className="font-bold text-slate-700">Aucune sélection</h3>
                <p className="text-xs max-w-xs mt-1 text-slate-400">Sélectionnez une ligne d'évaluation pour consulter les scores détaillés, le profil des membres, les preuves ou agir en tant que superviseur.</p>
              </div>
            </div>
          ) : loadingDetails || !selectedDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Chargement du rapport complet...</span>
            </div>
          ) : (
            // Full high-fidelity detailed report
            <div className="space-y-6 flex-1 flex flex-col">
              
              {/* Card top banner */}
              <div className="border-b border-slate-200 pb-4 flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {selectedDetails.evaluation.id}</span>
                  <h3 className="text-base font-bold text-slate-800 font-display">{selectedDetails.evaluation.etablissement?.nom}</h3>
                  <p className="text-xs text-slate-500">{selectedDetails.evaluation.etablissement?.localite} • {selectedDetails.evaluation.iepp?.nom}</p>
                </div>
                
                <button 
                  onClick={() => setSelectedEvalId(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1 bg-slate-100 rounded border border-slate-200 transition-colors"
                >
                  Fermer
                </button>
              </div>

              {/* Status Badge & Actions */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Statut de validation</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase border bg-white ${
                    selectedDetails.evaluation.statut === 'valide' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' :
                    selectedDetails.evaluation.statut === 'rejete' ? 'text-rose-700 border-rose-300 bg-rose-50' :
                    selectedDetails.evaluation.statut === 'soumis' ? 'text-blue-700 border-blue-300 bg-blue-50' :
                    selectedDetails.evaluation.statut === 'verrouille' ? 'text-purple-700 border-purple-300 bg-purple-50' :
                    'text-amber-700 border-amber-300 bg-amber-50'
                  }`}>
                    {selectedDetails.evaluation.statut}
                  </span>
                </div>

                {/* SUPERVISOR ACTION MODULES */}
                {/* Submissions are now auto-validated when they pass all compliance checks (see submitEvaluation),
                    so a supervisor's role here is a post-hoc veto (reject / send back to revision) rather than
                    an initial gate. "Valider" stays available only while the record hasn't been auto-validated yet. */}
                {['admin_national', 'superviseur_drena', 'superviseur_iepp'].includes(currentUser.role) &&
                 ['soumis', 'en_revision', 'brouillon', 'valide'].includes(selectedDetails.evaluation.statut) && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Actions de supervision</p>

                    <textarea
                      placeholder="Commentaire ou motif (requis pour rejet ou renvoi en révision)..."
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 h-16"
                      value={supervisionComment}
                      onChange={(e) => setSupervisionComment(e.target.value)}
                    />

                    <div className={`grid gap-2 ${selectedDetails.evaluation.statut === 'valide' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {selectedDetails.evaluation.statut !== 'valide' && (
                        <button
                          onClick={() => handleStatusChange('valide')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                        >
                          Valider
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!supervisionComment.trim()) {
                            alert('Le motif est obligatoire pour rejeter une évaluation.');
                            return;
                          }
                          handleStatusChange('rejete');
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-2 rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Rejeter
                      </button>
                      <button
                        onClick={() => {
                          if (!supervisionComment.trim()) {
                            alert('Veuillez indiquer un commentaire pour orienter l\'enquêteur en révision.');
                            return;
                          }
                          handleStatusChange('en_revision');
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1.5 px-2 rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm shadow-amber-200"
                      >
                        Réviser
                      </button>
                    </div>
                  </div>
                )}

                {/* ADMIN ONLY LOCKING */}
                {currentUser.role === 'admin_national' && selectedDetails.evaluation.statut === 'valide' && (
                  <button
                    onClick={() => handleStatusChange('verrouille')}
                    className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-2 px-3 rounded text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center space-x-2"
                  >
                    <Lock className="h-3 w-3 text-amber-500" />
                    <span>Verrouiller l'évaluation (Officielle)</span>
                  </button>
                )}

                {/* ADMIN ONLY UNLOCKING */}
                {currentUser.role === 'admin_national' && selectedDetails.evaluation.statut === 'verrouille' && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">DÃ©verrouillage administratif</p>
                    <textarea
                      placeholder="Motif obligatoire du dÃ©verrouillage..."
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-purple-500 h-16"
                      value={supervisionComment}
                      onChange={(e) => setSupervisionComment(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleUnlockForRevision}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center space-x-2"
                    >
                      <Unlock className="h-3 w-3 text-purple-100" />
                      <span>DÃ©verrouiller pour rÃ©vision</span>
                    </button>
                  </div>
                )}

                {/* ERROR/SUCCESS MESSAGES */}
                {actionSuccess && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 font-medium">
                    {actionSuccess}
                  </div>
                )}
                {actionError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 font-medium flex items-center space-x-1">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{actionError}</span>
                  </div>
                )}
                {fileOpenError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 font-medium flex items-center space-x-1">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{fileOpenError}</span>
                  </div>
                )}
              </div>

              {/* SCORING RESULTS - Dynamic dashboard rendering */}
              {selectedDetails.score ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white p-5 rounded-xl shadow-md text-center border border-slate-800">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score Global de Fonctionnalité</p>
                    <p className="text-4xl font-mono font-extrabold my-2 text-white">{selectedDetails.score.score_global} <span className="text-slate-500 text-lg">/ 5.0</span></p>
                    
                    <span className={`inline-flex px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedDetails.score.score_global >= 4.25 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      selectedDetails.score.score_global >= 3.50 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      selectedDetails.score.score_global >= 3.00 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {selectedDetails.score.classification}
                    </span>

                    <p className="text-[10px] text-slate-400 mt-3 font-mono">Disponibilité preuves : <span className="font-bold text-white">{selectedDetails.score.taux_disponibilite_preuves}%</span></p>
                  </div>

                  {/* 12 Weighted axes detail list */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1 h-3 bg-amber-500 rounded"></span>
                      Détail des 12 axes d'évaluation
                    </h4>
                    
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2" id="axes-scroll">
                      {[
                        { label: 'Structure institutionnelle (10%)', val: selectedDetails.score.score_axe1 },
                        { label: 'Fonctionnement interne (10%)', val: selectedDetails.score.score_axe2 },
                        { label: 'Gestion administrative & doc (8%)', val: selectedDetails.score.score_axe3 },
                        { label: 'Gestion financière (15%)', val: selectedDetails.score.score_axe4 },
                        { label: 'Planification & redevabilité (10%)', val: selectedDetails.score.score_axe5 },
                        { label: 'Co-gestion & partenariats (8%)', val: selectedDetails.score.score_axe6 },
                        { label: 'Qualité de l\'éducation (10%)', val: selectedDetails.score.score_axe7 },
                        { label: 'Santé, protection & inclusion (8%)', val: selectedDetails.score.score_axe8 },
                        { label: 'Participation communautaire (7%)', val: selectedDetails.score.score_axe9 },
                        { label: 'Genre & représentativité (5%)', val: selectedDetails.score.score_axe10 },
                        { label: 'Résilience & durabilité (4%)', val: selectedDetails.score.score_axe11 },
                        { label: 'Formation des membres (5%)', val: selectedDetails.score.score_axe12 }
                      ].map((axe, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                            <span className="truncate">{idx + 1}. {axe.label}</span>
                            <span className="font-mono font-bold text-slate-800">{axe.val || '3.0'} / 5</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                (axe.val || 3.0) >= 4.0 ? 'bg-emerald-500' :
                                (axe.val || 3.0) >= 3.0 ? 'bg-amber-400' :
                                'bg-rose-400'
                              }`}
                              style={{ width: `${((axe.val || 3.0) / 5) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weak points list if any */}
                  {selectedDetails.score.axes_faibles?.length > 0 && (
                    <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
                      <p className="text-xs font-bold text-rose-800 flex items-center space-x-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>Points faibles identifiés (Score &lt; 3.0) :</span>
                      </p>
                      <ul className="list-disc pl-5 text-[10px] text-rose-900 mt-1 space-y-0.5">
                        {selectedDetails.score.axes_faibles.map((axe: string, idx: number) => (
                          <li key={idx}>{axe}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-lg text-center text-xs text-slate-500 italic border border-slate-200">
                  Les scores globaux et par axe ne sont calculés qu'après soumission définitive de l'évaluation par l'enquêteur.
                </div>
              )}

              {/* MEMBERS LIST SUMMARY */}
              {selectedDetails.membresBe.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                    <Users className="h-4 w-4 text-amber-500" />
                    <span>Membres du Bureau Exécutif ({selectedDetails.membresBe.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-1">
                    {selectedDetails.membresBe.map((mb: any) => (
                      <div key={mb.id} className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center text-[11px]">
                        <div>
                          <p className="font-semibold text-slate-800">{mb.nom_prenoms}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{mb.fonction.replace('_', ' ')} • {mb.genre}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          mb.maitrise_role === 'bonne' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          mb.maitrise_role === 'moyenne' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          rôle: {mb.maitrise_role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DOCUMENT PROOFS SUMMARY */}
              {selectedDetails.preuves.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Preuves documentaires auditées</h4>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {selectedDetails.preuves.map((pr: any) => (
                      <div key={pr.id} className="flex justify-between items-center gap-2 text-[11px] p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="min-w-0">
                          <p className="truncate max-w-[180px] font-semibold text-slate-700">{pr.type_preuve}</p>
                          {pr.fichier_nom_original && (
                            <p className="truncate max-w-[180px] text-[10px] text-emerald-700 font-medium">
                              {pr.fichier_nom_original}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          pr.statut === 'disponible_consultee' ? 'bg-emerald-100 text-emerald-700' :
                          pr.statut === 'declaree_non_presentee' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {pr.statut === 'disponible_consultee' ? 'Disponible' : pr.statut === 'declaree_non_presentee' ? 'Déclarée' : 'Manquant'}
                          </span>
                          {pr.fichier_path && (
                            <button
                              type="button"
                              onClick={() => handleOpenPreuveFile(pr)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0F172A] hover:bg-slate-800 text-white text-[9px] font-bold uppercase"
                              title={`Consulter ${pr.fichier_nom_original || pr.type_preuve}`}
                            >
                              <ExternalLink className="h-3 w-3 text-amber-400" />
                              <span>Voir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GLOBAL EXPORTS FROM DETAILS DRAWER */}
              <div className="border-t border-slate-200 pt-4 mt-auto grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowFilledForm(true)}
                  className="bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-2 px-3 rounded border border-slate-800 text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Eye className="h-3 w-3 text-amber-400" />
                  <span>Formulaire</span>
                </button>
                <button
                  onClick={() => handleExportCSV('raw')}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded border border-slate-200 text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Download className="h-3 w-3" />
                  <span>Données (CSV)</span>
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold py-2 px-3 rounded border border-slate-300 text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <FileText className="h-3 w-3" />
                  <span>Fiche COGES (PDF)</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
