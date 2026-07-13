/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { DataService } from '../data/dataService';
import { Campagne, CampagneStatut } from '../types';
import {
  CalendarRange,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X
} from 'lucide-react';

interface CampagneFormState {
  id?: string;
  nom: string;
  annee_scolaire: string;
  date_debut: string;
  date_fin: string;
  statut: CampagneStatut;
}

const emptyForm: CampagneFormState = {
  nom: '',
  annee_scolaire: '',
  date_debut: '',
  date_fin: '',
  statut: 'ouverte'
};

export default function CampagneManager() {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CampagneFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await DataService.getCampagnes();
      const sorted = [...data].sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));
      setCampagnes(sorted);
    } catch (err: any) {
      console.error(err);
      setError('Impossible de charger la liste des campagnes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const openCreateForm = () => {
    resetFeedback();
    setForm({ ...emptyForm, statut: campagnes.some(c => c.statut === 'ouverte') ? 'fermee' : 'ouverte' });
    setShowForm(true);
  };

  const openEditForm = (c: Campagne) => {
    resetFeedback();
    setForm({
      id: c.id,
      nom: c.nom,
      annee_scolaire: c.annee_scolaire,
      date_debut: c.date_debut,
      date_fin: c.date_fin || '',
      statut: c.statut
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!form.nom.trim()) return setError("Le nom de la campagne est obligatoire.");
    if (!form.annee_scolaire.trim()) return setError("L'année scolaire est obligatoire.");
    if (!form.date_debut) return setError('La date de début est obligatoire.');
    if (form.date_fin && form.date_fin < form.date_debut) {
      return setError('La date de fin ne peut pas être antérieure à la date de début.');
    }

    setSaving(true);
    try {
      if (form.id) {
        const result = await DataService.updateCampagne(form.id, {
          nom: form.nom.trim(),
          annee_scolaire: form.annee_scolaire.trim(),
          date_debut: form.date_debut,
          date_fin: form.date_fin || undefined,
          statut: form.statut
        });
        if (!result.success) return setError(result.error || 'Erreur lors de la mise à jour.');
        setSuccess('Campagne mise à jour avec succès.');
      } else {
        const result = await DataService.createCampagne({
          nom: form.nom.trim(),
          annee_scolaire: form.annee_scolaire.trim(),
          date_debut: form.date_debut,
          date_fin: form.date_fin || undefined,
          statut: form.statut
        });
        if (!result.success) return setError(result.error || 'Erreur lors de la création.');
        setSuccess('Campagne créée avec succès.');
      }
      closeForm();
      await load();
    } catch (err: any) {
      console.error(err);
      setError("Une erreur inattendue s'est produite.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatut = async (c: Campagne) => {
    resetFeedback();
    const nextStatut: CampagneStatut = c.statut === 'ouverte' ? 'fermee' : 'ouverte';
    if (nextStatut === 'ouverte' && !window.confirm(`Activer "${c.nom}" clôturera automatiquement toute autre campagne active. Continuer ?`)) {
      return;
    }
    try {
      const result = await DataService.updateCampagne(c.id, { statut: nextStatut });
      if (!result.success) {
        setError(result.error || 'Erreur lors du changement de statut.');
        return;
      }
      setSuccess(nextStatut === 'ouverte' ? `Campagne "${c.nom}" activée.` : `Campagne "${c.nom}" clôturée.`);
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    }
  };

  const handleDelete = async (c: Campagne) => {
    resetFeedback();
    if (!window.confirm(`Supprimer définitivement la campagne "${c.nom}" ? Cette action est irréversible.`)) return;
    try {
      const result = await DataService.deleteCampagne(c.id);
      if (!result.success) {
        setError(result.error || 'Erreur lors de la suppression.');
        return;
      }
      setSuccess('Campagne supprimée.');
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
            <span className="w-1.5 h-4 bg-amber-500 rounded-sm"></span>
            Gestion des campagnes de collecte EROF
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Une seule campagne peut être active à la fois. Les nouvelles évaluations sont automatiquement rattachées à la campagne active.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg px-3.5 py-2 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle campagne
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {form.id ? 'Modifier la campagne' : 'Créer une nouvelle campagne'}
            </h3>
            <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom de la campagne *</label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex: Campagne EROF 2026"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Année scolaire *</label>
              <input
                type="text"
                value={form.annee_scolaire}
                onChange={(e) => setForm({ ...form, annee_scolaire: e.target.value })}
                placeholder="Ex: 2025-2026"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date de début *</label>
              <input
                type="date"
                value={form.date_debut}
                onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date de fin (optionnel)</label>
              <input
                type="date"
                value={form.date_fin}
                onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Statut</label>
              <select
                value={form.statut}
                onChange={(e) => setForm({ ...form, statut: e.target.value as CampagneStatut })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
              >
                <option value="ouverte">Ouverte (active)</option>
                <option value="fermee">Fermée</option>
              </select>
              {form.statut === 'ouverte' && (
                <p className="text-[10px] text-amber-600 font-semibold mt-1">Activer cette campagne clôturera automatiquement toute autre campagne actuellement active.</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors shadow-sm"
            >
              {saving ? 'Enregistrement...' : form.id ? 'Enregistrer les modifications' : 'Créer la campagne'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Chargement des campagnes...</span>
        </div>
      ) : campagnes.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs font-mono flex flex-col items-center gap-2">
          <CalendarRange className="h-8 w-8 text-slate-300" />
          <span>Aucune campagne configurée pour le moment.</span>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-[11px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Année scolaire</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Début</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Fin</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {campagnes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-800">{c.nom}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-mono">{c.annee_scolaire}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-mono">{c.date_debut}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-mono">{c.date_fin || '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                      c.statut === 'ouverte'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {c.statut === 'ouverte' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {c.statut === 'ouverte' ? 'Active' : 'Fermée'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleStatut(c)}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                          c.statut === 'ouverte'
                            ? 'text-slate-500 border-slate-200 hover:bg-slate-100'
                            : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {c.statut === 'ouverte' ? 'Clôturer' : 'Activer'}
                      </button>
                      <button
                        onClick={() => openEditForm(c)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
