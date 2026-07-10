/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  DataService, 
  PRE_SEEDED_DRENAS, 
  PRE_SEEDED_IEPPS 
} from '../data/dataService';
import { Evaluation, User, EvaluationScore, PreuveDocumentaire, MembreBe, Recommandation, EvaluationStatus } from '../types';
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
  Award
} from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onEditEvaluation: (id: string) => void;
  onNewEvaluation: () => void;
}

export default function Dashboard({ currentUser, onEditEvaluation, onNewEvaluation }: DashboardProps) {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrena, setSelectedDrena] = useState('');
  const [selectedIepp, setSelectedIepp] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Selected evaluation for details drawer/panel
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [supervisionComment, setSupervisionComment] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Handle detailed evaluation load
  useEffect(() => {
    if (selectedEvalId) {
      loadDetails(selectedEvalId);
    } else {
      setSelectedDetails(null);
    }
  }, [selectedEvalId]);

  const loadDetails = async (id: string) => {
    setLoadingDetails(true);
    setActionSuccess(null);
    setActionError(null);
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
    <div className="space-y-6">
      {/* Upper Status Banner / Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="stats-bento">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
            <School className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Évaluations totales</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-amber-500 rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Brouillons / Révisions</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{draftCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-blue-500 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Soumises à valider</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{submittedCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-emerald-500 rounded-lg">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Validées & Officielles</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{validatedCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center space-x-4">
          <div className="p-3 bg-slate-100 text-[#0F172A] rounded-lg">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Moyenne Nationale</p>
            <p className="text-2xl font-mono font-bold text-slate-800">{isNaN(averageScore) ? 'N/A' : `${averageScore} / 5`}</p>
          </div>
        </div>
      </div>

      {/* Main operational panel divided into table (left/top) and details drawer (right/bottom) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Evaluations list - 2 cols on wide, full on mobile */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* Header & Search */}
          <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-amber-500 rounded"></span>
                Registre des Évaluations EROF
              </h2>
              <p className="text-xs text-slate-500">Gérez, validez et filtrez les formulaires de collecte de terrain</p>
            </div>

            {currentUser.role === 'enqueteur' && (
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
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium"
                value={selectedDrena}
                onChange={(e) => setSelectedDrena(e.target.value)}
              >
                <option value="">Toutes les DRENA</option>
                {PRE_SEEDED_DRENAS.map(d => (
                  <option key={d.id} value={d.nom}>{d.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium"
                value={selectedIepp}
                onChange={(e) => setSelectedIepp(e.target.value)}
              >
                <option value="">Toutes les IEPP</option>
                {PRE_SEEDED_IEPPS.map(i => (
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

          {/* Evaluations Table */}
          <div className="overflow-x-auto flex-1">
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
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-[#0F172A] text-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Identifiant / Établissement</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Localisation</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Statut</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Score / Éval</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredEvaluations.map((ev) => {
                    const statusConfig = {
                      brouillon: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: 'Brouillon' },
                      soumis: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Soumis' },
                      en_revision: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', label: 'En Révision' },
                      valide: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Validé' },
                      rejete: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', label: 'Rejeté' },
                      verrouille: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', label: 'Verrouillé' }
                    }[ev.statut as EvaluationStatus] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: ev.statut };

                    const isSelected = selectedEvalId === ev.id;

                    return (
                      <tr 
                        key={ev.id} 
                        onClick={() => setSelectedEvalId(ev.id)}
                        className={`hover:bg-slate-50 cursor-pointer transition-all ${isSelected ? 'bg-amber-50/50 border-l-4 border-l-amber-500 font-medium' : ''}`}
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-slate-100 text-slate-700 rounded">
                              <School className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{ev.etablissement_nom || 'École inconnue'}</div>
                              <div className="text-[11px] font-mono text-slate-400">ID: {ev.id.substring(0, 13)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-600">{ev.drena_nom || 'DRENA N/A'}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{ev.iepp_nom || 'IEPP N/A'}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5"></span>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {ev.score_global ? (
                            <div>
                              <div className="text-sm font-mono font-bold text-slate-800">{ev.score_global} / 5</div>
                              <div className="text-[9px] text-slate-400 tracking-tight font-bold uppercase">{ev.classification}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Non calculé (brouillon)</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-2">
                            <button 
                              onClick={() => setSelectedEvalId(ev.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors border border-slate-200 bg-white shadow-sm"
                              title="Consulter le rapport"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            {/* Edit draft (Enqueteur only & modifiable states) */}
                            {currentUser.role === 'enqueteur' && (ev.statut === 'brouillon' || ev.statut === 'en_revision') && (
                              <button 
                                onClick={() => onEditEvaluation(ev.id)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors border border-blue-200 bg-white shadow-sm"
                                title="Modifier le brouillon"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detailed reports drawer - 1 col on wide */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[500px]">
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
                {/* RLS limits validation to superviseur_drena, superviseur_iepp and admin_national on submitted state */}
                {['admin_national', 'superviseur_drena', 'superviseur_iepp'].includes(currentUser.role) && 
                 ['soumis', 'en_revision', 'brouillon'].includes(selectedDetails.evaluation.statut) && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Actions de supervision</p>
                    
                    <textarea
                      placeholder="Commentaire ou motif (requis pour rejet ou renvoi en révision)..."
                      className="w-full p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 h-16"
                      value={supervisionComment}
                      onChange={(e) => setSupervisionComment(e.target.value)}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleStatusChange('valide')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 rounded text-[10px] uppercase tracking-wider transition-colors shadow-sm"
                      >
                        Valider
                      </button>
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
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          mb.maitrise_role === 'bonne' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          mb.maitrise_role === 'moyenne' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          rôle: {mb.maitrise_role}
                        </span>
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
                      <div key={pr.id} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 rounded border border-slate-200">
                        <span className="truncate max-w-[180px] font-semibold text-slate-700">{pr.type_preuve}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          pr.statut === 'disponible_consultee' ? 'bg-emerald-100 text-emerald-700' :
                          pr.statut === 'declaree_non_presentee' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {pr.statut === 'disponible_consultee' ? 'Disponible' : pr.statut === 'declaree_non_presentee' ? 'Déclarée' : 'Manquant'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GLOBAL EXPORTS FROM DETAILS DRAWER */}
              <div className="border-t border-slate-200 pt-4 mt-auto grid grid-cols-2 gap-2">
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
