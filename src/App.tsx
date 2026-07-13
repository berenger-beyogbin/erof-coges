/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import EvaluationForm from './components/EvaluationForm';
import Login from './components/Login';
import CampagneManager from './components/CampagneManager';
import UserManager from './components/UserManager';
import { DataService, SupabaseDataService } from './data/dataService';
import { User, AuditLog } from './types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { 
  Shield, 
  Users, 
  Database, 
  Clock,
  LayoutDashboard,
  SlidersHorizontal,
  LogOut,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Server,
  CalendarRange
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campagnes' | 'utilisateurs' | 'logs' | 'about'>('dashboard');
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);
  
  // Audit Logs
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Real-time clock (UTC display)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize DataService and restore auth session if Supabase is configured
  useEffect(() => {
    const initAuth = async () => {
      DataService.initialize();

      if (isSupabaseConfigured) {
        try {
          // Restore Supabase Auth Session
          const { data: { session } } = await supabase!.auth.getSession();
          if (session?.user) {
            const profileResult = await SupabaseDataService.getAuthenticatedUserProfile(session.user.id);

            if (profileResult.user && profileResult.user.actif === true) {
              setCurrentUser(profileResult.user);
            } else {
              // Sign out if profile not found or errored
              await supabase!.auth.signOut();
            }
          }
        } catch (err) {
          console.error('Failed to restore Supabase session', err);
        }
      } else {
        // Local mode: load session user if exists
        try {
          const localUser = DataService.getSessionUser();
          if (localUser) {
            setCurrentUser(localUser);
          }
        } catch (_) {}
      }
      setAuthInitialized(true);
    };

    initAuth();

    // Set up auth changes listener in production
    let authListenerSubscription: any = null;
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profileResult = await SupabaseDataService.getAuthenticatedUserProfile(session.user.id);
          if (profileResult.user && profileResult.user.actif === true) {
            setCurrentUser(profileResult.user);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      });
      authListenerSubscription = subscription;
    }

    return () => {
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
    };
  }, []);

  // Update session context on change (mainly local demo)
  useEffect(() => {
    if (currentUser && !isSupabaseConfigured) {
      DataService.setSessionUser(currentUser);
    }
  }, [currentUser]);

  // Load audit logs
  const loadLogs = async () => {
    if (!currentUser) return;
    setLoadingLogs(true);
    try {
      const data = await DataService.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && currentUser?.role === 'admin_national') {
      loadLogs();
    }
  }, [activeTab, currentUser]);

  const handleEditEvaluation = (id: string) => {
    setEditingEvalId(id);
    setActiveView('form');
  };

  const handleNewEvaluation = () => {
    setEditingEvalId(null);
    setActiveView('form');
  };

  const handleCloseForm = () => {
    setEditingEvalId(null);
    setActiveView('list');
  };

  const handleLogout = async () => {
    if (window.confirm('Voulez-vous vraiment vous déconnecter ?')) {
      if (isSupabaseConfigured) {
        await supabase!.auth.signOut();
      } else {
        DataService.clearSessionUser();
      }
      setCurrentUser(null);
      setActiveView('list');
      setActiveTab('dashboard');
    }
  };

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center text-white space-y-4 font-mono">
        <svg className="animate-spin h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-semibold tracking-wider text-slate-400">Restaurateur de session sécurisée...</span>
      </div>
    );
  }

  // Render Auth screen if not authenticated
  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] flex flex-col text-slate-900">
      
      {/* Decorative Côte d'Ivoire flag strip at the top */}
      <div className="h-1.5 w-full flex">
        <div className="h-full bg-[#FF8200] flex-1"></div>
        <div className="h-full bg-white flex-1"></div>
        <div className="h-full bg-[#009E49] flex-1"></div>
      </div>

      {/* Main App Header */}
      <header className="bg-[#101828] border-b border-slate-700/70 text-white shadow-lg shadow-slate-900/15">
        <div className="app-shell py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-[#0F172A] font-extrabold text-xl shrink-0 shadow-md border border-amber-400">
              E
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-amber-500">République de Côte d'Ivoire</p>
              <h1 className="text-lg font-extrabold tracking-tight font-display text-white">EROF COGES • DAPS-COGES</h1>
              <p className="text-[11px] text-slate-400 font-medium">Évaluation Rapide Organisationnelle et Fonctionnelle des COGES</p>
            </div>
          </div>

          {/* Connected User Profile Indicator */}
          <div className="max-w-full flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-100 leading-tight">{currentUser.prenom} {currentUser.nom}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  Rôle : {
                    currentUser.role === 'admin_national' ? 'Admin Central (DAPS-COGES)' :
                    currentUser.role === 'superviseur_drena' ? 'Directeur Régional (DRENA)' :
                    currentUser.role === 'superviseur_iepp' ? 'Inspecteur Chef (IEPP)' :
                    currentUser.role === 'enqueteur' ? 'Enquêteur Terrain' : 'Observateur Public'
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isSupabaseConfigured ? (
                <div className="flex items-center space-x-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 font-mono">
                  <Server className="h-3 w-3" />
                  <span>SUPABASE CONNECTÉ</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-[9px] text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 font-mono">
                  <Database className="h-3 w-3" />
                  <span>MODE DÉMO LOCAL ACTIF</span>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 p-1.5 rounded-lg border border-red-500/20 transition-all"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <div className="bg-[#1E293B] border-b border-slate-700 shadow-sm text-slate-300">
        <div className="app-shell flex flex-col xl:flex-row xl:items-center justify-between py-1 gap-2">
          
          <div className="flex flex-wrap items-center gap-2 py-2 min-w-0">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setActiveView('list');
              }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-800 text-white border-slate-600 shadow-sm shadow-slate-950/25' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Tableau de Bord</span>
            </button>

            {currentUser.role === 'admin_national' && (
              <button
                onClick={() => setActiveTab('campagnes')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                  activeTab === 'campagnes'
                    ? 'bg-slate-800 text-white border-slate-600 shadow-sm shadow-slate-950/25'
                    : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                <span>Campagnes</span>
              </button>
            )}

            {currentUser.role === 'admin_national' && (
              <button
                onClick={() => setActiveTab('utilisateurs')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                  activeTab === 'utilisateurs'
                    ? 'bg-slate-800 text-white border-slate-600 shadow-sm shadow-slate-950/25'
                    : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Utilisateurs</span>
              </button>
            )}

            {currentUser.role === 'admin_national' && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                  activeTab === 'logs' 
                    ? 'bg-slate-800 text-white border-slate-600 shadow-sm shadow-slate-950/25' 
                    : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Registre d'Audit de Sécurité</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('about')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === 'about' 
                  ? 'bg-slate-800 text-white border-slate-600 shadow-sm shadow-slate-950/25' 
                  : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              <span>À propos d'EROF</span>
            </button>
          </div>

          {/* Current Local UTC Time */}
          <div className="shrink-0 text-right text-xs text-slate-400 font-mono flex items-center justify-end space-x-1.5 py-2">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <span>Horloge universelle (UTC) :</span>
            <span className="font-bold text-slate-200">{currentTime.toISOString().replace('T', ' ').substring(0, 19)}</span>
          </div>

        </div>
      </div>

      {/* Main Workspace Frame */}
      <main className="app-shell flex-1 py-7 overflow-x-hidden">
        
        {activeTab === 'dashboard' && (
          activeView === 'list' ? (
            <Dashboard 
              currentUser={currentUser}
              onEditEvaluation={handleEditEvaluation}
              onNewEvaluation={handleNewEvaluation}
            />
          ) : (
            <EvaluationForm 
              currentUser={currentUser}
              evaluationId={editingEvalId}
              onClose={handleCloseForm}
            />
          )
        )}

        {/* Campaign management tab panel */}
        {activeTab === 'campagnes' && currentUser.role === 'admin_national' && (
          <CampagneManager />
        )}

        {/* User management tab panel */}
        {activeTab === 'utilisateurs' && currentUser.role === 'admin_national' && (
          <UserManager currentUser={currentUser} />
        )}

        {/* Audit Logs tab panel */}
        {activeTab === 'logs' && currentUser.role === 'admin_national' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
                <span className="w-1.5 h-4 bg-amber-500 rounded-sm"></span>
                Registre d'audit de sécurité des évaluations (RLS)
              </h2>
              <p className="text-xs text-slate-500 mt-1">Toutes les transitions de statut, validations et téléversements de preuves documentaires de terrain sont journalisés pour conformité réglementaire.</p>
            </div>

            {loadingLogs ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Chargement de l'historique...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs font-mono">Aucune activité enregistrée pour le moment.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Horodatage</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Utilisateur ID</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Table Cible</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">ID de Ligne</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider">Détail des données</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-mono">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 text-[10px]">
                          {log.created_at ? new Date(log.created_at).toLocaleString('fr-FR') : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-sans font-semibold text-slate-700">{log.user_id}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-bold text-amber-600">{log.action}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 font-bold uppercase tracking-tight text-[9px]">{log.table_cible}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-900 font-semibold">{log.ligne_id}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-[10px] max-w-xs truncate">
                          {log.donnees_avant || log.donnees_apres ? (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-semibold">
                              {log.donnees_avant ? 'Modifié' : 'Enregistré'}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-sans italic">Aucun détail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* About tab panel */}
        {activeTab === 'about' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6 max-w-4xl mx-auto">
            <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-200 pb-3 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-amber-500 rounded-sm"></span>
              À propos de l'Évaluation Rapide EROF COGES
            </h2>
            
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              <p>
                L'<strong>Évaluation Rapide Organisationnelle et Fonctionnelle (EROF)</strong> est un instrument officiel de diagnostic national instauré par la Direction de l'Animation, de la Promotion et du Suivi des COGES (DAPS-COGES) du MENAET.
              </p>
              
              <h3 className="text-sm font-bold text-slate-800 mt-4 uppercase tracking-wider font-display">Méthodologie & Scoring</h3>
              <p>
                L'évaluation couvre 20 sections thématiques totalisant 112 questions clés. Une fois l'évaluation soumise, le système calcule un score pondéré sur 5 réparti selon 12 axes de performance (Pondérations officielles de la DAPS-COGES).
              </p>
              
              <h3 className="text-sm font-bold text-slate-800 mt-4 uppercase tracking-wider font-display">Niveaux de classification COGES :</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold">
                  <span className="text-xs">Excellent / Performant</span>
                  <p className="text-[10px] font-mono font-bold text-emerald-700 mt-1.5 font-bold">Score ≥ 4.25</p>
                </div>
                <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-950 font-bold">
                  <span className="text-xs">Moyen / Fonctionnel</span>
                  <p className="text-[10px] font-mono font-bold text-green-700 mt-1.5 font-bold font-bold">3.50 ≤ Score &lt; 4.25</p>
                </div>
                <div className="p-3.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-950 font-bold">
                  <span className="text-xs">Insuffisant / Alerte</span>
                  <p className="text-[10px] font-mono font-bold text-yellow-700 mt-1.5 font-bold font-bold">3.00 ≤ Score &lt; 3.50</p>
                </div>
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-950 font-bold">
                  <span className="text-xs">Critique / Bloquant</span>
                  <p className="text-[10px] font-mono font-bold text-red-700 mt-1.5 font-bold font-bold">Score &lt; 3.00</p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-800 mt-4 uppercase tracking-wider font-display">Contrôle de conformité et audit de terrain</h3>
              <p>
                L'évaluation exige le téléversement de preuves documentaires obligatoires (Section 17). Tout refus d'accès ou document non présenté doit faire l'objet d'une justification écrite, auditée par les inspecteurs IEPP et directeurs DRENA régionaux avant validation.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Footer copyright */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 text-center text-[10px] uppercase font-semibold tracking-wider">
        <span>© 2026 - MENAET • DAPS-COGES Côte d'Ivoire</span>
      </footer>

    </div>
  );
}
