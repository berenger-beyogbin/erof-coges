/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { PRE_SEEDED_USERS, DataService, SupabaseDataService } from '../data/dataService';
import { User, Drena } from '../types';
import { Shield, Lock, Mail, Server, Database, HelpCircle, Eye, EyeOff, UserPlus, MapPin, ArrowLeft, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // For Local Demo Mode quick login helper
  const [demoUserId, setDemoUserId] = useState(PRE_SEEDED_USERS[0]?.id || '');

  // Registration (self-service enqueteur account creation)
  const [drenas, setDrenas] = useState<Drena[]>([]);
  const [regNom, setRegNom] = useState('');
  const [regPrenom, setRegPrenom] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDrenaId, setRegDrenaId] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regErrorMsg, setRegErrorMsg] = useState<string | null>(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'register' && drenas.length === 0) {
      DataService.getDrenas()
        .then(setDrenas)
        .catch(() => setRegErrorMsg('Impossible de charger la liste des DRENA. Veuillez réessayer.'));
    }
  }, [mode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrorMsg(null);
    setRegLoading(true);
    try {
      const result = await DataService.registerEnqueteur({
        email: regEmail,
        password: regPassword,
        nom: regNom,
        prenom: regPrenom,
        drena_id: regDrenaId,
        iepp_id: undefined
      });

      if (!result.success || !result.user) {
        setRegErrorMsg(result.error || 'Échec de la création du compte.');
        setRegLoading(false);
        return;
      }

      if (result.requiresEmailConfirmation) {
        setRegSuccessMsg('Compte créé. Vérifiez votre boîte mail et confirmez votre adresse avant de vous connecter.');
        setMode('login');
        setRegLoading(false);
        return;
      }

      onLoginSuccess(result.user);
    } catch (err: any) {
      setRegErrorMsg(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setRegSuccessMsg(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured) {
        // PRODUCTION MODE: Real Supabase Auth
        const { data, error } = await supabase!.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setErrorMsg(error.message || 'Identifiants de connexion invalides.');
          setLoading(false);
          return;
        }

        const authUser = data.user;
        if (!authUser) {
          setErrorMsg('Aucun utilisateur renvoyé par le service d\'authentification.');
          setLoading(false);
          return;
        }

        const profileResult = await SupabaseDataService.getAuthenticatedUserProfile(authUser.id);

        if (!profileResult.user) {
          setErrorMsg(profileResult.error || 'Compte introuvable : profil utilisateur absent.');
          await supabase!.auth.signOut();
          setLoading(false);
          return;
        }

        const profile = profileResult.user;

        if (profile.actif !== true) {
          setErrorMsg("Votre compte n'est pas activé. Veuillez contacter l'administration de la DAPS-COGES.");
          await supabase!.auth.signOut();
          setLoading(false);
          return;
        }

        onLoginSuccess(profile);
      } else {
        // DEMO MODE: Sign in using email match or pre-seeded accounts
        const matched = PRE_SEEDED_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
        const defaultUser = matched || PRE_SEEDED_USERS.find(u => u.id === demoUserId);
        if (!defaultUser) {
          setErrorMsg('Aucun compte de démonstration disponible. Configurez Supabase ou créez un compte enquêteur.');
          setLoading(false);
          return;
        }
        onLoginSuccess({
          ...defaultUser,
          email: email || defaultUser.email
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    const found = PRE_SEEDED_USERS.find(u => u.id === demoUserId);
    if (found) {
      onLoginSuccess(found);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      
      {/* Flag strip */}
      <div className="h-1.5 w-full flex">
        <div className="h-full bg-[#FF8200] flex-1"></div>
        <div className="h-full bg-white flex-1"></div>
        <div className="h-full bg-[#009E49] flex-1"></div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        
        {/* Logo and Ministry Info */}
        <div className="text-center mb-8 max-w-md">
          <div className="hidden items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl text-slate-950 font-bold text-3xl mb-4 shadow-xl shadow-amber-500/10 border border-amber-400">
            EROF
          </div>
          <p className="hidden text-[11px] uppercase tracking-widest font-extrabold text-amber-500">
            République de Côte d'Ivoire
          </p>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">
            EROF COGES
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            MENAET • DAPS-COGES
          </p>
        </div>

        <div className="w-full max-w-md bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header depending on mode */}
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {mode === 'login' ? 'Authentification sécurisée' : 'Inscription enquêteur terrain'}
            </span>
            {isSupabaseConfigured ? (
              <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Server className="h-3 w-3" />
                <span>Supabase Live</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                <Database className="h-3 w-3" />
                <span>Mode Démo Local</span>
              </span>
            )}
          </div>

          {mode === 'login' ? (
            <>
              <form onSubmit={handleSignIn} className="p-6 space-y-5">
                {regSuccessMsg && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs flex items-start space-x-2.5">
                    <Shield className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                    <span>{regSuccessMsg}</span>
                  </div>
                )}
                {errorMsg && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-start space-x-2.5">
                    <Shield className="h-4.5 w-4.5 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                    Adresse E-mail Professionnelle
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom.prenoms@mena.ci"
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                      Mot de Passe
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={isSupabaseConfigured}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 text-slate-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/15 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Connexion en cours...</span>
                    </>
                  ) : (
                    <span>Se connecter</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('register'); setErrorMsg(null); setRegSuccessMsg(null); }}
                  className="w-full py-2 text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center justify-center space-x-1.5 transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Nouvel enquêteur terrain ? Créer un compte</span>
                </button>
              </form>

              {/* Local Demo Helper Options */}
              {!isSupabaseConfigured && (
                <div className="px-6 py-5 bg-slate-950/60 border-t border-slate-700/50 space-y-4">
                  <div className="flex items-center space-x-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider">
                    <HelpCircle className="h-4 w-4" />
                    <span>Simulateur d'identité (DÉMO)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Supabase n'étant pas configuré dans le projet, vous pouvez vous connecter instantanément en sélectionnant un rôle d'utilisateur pré-configuré :
                  </p>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-200"
                        value={demoUserId}
                        onChange={(e) => setDemoUserId(e.target.value)}
                      >
                        {PRE_SEEDED_USERS.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.prenom} {u.nom} ({
                              u.role === 'admin_national' ? 'Admin National' :
                              u.role === 'superviseur_drena' ? 'DRENA' :
                              u.role === 'superviseur_iepp' ? 'IEPP' :
                              u.role === 'enqueteur' ? 'Enquêteur' : 'Lecteur'
                            })
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={handleQuickDemoLogin}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 hover:text-white transition-all whitespace-nowrap"
                      >
                        Sélectionner
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 font-mono">
                      💡 Note: Saisissez n'importe quel e-mail et mot de passe pour tester l'authentification libre.
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleRegister} className="p-6 space-y-5">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Les enquêteurs sont recrutés directement sur le terrain. Sélectionnez votre DRENA de rattachement : chaque compte enquêteur aura automatiquement un accès niveau DRENA.
              </p>

              {regErrorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs flex items-start space-x-2.5">
                  <Shield className="h-4.5 w-4.5 shrink-0 text-red-400" />
                  <span>{regErrorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                    Prénom(s)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={regPrenom}
                      onChange={(e) => setRegPrenom(e.target.value)}
                      placeholder="Ex: Jean-Pierre"
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                    Nom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={regNom}
                      onChange={(e) => setRegNom(e.target.value)}
                      placeholder="Ex: Touré"
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  Adresse E-mail Professionnelle
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nom.prenoms@mena.ci"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  Mot de Passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required={isSupabaseConfigured}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  DRENA de rattachement
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <select
                    required
                    value={regDrenaId}
                    onChange={(e) => setRegDrenaId(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-semibold appearance-none"
                  >
                    <option value="" disabled>Sélectionnez votre DRENA...</option>
                    {drenas.map(d => (
                      <option key={d.id} value={d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                  Niveau de rattachement
                </label>
                <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">Accès niveau DRENA</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Automatique</span>
                </div>
                <p className="text-[10px] text-slate-500">L'enquêteur verra les données rattachées à toutes les IEPP de sa DRENA.</p>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 text-slate-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/15 flex items-center justify-center space-x-2"
              >
                {regLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Création en cours...</span>
                  </>
                ) : (
                  <span>Créer mon compte enquêteur</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setRegErrorMsg(null); }}
                className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-1.5 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour à la connexion</span>
              </button>
            </form>
          )}

        </div>

      </div>

      <footer className="py-4 text-center text-[10px] text-slate-600 border-t border-slate-800/40 bg-slate-950/20">
        <span>© 2026 EROF COGES. Tous droits réservés.</span>
      </footer>

    </div>
  );
}
