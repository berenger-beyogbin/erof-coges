/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../data/dataService';
import { Drena, Iepp, User, UserRole } from '../types';
import { isSupabaseConfigured } from '../supabaseClient';
import {
  Users as UsersIcon,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  ShieldCheck,
  Search,
  KeyRound
} from 'lucide-react';

interface UserManagerProps {
  currentUser: User;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin_national: 'Admin National (DAPS-COGES)',
  superviseur_drena: 'Directeur Régional (DRENA)',
  superviseur_iepp: 'Inspecteur Chef (IEPP)',
  enqueteur: 'Enquêteur Terrain',
  lecteur: 'Observateur (Lecteur)'
};

const ROLE_OPTIONS: UserRole[] = ['admin_national', 'superviseur_drena', 'superviseur_iepp', 'enqueteur', 'lecteur'];
const ROWS_PER_PAGE = 10;

function roleRequiresDrena(role: UserRole): boolean {
  return role === 'superviseur_drena' || role === 'superviseur_iepp' || role === 'enqueteur';
}
function roleRequiresIepp(role: UserRole): boolean {
  return role === 'superviseur_iepp';
}

interface CreateFormState {
  email: string;
  password: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: UserRole;
  drena_id: string;
  iepp_id: string;
}

const emptyCreateForm: CreateFormState = {
  email: '',
  password: '',
  nom: '',
  prenom: '',
  telephone: '',
  role: 'enqueteur',
  drena_id: '',
  iepp_id: ''
};

interface EditFormState {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: UserRole;
  drena_id: string;
  iepp_id: string;
  actif: boolean;
}

export default function UserManager({ currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [drenas, setDrenas] = useState<Drena[]>([]);
  const [iepps, setIepps] = useState<Iepp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'tous' | UserRole>('tous');
  const [statutFilter, setStatutFilter] = useState<'tous' | 'actif' | 'inactif'>('tous');
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [userList, drenaList, ieppList] = await Promise.all([
        DataService.getAllUsers(),
        DataService.getDrenas(),
        DataService.getIepps()
      ]);
      setUsers([...userList].sort((a, b) => a.nom.localeCompare(b.nom)));
      setDrenas(drenaList);
      setIepps(ieppList);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger la liste des utilisateurs.');
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

  const drenaNom = (id?: string) => drenas.find(d => d.id === id)?.nom || '—';
  const ieppNom = (id?: string) => iepps.find(i => i.id === id)?.nom || '—';

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'tous' && u.role !== roleFilter) return false;
      if (statutFilter === 'actif' && !u.actif) return false;
      if (statutFilter === 'inactif' && u.actif) return false;
      if (term && !(`${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [users, search, roleFilter, statutFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statutFilter, users.length]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + ROWS_PER_PAGE);
  const pageEnd = Math.min(pageStart + paginatedUsers.length, filteredUsers.length);

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  // Create form handlers
  const openCreateForm = () => {
    resetFeedback();
    setCreateForm(emptyCreateForm);
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCreateForm(emptyCreateForm);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!createForm.email.trim() || !createForm.nom.trim() || !createForm.prenom.trim()) {
      setError('Le nom, le prénom et l\'e-mail sont obligatoires.');
      return;
    }
    if (isSupabaseConfigured && (!createForm.password || createForm.password.length < 8)) {
      setError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (roleRequiresDrena(createForm.role) && !createForm.drena_id) {
      setError('La DRENA de rattachement est obligatoire pour ce rôle.');
      return;
    }
    if (roleRequiresIepp(createForm.role) && !createForm.iepp_id) {
      setError('L\'IEPP de rattachement est obligatoire pour ce rôle.');
      return;
    }

    setCreating(true);
    try {
      const result = await DataService.createUserAdmin({
        email: createForm.email.trim(),
        password: createForm.password || Math.random().toString(36).slice(2) + 'Aa1!',
        nom: createForm.nom.trim(),
        prenom: createForm.prenom.trim(),
        role: createForm.role,
        drena_id: roleRequiresDrena(createForm.role) ? createForm.drena_id : undefined,
        iepp_id: (createForm.role === 'superviseur_iepp' || createForm.role === 'enqueteur') ? (createForm.iepp_id || undefined) : undefined,
        telephone: createForm.telephone.trim() || undefined
      });
      if (!result.success) {
        setError(result.error || 'Erreur lors de la création du compte.');
        return;
      }
      setSuccess(`Compte créé avec succès pour ${createForm.prenom} ${createForm.nom}.`);
      closeCreateForm();
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    } finally {
      setCreating(false);
    }
  };

  // Edit form handlers
  const openEditForm = (u: User) => {
    resetFeedback();
    setEditForm({
      id: u.id,
      nom: u.nom,
      prenom: u.prenom,
      telephone: u.telephone || '',
      role: u.role,
      drena_id: u.drena_id || '',
      iepp_id: u.iepp_id || '',
      actif: u.actif !== false
    });
  };

  const closeEditForm = () => setEditForm(null);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    resetFeedback();

    if (!editForm.nom.trim() || !editForm.prenom.trim()) {
      setError('Le nom et le prénom sont obligatoires.');
      return;
    }
    if (roleRequiresDrena(editForm.role) && !editForm.drena_id) {
      setError('La DRENA de rattachement est obligatoire pour ce rôle.');
      return;
    }
    if (roleRequiresIepp(editForm.role) && !editForm.iepp_id) {
      setError('L\'IEPP de rattachement est obligatoire pour ce rôle.');
      return;
    }
    if (editForm.id === currentUser.id && editForm.role !== 'admin_national') {
      setError('Vous ne pouvez pas retirer votre propre rôle d\'administrateur national.');
      return;
    }
    if (editForm.id === currentUser.id && !editForm.actif) {
      setError('Vous ne pouvez pas désactiver votre propre compte.');
      return;
    }

    setSaving(true);
    try {
      const result = await DataService.updateUserProfile(editForm.id, {
        nom: editForm.nom.trim(),
        prenom: editForm.prenom.trim(),
        telephone: editForm.telephone.trim() || undefined,
        role: editForm.role,
        drena_id: roleRequiresDrena(editForm.role) ? editForm.drena_id : null,
        iepp_id: (editForm.role === 'superviseur_iepp' || editForm.role === 'enqueteur') ? (editForm.iepp_id || null) : null,
        actif: editForm.actif
      });
      if (!result.success) {
        setError(result.error || 'Erreur lors de la mise à jour.');
        return;
      }
      setSuccess('Profil utilisateur mis à jour avec succès.');
      closeEditForm();
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActif = async (u: User) => {
    resetFeedback();
    if (u.id === currentUser.id) {
      setError('Vous ne pouvez pas désactiver votre propre compte.');
      return;
    }
    const nextActif = !(u.actif !== false);
    if (!nextActif && !window.confirm(`Désactiver le compte de ${u.prenom} ${u.nom} ? La personne ne pourra plus se connecter.`)) {
      return;
    }
    try {
      const result = await DataService.updateUserProfile(u.id, { actif: nextActif });
      if (!result.success) {
        setError(result.error || 'Erreur lors du changement de statut.');
        return;
      }
      setSuccess(nextActif ? `Compte de ${u.prenom} ${u.nom} réactivé.` : `Compte de ${u.prenom} ${u.nom} désactivé.`);
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    }
  };

  const handleDelete = async (u: User) => {
    resetFeedback();
    if (u.id === currentUser.id) {
      setError('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    if (!window.confirm(`Supprimer définitivement le profil de ${u.prenom} ${u.nom} ? Cette action est irréversible.`)) return;
    try {
      const result = await DataService.deleteUserProfile(u.id);
      if (!result.success) {
        setError(result.error || 'Erreur lors de la suppression.');
        return;
      }
      setSuccess('Utilisateur supprimé.');
      await load();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    }
  };

  const openResetPassword = (u: User) => {
    resetFeedback();
    setResetPasswordValue('');
    setResetPasswordUser(u);
  };

  const closeResetPassword = () => {
    setResetPasswordUser(null);
    setResetPasswordValue('');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    resetFeedback();

    if (resetPasswordValue.length < 8) {
      setError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    setResettingPassword(true);
    try {
      const result = await DataService.resetUserPassword(resetPasswordUser.id, resetPasswordValue);
      if (!result.success) {
        setError(result.error || 'Erreur lors de la réinitialisation du mot de passe.');
        return;
      }
      setSuccess(`Mot de passe réinitialisé pour ${resetPasswordUser.prenom} ${resetPasswordUser.nom}. Communiquez-lui le nouveau mot de passe.`);
      closeResetPassword();
    } catch (err) {
      console.error(err);
      setError('Une erreur inattendue est survenue.');
    } finally {
      setResettingPassword(false);
    }
  };

  const ieppsForDrena = (drenaId: string) => iepps.filter(i => i.drena_id === drenaId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
            <span className="w-1.5 h-4 bg-amber-500 rounded-sm"></span>
            Gestion des utilisateurs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Créez, modifiez le rôle/rattachement, activez ou désactivez les comptes d'accès à la plateforme EROF COGES.
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
            Nouvel utilisateur
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou e-mail..."
            className="w-full text-xs border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
        >
          <option value="tous">Tous les rôles</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value as any)}
          className="text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
        >
          <option value="tous">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Inactifs</option>
        </select>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Créer un nouvel utilisateur</h3>
            <button type="button" onClick={closeCreateForm} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Prénom(s) *</label>
              <input
                type="text"
                value={createForm.prenom}
                onChange={(e) => setCreateForm({ ...createForm, prenom: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom *</label>
              <input
                type="text"
                value={createForm.nom}
                onChange={(e) => setCreateForm({ ...createForm, nom: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Adresse e-mail *</label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="nom.prenoms@mena.ci"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Téléphone</label>
              <input
                type="text"
                value={createForm.telephone}
                onChange={(e) => setCreateForm({ ...createForm, telephone: e.target.value })}
                placeholder="10 chiffres"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
            {isSupabaseConfigured && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Mot de passe provisoire *</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Au moins 8 caractères — à transmettre à l'utilisateur"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-mono"
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Rôle *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole, drena_id: '', iepp_id: '' })}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {roleRequiresDrena(createForm.role) && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">DRENA de rattachement *</label>
                <select
                  value={createForm.drena_id}
                  onChange={(e) => setCreateForm({ ...createForm, drena_id: e.target.value, iepp_id: '' })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                >
                  <option value="" disabled>Sélectionnez...</option>
                  {drenas.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
            )}
            {createForm.role === 'superviseur_iepp' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">IEPP de rattachement *</label>
                <select
                  value={createForm.iepp_id}
                  onChange={(e) => setCreateForm({ ...createForm, iepp_id: e.target.value })}
                  disabled={!createForm.drena_id}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white disabled:opacity-50"
                >
                  <option value="" disabled>{!createForm.drena_id ? 'Sélectionnez d\'abord une DRENA' : 'Sélectionnez...'}</option>
                  {ieppsForDrena(createForm.drena_id).map(i => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                </select>
              </div>
            )}
            {createForm.role === 'enqueteur' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">IEPP de rattachement (optionnel)</label>
                <select
                  value={createForm.iepp_id}
                  onChange={(e) => setCreateForm({ ...createForm, iepp_id: e.target.value })}
                  disabled={!createForm.drena_id}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white disabled:opacity-50"
                >
                  <option value="">Aucune (rattaché à la DRENA entière)</option>
                  {ieppsForDrena(createForm.drena_id).map(i => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeCreateForm}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating}
              className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors shadow-sm"
            >
              {creating ? 'Création...' : 'Créer le compte'}
            </button>
          </div>
        </form>
      )}

      {/* Edit modal */}
      {editForm && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50" onClick={closeEditForm}>
          <form
            onSubmit={handleEditSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 space-y-4 w-full max-w-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                Modifier l'utilisateur
              </h3>
              <button type="button" onClick={closeEditForm} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Prénom(s)</label>
                <input
                  type="text"
                  value={editForm.prenom}
                  onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Nom</label>
                <input
                  type="text"
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={editForm.telephone}
                  onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Rôle</label>
                <select
                  value={editForm.role}
                  disabled={editForm.id === currentUser.id}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole, drena_id: '', iepp_id: '' })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {editForm.id === currentUser.id && (
                  <p className="text-[10px] text-slate-400 mt-1">Vous ne pouvez pas modifier votre propre rôle.</p>
                )}
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 py-2">
                  <input
                    type="checkbox"
                    checked={editForm.actif}
                    disabled={editForm.id === currentUser.id}
                    onChange={(e) => setEditForm({ ...editForm, actif: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                  />
                  Compte actif
                </label>
              </div>
              {roleRequiresDrena(editForm.role) && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">DRENA de rattachement</label>
                  <select
                    value={editForm.drena_id}
                    onChange={(e) => setEditForm({ ...editForm, drena_id: e.target.value, iepp_id: '' })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                  >
                    <option value="" disabled>Sélectionnez...</option>
                    {drenas.map(d => (
                      <option key={d.id} value={d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              )}
              {(editForm.role === 'superviseur_iepp' || editForm.role === 'enqueteur') && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    IEPP de rattachement{editForm.role === 'enqueteur' ? ' (optionnel)' : ''}
                  </label>
                  <select
                    value={editForm.iepp_id}
                    onChange={(e) => setEditForm({ ...editForm, iepp_id: e.target.value })}
                    disabled={!editForm.drena_id}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white disabled:opacity-50"
                  >
                    <option value="">{editForm.role === 'enqueteur' ? 'Aucune' : 'Sélectionnez...'}</option>
                    {ieppsForDrena(editForm.drena_id).map(i => (
                      <option key={i.id} value={i.id}>{i.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeEditForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors shadow-sm"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset password modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center p-4 z-50" onClick={closeResetPassword}>
          <form
            onSubmit={handleResetPasswordSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 space-y-4 w-full max-w-md"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-500" />
                Réinitialiser le mot de passe
              </h3>
              <button type="button" onClick={closeResetPassword} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Nouveau mot de passe provisoire pour <strong>{resetPasswordUser.prenom} {resetPasswordUser.nom}</strong> ({resetPasswordUser.email}). Communiquez-le lui après validation ; il ne sera plus jamais réaffiché.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Nouveau mot de passe *</label>
              <input
                type="text"
                autoFocus
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Au moins 8 caractères"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeResetPassword}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={resettingPassword}
                className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors shadow-sm"
              >
                {resettingPassword ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Chargement des utilisateurs...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs font-mono flex flex-col items-center gap-2">
          <UsersIcon className="h-8 w-8 text-slate-300" />
          <span>Aucun utilisateur ne correspond aux critères sélectionnés.</span>
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200 rounded-xl">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-[11px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Nom</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">E-mail</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Rôle</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Rattachement</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-800">
                    {u.prenom} {u.nom}
                    {u.id === currentUser.id && (
                      <span className="ml-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 align-middle">VOUS</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-mono">{u.email}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-semibold">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    {u.iepp_id ? ieppNom(u.iepp_id) : u.drena_id ? drenaNom(u.drena_id) : '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                      u.actif !== false
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {u.actif !== false ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {u.actif !== false ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => toggleActif(u)}
                        disabled={u.id === currentUser.id}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.actif !== false
                            ? 'text-slate-500 border-slate-200 hover:bg-slate-100'
                            : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {u.actif !== false ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => openEditForm(u)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {isSupabaseConfigured && (
                        <button
                          onClick={() => openResetPassword(u)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          title="Réinitialiser le mot de passe"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser.id}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-500">
              Affichage {filteredUsers.length === 0 ? 0 : pageStart + 1}-{pageEnd} sur {filteredUsers.length} · 10 lignes par page
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
                aria-label="Navigation des pages du tableau des utilisateurs"
                className="w-32 accent-amber-500 disabled:opacity-40"
              />
              <span className="text-[11px] font-bold text-slate-500 min-w-10 text-center">
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
        </div>
      )}
    </div>
  );
}
