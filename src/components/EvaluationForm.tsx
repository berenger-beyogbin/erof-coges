/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  DataService
} from '../data/dataService';
import {
  User,
  Evaluation,
  EvaluationReponse,
  MembreBe,
  EquipeEvaluation,
  Recommandation,
  PreuveDocumentaire,
  Etablissement,
  Coges
} from '../types';
import questionsErof from '../questions_erof.json';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Check, 
  Upload, 
  AlertTriangle, 
  Info, 
  Plus, 
  Trash2, 
  Clock, 
  ChevronRight,
  ShieldAlert,
  Loader,
  ExternalLink
} from 'lucide-react';

interface EvaluationFormProps {
  currentUser: User;
  evaluationId: string | null; // If null, this is a new evaluation creation
  onClose: () => void;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function EvaluationForm({ currentUser, evaluationId, onClose }: EvaluationFormProps) {
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Root structures
  const [evalId, setEvalId] = useState<string>('');
  const [evaluation, setEvaluation] = useState<Partial<Evaluation>>({});
  const [reponses, setReponses] = useState<Record<string, string>>({}); // code -> value
  const [reponseIds, setReponseIds] = useState<Record<string, string>>({}); // code -> UUID
  // Dedicated states for questions whose storage_table targets etablissements / coges,
  // so they never fall into the evaluation_reponses EAV bucket.
  const [etablissementUpdates, setEtablissementUpdates] = useState<Partial<Etablissement>>({});
  const [cogesUpdates, setCogesUpdates] = useState<Partial<Coges>>({});
  const [membresBe, setMembresBe] = useState<MembreBe[]>([]);
  const [equipes, setEquipes] = useState<EquipeEvaluation[]>([]);
  const [recommandations, setRecommandations] = useState<Partial<Recommandation>>({});
  const [preuves, setPreuves] = useState<PreuveDocumentaire[]>([]);

  // UI / Options states
  const [drenas, setDrenas] = useState<any[]>([]);
  const [availableIepps, setAvailableIepps] = useState<any[]>([]);
  const [selectedDrenaId, setSelectedDrenaId] = useState('');
  const [selectedIeppId, setSelectedIeppId] = useState('');
  const [noActiveCampagne, setNoActiveCampagne] = useState(false);
  
  // Tracking
  const [saving, setSaving] = useState(false);
  const [navigationSaving, setNavigationSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [submissionErrors, setSubmissionErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosingDraft, setIsClosingDraft] = useState(false);
  const [uploadingProofIdx, setUploadingProofIdx] = useState<number | null>(null);
  const [fileOpenError, setFileOpenError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const draftEtablissementIdRef = useRef<string | null>(null);
  const draftCogesIdRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Promise<{ success: boolean; error?: string }> | null>(null);
  const evaluationRef = useRef<Partial<Evaluation>>({});
  const reponsesRef = useRef<Record<string, string>>({});
  const reponseIdsRef = useRef<Record<string, string>>({});
  const etablissementUpdatesRef = useRef<Partial<Etablissement>>({});
  const cogesUpdatesRef = useRef<Partial<Coges>>({});
  const membresBeRef = useRef<MembreBe[]>([]);
  const equipesRef = useRef<EquipeEvaluation[]>([]);
  const recommandationsRef = useRef<Partial<Recommandation>>({});
  const preuvesRef = useRef<PreuveDocumentaire[]>([]);
  
  // Form rendering helpers
  const sections = questionsErof.sections;
  const lastSectionIdx = Math.max(sections.length - 1, 0);
  const safeActiveSectionIdx = Math.min(Math.max(activeSectionIdx, 0), lastSectionIdx);
  const currentSection = sections[safeActiveSectionIdx] || sections[0];
  const isDraftLikeStatus = evaluation.statut === 'brouillon' || evaluation.statut === 'en_revision';
  const saveButtonLabel = isDraftLikeStatus ? 'Enregistrer brouillon' : 'Enregistrement verrouille';
  const isFormBusy = saving || navigationSaving || isClosingDraft || isSubmitting || uploadingProofIdx !== null;

  // question_code -> section number, needed for evaluation_reponses.section_num (NOT NULL)
  const questionSectionMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    sections.forEach(s => (s.questions || []).forEach((q: any) => { map[q.code] = s.num; }));
    return map;
  }, [sections]);

  // Section 16 BE profiles sub-navigation (which of the 11 profiles is active)
  const [activeBeIdx, setActiveBeIdx] = useState(0);

  useEffect(() => {
    if (activeSectionIdx !== safeActiveSectionIdx) {
      setActiveSectionIdx(safeActiveSectionIdx);
    }
  }, [activeSectionIdx, safeActiveSectionIdx]);

  useEffect(() => { evaluationRef.current = evaluation; }, [evaluation]);
  useEffect(() => { reponsesRef.current = reponses; }, [reponses]);
  useEffect(() => { reponseIdsRef.current = reponseIds; }, [reponseIds]);
  useEffect(() => { etablissementUpdatesRef.current = etablissementUpdates; }, [etablissementUpdates]);
  useEffect(() => { cogesUpdatesRef.current = cogesUpdates; }, [cogesUpdates]);
  useEffect(() => { membresBeRef.current = membresBe; }, [membresBe]);
  useEffect(() => { equipesRef.current = equipes; }, [equipes]);
  useEffect(() => { recommandationsRef.current = recommandations; }, [recommandations]);
  useEffect(() => { preuvesRef.current = preuves; }, [preuves]);

  // Initialize and load
  useEffect(() => {
    const initForm = async () => {
      setLoading(true);
      
      const newOrExistingId = evaluationId || generateUUID();
      setEvalId(newOrExistingId);

      // Fetch root drenas list
      const drenaList = await DataService.getDrenas();
      setDrenas(drenaList);

      if (evaluationId) {
        // Load existing
        const details = await DataService.getEvaluationDetails(evaluationId);
        if (details) {
          setEvaluation(details.evaluation);
          
          // Map EAV responses to local key-value and keep original UUIDs
          const repMap: Record<string, string> = {};
          const idMap: Record<string, string> = {};
          details.reponses.forEach(r => {
            if (r.valeur_numerique !== null && r.valeur_numerique !== undefined) {
              repMap[r.question_code] = String(r.valeur_numerique);
            }
            idMap[r.question_code] = r.id;
          });
          setReponses(repMap);
          setReponseIds(idMap);
          setEtablissementUpdates(details.evaluation.etablissement || {});
          setCogesUpdates(details.evaluation.coges || {});
          setMembresBe(details.membresBe);
          setEquipes(details.equipes);
          setRecommandations(details.recommandations || {});
          setPreuves(details.preuves);
          evaluationRef.current = details.evaluation;
          reponsesRef.current = repMap;
          reponseIdsRef.current = idMap;
          etablissementUpdatesRef.current = details.evaluation.etablissement || {};
          cogesUpdatesRef.current = details.evaluation.coges || {};
          membresBeRef.current = details.membresBe;
          equipesRef.current = details.equipes;
          recommandationsRef.current = details.recommandations || {};
          preuvesRef.current = details.preuves;

          // Resolve selected regional filters
          if (details.evaluation.etablissement) {
            const ieppId = details.evaluation.etablissement.iepp_id;
            setSelectedIeppId(ieppId);
            
            const drenaId = details.evaluation.iepp?.drena_id || details.evaluation.drena?.id || '';
            setSelectedDrenaId(drenaId);

            if (drenaId) {
              const ieppsData = await DataService.getIepps(drenaId);
              setAvailableIepps(ieppsData);
            }
          }
        }
      } else {
        // Create new
        const campagnes = await DataService.getCampagnes();
        const activeCampagne = campagnes.find(c => c.statut === 'ouverte');
        setNoActiveCampagne(!activeCampagne);

        // Pre-fill and lock the regional filters to the connected user's own scope
        if (currentUser.drena_id) {
          setSelectedDrenaId(currentUser.drena_id);
          const ieppsData = await DataService.getIepps(currentUser.drena_id);
          setAvailableIepps(ieppsData);
          if (currentUser.iepp_id) {
            setSelectedIeppId(currentUser.iepp_id);
          }
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const initialEvaluation = {
          id: newOrExistingId,
          campagne_id: activeCampagne?.id,
          enqueteur_id: currentUser.id,
          date_collecte: todayStr,
          statut: 'brouillon',
          locked: false,
          created_by: currentUser.id,
          effectif_total: 0,
          effectif_filles: 0,
          effectif_garcons: 0
        };
        evaluationRef.current = initialEvaluation;
        setEvaluation(initialEvaluation);

        // Initialize empty repeat structures
        // Section 16 members BE initial setup (11 empty objects)
        const beInstances = currentSection.num === 16 ? [] : (sections.find(s => s.num === 16)?.repeat_instances || []);
        const initialBeList = (beInstances as any[]).map((inst: any, idx: number) => ({
          id: generateUUID(),
          evaluation_id: newOrExistingId,
          nom_prenoms: '',
          genre: ['president', 'secretaire_general', 'tresorier_general'].includes(inst.fonction) ? 'homme' : 'femme' as any,
          fonction: inst.fonction as any,
          lit_ecrit_francais: true,
          lit_ecrit_langue_locale: false,
          niveau_etude: 'primaire' as any,
          profession: '',
          formation_coges: false,
          maitrise_role: 'moyenne' as any
        }));
        membresBeRef.current = initialBeList;
        setMembresBe(initialBeList);

        // Section 17 proofs checklist initial setup (20 entries)
        const initialProofs = (sections.find(s => s.num === 17)?.questions || []).map((q: any, idx: number) => ({
          id: generateUUID(),
          evaluation_id: newOrExistingId,
          type_preuve: q.libelle,
          statut: 'non_disponible' as any,
          commentaire: ''
        }));
        preuvesRef.current = initialProofs;
        setPreuves(initialProofs);

        // Section 20 initial evaluation team (starts with 1 line pre-filled with current user)
        const initialEquipe = [
          {
            id: generateUUID(),
            evaluation_id: newOrExistingId,
            nom_prenoms: `${currentUser.prenom} ${currentUser.nom}`,
            fonction_structure: 'Enquêteur terrain'
          }
        ];
        equipesRef.current = initialEquipe;
        setEquipes(initialEquipe);

        const initialRecommandations = {
          id: generateUUID(),
          evaluation_id: newOrExistingId,
          forces: '',
          faiblesses: '',
          difficultes: '',
          actions_urgentes: '',
          appuis_attendus: '',
          recommandations_prioritaires: ''
        };
        recommandationsRef.current = initialRecommandations;
        setRecommandations(initialRecommandations);
      }

      setLoading(false);
    };

    initForm();
  }, [evaluationId]);

  // Handle cascading filters for Section 1 (only when loaded to avoid race condition)
  useEffect(() => {
    const loadIepps = async () => {
      if (selectedDrenaId) {
        const data = await DataService.getIepps(selectedDrenaId);
        setAvailableIepps(data);
      } else {
        setAvailableIepps([]);
      }
    };
    if (!loading) {
      loadIepps();
      setSelectedIeppId('');
      draftEtablissementIdRef.current = null;
      draftCogesIdRef.current = null;
      evaluationRef.current = { ...evaluationRef.current, etablissement_id: undefined, coges_id: undefined };
      etablissementUpdatesRef.current = {};
      cogesUpdatesRef.current = {};
      setEvaluation(prev => ({ ...prev, etablissement_id: undefined, coges_id: undefined }));
      setEtablissementUpdates({});
      setCogesUpdates({});
    }
  }, [selectedDrenaId]);

  useEffect(() => {
    if (!loading) {
      draftEtablissementIdRef.current = null;
      draftCogesIdRef.current = null;
      evaluationRef.current = { ...evaluationRef.current, etablissement_id: undefined, coges_id: undefined };
      etablissementUpdatesRef.current = {};
      cogesUpdatesRef.current = {};
      setEvaluation(prev => ({ ...prev, etablissement_id: undefined, coges_id: undefined }));
      setEtablissementUpdates({});
      setCogesUpdates({});
    }
  }, [selectedIeppId]);

  // Autosaver trigger (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFormBusy && isDraftLikeStatus) {
        saveDraft(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [evaluation, reponses, etablissementUpdates, cogesUpdates, membresBe, equipes, recommandations, preuves, isFormBusy, isDraftLikeStatus]);

  // Primary draft saver
  const performSaveDraft = async (
    isAuto = false,
    overrides?: { preuves?: PreuveDocumentaire[] }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!evalId) return { success: false, error: 'Formulaire non initialise.' };
    if (noActiveCampagne) {
      const error = 'Aucune campagne active n\'est configuree. Veuillez contacter l\'administrateur.';
      if (isAuto) setAutoSaveStatus('failed');
      else alert(error);
      return { success: false, error };
    }
    if (isAuto) setAutoSaveStatus('saving');
    else setSaving(true);

    const latestEvaluation = evaluationRef.current;
    const latestEtablissementUpdates = etablissementUpdatesRef.current;
    const latestCogesUpdates = cogesUpdatesRef.current;
    const latestReponses = reponsesRef.current;
    const latestReponseIds = reponseIdsRef.current;
    const latestMembresBe = membresBeRef.current;
    const latestEquipes = equipesRef.current;
    const latestRecommandations = recommandationsRef.current;
    const etablissementId = latestEvaluation.etablissement_id || draftEtablissementIdRef.current || generateUUID();
    const cogesId = latestEvaluation.coges_id || draftCogesIdRef.current || generateUUID();
    draftEtablissementIdRef.current = etablissementId;
    draftCogesIdRef.current = cogesId;
    const evaluationToSave = {
      ...latestEvaluation,
      id: evalId,
      etablissement_id: etablissementId,
      coges_id: cogesId
    };
    if (!latestEvaluation.etablissement_id || !latestEvaluation.coges_id) {
      const nextEvaluation = {
        ...latestEvaluation,
        etablissement_id: etablissementId,
        coges_id: cogesId
      };
      evaluationRef.current = nextEvaluation;
      setEvaluation(prev => ({
        ...prev,
        etablissement_id: etablissementId,
        coges_id: cogesId
      }));
    }

    const etablissementToSave = {
      ...latestEtablissementUpdates,
      iepp_id: latestEtablissementUpdates.iepp_id || selectedIeppId || undefined
    };
    const preuvesToSave = overrides?.preuves || preuvesRef.current;
    const membresBeToSave = latestMembresBe.map((member) => ({
      ...member,
      evaluation_id: evalId
    }));
    const equipesToSave = latestEquipes.map((member) => ({
      ...member,
      evaluation_id: evalId
    }));
    const recommandationsToSave = latestRecommandations
      ? {
          ...latestRecommandations,
          id: latestRecommandations.id || generateUUID(),
          evaluation_id: evalId
        }
      : latestRecommandations;
    const preuvesNormalizedToSave = preuvesToSave.map((proof) => ({
      ...proof,
      evaluation_id: evalId
    }));
    membresBeRef.current = membresBeToSave;
    equipesRef.current = equipesToSave;
    recommandationsRef.current = recommandationsToSave || {};
    preuvesRef.current = preuvesNormalizedToSave;

    // Prepare responses EAV structures from record map with stable IDs
    const mappedReponses: EvaluationReponse[] = Object.entries(latestReponses).map(([code, val]) => {
      let rId = latestReponseIds[code];
      if (!rId) {
        rId = generateUUID();
        reponseIdsRef.current = { ...reponseIdsRef.current, [code]: rId };
        setReponseIds(prev => ({ ...prev, [code]: rId }));
      }
      return {
        id: rId,
        evaluation_id: evalId,
        question_code: code,
        section_num: questionSectionMap[code] || 0,
        valeur_numerique: parseInt(val as string, 10)
      };
    });

    try {
      const result = await DataService.saveDraft(
        evaluationToSave,
        mappedReponses,
        membresBeToSave,
        equipesToSave,
        recommandationsToSave,
        preuvesNormalizedToSave,
        currentUser.id,
        etablissementToSave,
        latestCogesUpdates
      );
      if (result.success) {
        if (isAuto) {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } else {
          setSaving(false);
          alert('Brouillon enregistré avec succès.');
        }
        return { success: true };
      } else {
        if (isAuto) setAutoSaveStatus('failed');
        else {
          setSaving(false);
          alert(`Erreur de sauvegarde : ${result.error}`);
        }
        return { success: false, error: result.error || 'Erreur de sauvegarde.' };
      }
    } catch (e: any) {
      const error = e?.message || 'Erreur inattendue.';
      if (isAuto) setAutoSaveStatus('failed');
      else {
        setSaving(false);
        alert(`Erreur inattendue : ${error}`);
      }
      return { success: false, error };
    }
  };

  const saveDraft = async (
    isAuto = false,
    overrides?: { preuves?: PreuveDocumentaire[] }
  ): Promise<{ success: boolean; error?: string }> => {
    if (saveInFlightRef.current) {
      await saveInFlightRef.current.catch(() => undefined);
    }

    const savePromise = performSaveDraft(isAuto, overrides);
    saveInFlightRef.current = savePromise;
    try {
      return await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) {
        saveInFlightRef.current = null;
      }
    }
  };

  const navigateToSection = async (targetIdx: number) => {
    if (!isDraftLikeStatus || isFormBusy) return;

    const nextIdx = Math.min(Math.max(targetIdx, 0), lastSectionIdx);
    if (nextIdx === safeActiveSectionIdx) return;

    setSubmissionErrors([]);
    setNavigationSaving(true);
    try {
      const result = await saveDraft(true);
      if (result.success) {
        setActiveSectionIdx(nextIdx);
        return;
      }

      const error = result.error || 'La sauvegarde du brouillon a echoue.';
      setSubmissionErrors([error]);
      alert(error);
    } finally {
      setNavigationSaving(false);
    }
  };

  // Submit definitively
  const handleSubmitDefinitively = async () => {
    if (isFormBusy) return;

    if (noActiveCampagne) {
      alert('Aucune campagne active n\'est configurée. Veuillez contacter l\'administrateur.');
      return;
    }
    setSubmissionErrors([]);
    setIsSubmitting(true);
    
    // First, force draft save so the submission uses the latest answers.
    const draftResult = await saveDraft(true);
    if (!draftResult.success) {
      const error = draftResult.error || 'La sauvegarde du brouillon a echoue.';
      setSubmissionErrors([error]);
      alert(error);
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await DataService.submitEvaluation(evalId, currentUser.id);
      if (result.success) {
        alert('Félicitations! L\'évaluation a passé tous les contrôles de conformité : elle est directement validée et scorée.');
        onClose();
      } else {
        setSubmissionErrors(result.errors || ['Erreur de soumission générale.']);
        // Jump to first section with errors or alert
        alert('La soumission a été bloquée par le système. Veuillez consulter la liste des erreurs et manques au bas de la page.');
      }
    } catch (e: any) {
      setSubmissionErrors([e.message || 'Erreur inattendue.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (isFormBusy) return;

    setSubmissionErrors([]);
    setIsClosingDraft(true);

    const result = await saveDraft(true);
    setIsClosingDraft(false);

    if (result.success) {
      onClose();
      return;
    }

    const error = result.error || 'Le brouillon n\'a pas pu etre enregistre.';
    setSubmissionErrors([error]);
    alert(error);
  };

  // Handle specific question responses
  const handleAnswerChange = (code: string, value: string) => {
    reponsesRef.current = {
      ...reponsesRef.current,
      [code]: value
    };
    setReponses(prev => ({
      ...prev,
      [code]: value
    }));
    if (!reponseIdsRef.current[code]) {
      reponseIdsRef.current = {
        ...reponseIdsRef.current,
        [code]: generateUUID()
      };
    }
    setReponseIds(prev => {
      if (prev[code]) return prev;
      return {
        ...prev,
        [code]: reponseIdsRef.current[code]
      };
    });
  };

  // Handle structural properties
  const handlePropChange = (table: string, column: string, value: any) => {
    if (table === 'evaluations') {
      setEvaluation(prev => {
        const next = { ...prev, [column]: value };
        // Coherence calculation: Total = Filles + Garcons
        if (column === 'effectif_filles' || column === 'effectif_garcons') {
          const f = parseInt(column === 'effectif_filles' ? value : (next.effectif_filles || 0), 10);
          const g = parseInt(column === 'effectif_garcons' ? value : (next.effectif_garcons || 0), 10);
          next.effectif_total = (isNaN(f) ? 0 : f) + (isNaN(g) ? 0 : g);
        }
        evaluationRef.current = next;
        return next;
      });
    } else if (table === 'recommandations') {
      recommandationsRef.current = {
        ...recommandationsRef.current,
        [column]: value
      };
      setRecommandations(prev => ({
        ...prev,
        [column]: value
      }));
    }
  };

  // Handle etablissements-scoped question fields (Sections 1-2)
  const handleEtablissementPropChange = (column: string, value: any) => {
    etablissementUpdatesRef.current = {
      ...etablissementUpdatesRef.current,
      [column]: value
    };
    setEtablissementUpdates(prev => ({ ...prev, [column]: value }));
  };

  const captureGpsPosition = () => {
    if (!('geolocation' in navigator)) {
      setGpsError("GPS non disponible sur cet appareil ou ce navigateur.");
      return;
    }

    if (!window.isSecureContext) {
      setGpsError("GPS bloqué par le navigateur : ouvrez l'application en HTTPS ou sur localhost.");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        handleEtablissementPropChange('latitude', latitude);
        handleEtablissementPropChange('longitude', longitude);
        setGpsLoading(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED ? "Autorisation GPS refusée. Activez la localisation puis réessayez." :
          error.code === error.POSITION_UNAVAILABLE ? "Position GPS indisponible. Vérifiez la connexion ou le signal." :
          error.code === error.TIMEOUT ? "Le GPS met trop de temps à répondre. Réessayez à l'extérieur ou près d'une fenêtre." :
          "Impossible de récupérer la position GPS.";
        setGpsError(message);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      }
    );
  };

  // Handle coges-scoped question fields (Sections 1-2)
  const handleCogesPropChange = (column: string, value: any) => {
    cogesUpdatesRef.current = {
      ...cogesUpdatesRef.current,
      [column]: value
    };
    setCogesUpdates(prev => ({ ...prev, [column]: value }));
  };

  // Single dispatcher enforcing storage_table routing uniformly across field types
  const handleQuestionChange = (q: any, value: any) => {
    if (q.storage_table === 'evaluations') {
      handlePropChange('evaluations', q.storage_column, value);
    } else if (q.storage_table === 'recommandations') {
      handlePropChange('recommandations', q.storage_column, value);
    } else if (q.storage_table === 'etablissements') {
      handleEtablissementPropChange(q.storage_column, value);
    } else if (q.storage_table === 'coges') {
      handleCogesPropChange(q.storage_column, value);
    } else {
      handleAnswerChange(q.code, value);
    }
  };

  // Handle Repeat section 16 (Members BE)
  const handleMemberPropChange = (idx: number, column: string, value: any) => {
    const latest = [...membresBeRef.current];
    latest[idx] = {
      ...latest[idx],
      [column]: value
    };
    membresBeRef.current = latest;
    setMembresBe(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [column]: value
      };
      return next;
    });
  };

  // Handle Repeat section 17 (Proofs)
  const handleProofPropChange = (idx: number, column: string, value: any) => {
    const latest = [...preuvesRef.current];
    latest[idx] = {
      ...latest[idx],
      [column]: value
    };
    preuvesRef.current = latest;
    setPreuves(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [column]: value
      };
      return next;
    });
  };

  // Handle Drag/Drop File Upload for section 17
  const handleFileUpload = async (idx: number, file: File) => {
    if (uploadingProofIdx !== null) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Taille maximale autorisée : 10 Mo');
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'pdf'].includes(extension || '')) {
      alert('Formats acceptés : PDF, PNG, JPG/JPEG uniquement.');
      return;
    }

    setUploadingProofIdx(idx);
    try {
      const draftResult = await saveDraft(true);
      if (!draftResult.success) {
        alert(`Impossible d'envoyer le fichier : le brouillon doit d'abord être enregistré. ${draftResult.error || ''}`);
        return;
      }

      const proofType = preuvesRef.current[idx]?.type_preuve || preuves[idx]?.type_preuve;
      if (!proofType) {
        alert('Veuillez selectionner le type de preuve avant d\'envoyer un fichier.');
        return;
      }
      const result = await DataService.uploadPreuveFile(evalId, proofType, file);
      if (result.success && result.filePath) {
        const nextPreuves = preuvesRef.current.map((proof, proofIdx) => (
          proofIdx === idx
            ? {
                ...proof,
                fichier_path: result.filePath,
                fichier_nom_original: file.name,
                statut: 'disponible_consultee' as const
              }
            : proof
        ));
        preuvesRef.current = nextPreuves;
        setPreuves(nextPreuves);

        const persistResult = await saveDraft(true, { preuves: nextPreuves });
        if (!persistResult.success) {
          alert(`Fichier envoyé, mais le lien n'a pas pu être enregistré dans le brouillon : ${persistResult.error || 'erreur inconnue'}`);
          return;
        }
        alert(`Fichier "${file.name}" téléchargé avec succès.`);
      } else {
        alert(`Échec d'upload : ${result.error}`);
      }
    } catch (e: any) {
      alert(`Erreur d'upload : ${e.message}`);
    } finally {
      setUploadingProofIdx(null);
    }
  };

  const handleOpenUploadedProof = async (proof: PreuveDocumentaire) => {
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

  // Handle Repeat section 20 (Team addition/deletion)
  const handleTeamMemberAdd = () => {
    if (equipesRef.current.length >= 4) {
      alert('Maximum 4 évaluateurs autorisés.');
      return;
    }
    const next = [
      ...equipesRef.current,
      {
        id: generateUUID(),
        evaluation_id: evalId,
        nom_prenoms: '',
        fonction_structure: ''
      }
    ];
    equipesRef.current = next;
    setEquipes(next);
  };

  const handleTeamMemberRemove = (idx: number) => {
    if (equipesRef.current.length <= 1) {
      alert('Au moins un évaluateur requis.');
      return;
    }
    const next = equipesRef.current.filter((_, i) => i !== idx);
    equipesRef.current = next;
    setEquipes(next);
  };

  const handleTeamPropChange = (idx: number, column: string, value: any) => {
    const latest = [...equipesRef.current];
    latest[idx] = {
      ...latest[idx],
      [column]: value
    };
    equipesRef.current = latest;
    setEquipes(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [column]: value
      };
      return next;
    });
  };

  // Free-text entry of the etablissement name (no pre-existing referential list)
  const handleEtablissementNameChange = (nom: string) => {
    const nextEvaluation = {
      ...evaluationRef.current,
      etablissement_id: evaluationRef.current.etablissement_id || generateUUID(),
      coges_id: evaluationRef.current.coges_id || generateUUID()
    };
    evaluationRef.current = nextEvaluation;
    etablissementUpdatesRef.current = {
      ...etablissementUpdatesRef.current,
      nom,
      iepp_id: selectedIeppId
    };
    setEvaluation(nextEvaluation);
    setEtablissementUpdates(etablissementUpdatesRef.current);
  };

  if (loading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-4 bg-white rounded-xl shadow border border-slate-200">
        <Loader className="h-12 w-12 text-amber-500 animate-spin" />
        <span className="text-sm font-semibold text-slate-600">Initialisation du formulaire dynamique EROF COGES...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden flex flex-col lg:flex-row min-h-[650px]">
      
      {/* Side step navigator (20 sections list) */}
      <div className="order-2 lg:order-1 lg:w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-800 bg-[#0F172A] text-slate-300">
          <h3 className="font-bold text-sm tracking-tight text-white font-display">Navigation Sections</h3>
          <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider">Saisie progressive • 20 étapes</p>
          
          {/* Autosaver indicator */}
          <div className="flex items-center space-x-1.5 mt-3 text-[10px] text-amber-400 font-mono font-medium">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {autoSaveStatus === 'saving' ? 'Auto-sauvegarde...' :
               autoSaveStatus === 'saved' ? 'Saisie sauvegardée ✓' :
               autoSaveStatus === 'failed' ? 'Auto-save échoué ✗' :
               'Draft auto-save actif'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[480px]" id="sections-nav">
          <nav className="p-2 space-y-1">
            {sections.map((sect, idx) => {
              const isActive = idx === safeActiveSectionIdx;
              const isCompleted = idx < safeActiveSectionIdx; // Mock simple completion trace
              
              return (
                <button
                  key={sect.num}
                  onClick={() => navigateToSection(idx)}
                  disabled={!isDraftLikeStatus || isFormBusy}
                  className={`w-full text-left p-2.5 rounded text-xs font-bold flex items-center justify-between transition-all ${
                    isActive 
                      ? 'bg-[#1E293B] text-white border-l-4 border-l-amber-500 shadow-sm' 
                      : 'text-slate-700 hover:bg-slate-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={`h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] ${
                      isActive ? 'bg-amber-500 text-[#0F172A] font-bold' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {sect.num}
                    </span>
                    <span className="truncate">{sect.titre}</span>
                  </div>
                  <ChevronRight className={`h-3 w-3 shrink-0 opacity-60 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Action button bottom left */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={() => saveDraft(false)}
            disabled={noActiveCampagne || isFormBusy}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-3 rounded border border-slate-200 text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving || navigationSaving ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{saving || navigationSaving ? 'Enregistrement...' : saveButtonLabel}</span>
          </button>
        </div>
      </div>

      {/* Main active section questionnaire details */}
      <div className="order-1 lg:order-2 flex-1 p-6 lg:p-8 flex flex-col justify-between space-y-8">
        
        {/* Section Header */}
        <div className="space-y-2 border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={handleSaveAndClose}
              disabled={isFormBusy}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClosingDraft ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
              <span>{isClosingDraft ? 'Sauvegarde...' : 'Enregistrer et quitter'}</span>
            </button>
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded uppercase tracking-wider">Étape {safeActiveSectionIdx + 1} sur 20</span>
          </div>

          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-500 rounded shrink-0"></span>
            {currentSection.num}. {currentSection.titre}
          </h2>
          <p className="text-xs text-gray-500 font-medium italic">{currentSection.objectif}</p>
        </div>

        {/* Blocking banner: no active campagne configured */}
        {noActiveCampagne && (
          <div className="bg-red-50 p-4 rounded-xl border border-red-200 flex items-start space-x-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <p className="text-xs font-bold text-red-800 leading-relaxed">
              Aucune campagne active n'est configurée. Veuillez contacter l'administrateur.
            </p>
          </div>
        )}

        {/* Active Questionnaire renderer */}
        <div className="flex-1 space-y-6">
          
          {/* SECTION 16 EXECUTIVE MEMBERS BOARD SPECIAL GRAPHICAL HANDLER */}
          {currentSection.num === 16 ? (
            <div className="space-y-6">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                <Info className="h-4 w-4 shrink-0 inline mr-2 text-indigo-600" />
                {currentSection.intro}
              </div>

              {/* Sub tabs of the 11 key seats */}
              <div className="flex overflow-x-auto pb-2 space-x-1.5 scrollbar-thin" id="be-sub-tabs">
                {(currentSection.repeat_instances as any[]).map((inst: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveBeIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                      idx === activeBeIdx 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {inst.poste_libelle}
                  </button>
                ))}
              </div>

              {/* Profile sub-form fields */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <p className="text-xs font-extrabold text-gray-700 md:col-span-2 border-b border-gray-100 pb-2">
                  Poste : <span className="text-indigo-600">{currentSection.repeat_instances[activeBeIdx].poste_libelle}</span>
                </p>

                {currentSection.questions.map((q: any) => {
                  const mbInstance = membresBe[activeBeIdx];
                  if (!mbInstance) return null;

                  // Conditional fields check
                  if (q.conditional) {
                    const dependsOnVal = mbInstance.formation_coges ? 'oui' : 'non';
                    if (dependsOnVal !== q.conditional.showWhen) return null;
                  }

                  return (
                    <div key={q.code} className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700">{q.libelle} {q.required && <span className="text-red-500">*</span>}</label>
                      
                      {q.type === 'text' && (
                        <input
                          type="text"
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          value={q.storage_column === 'nom_prenoms' ? mbInstance.nom_prenoms : (mbInstance as any)[q.storage_column] || ''}
                          onChange={(e) => handleMemberPropChange(activeBeIdx, q.storage_column, e.target.value.toUpperCase())}
                        />
                      )}

                      {q.type === 'select' && (
                        <select
                          disabled={q.auto_fill && !q.auto_fill.editable}
                          className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                          value={
                            q.storage_column === 'fonction' ? currentSection.repeat_instances[activeBeIdx].fonction :
                            q.boolean_mapping 
                              ? ((mbInstance as any)[q.storage_column] ? 'oui' : 'non') 
                              : (mbInstance as any)[q.storage_column] || ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (q.boolean_mapping) {
                              handleMemberPropChange(activeBeIdx, q.storage_column, val === 'oui');
                            } else {
                              handleMemberPropChange(activeBeIdx, q.storage_column, val);
                            }
                          }}
                        >
                          {q.options.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : currentSection.num === 17 ? (
            /* SECTION 17 PROOFS AUDIT COMPONENT SPECIAL RENDERER */
            <div className="space-y-6">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <Info className="h-4 w-4 shrink-0 inline mr-2 text-amber-600" />
                {currentSection.intro}
              </div>

              {fileOpenError && (
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{fileOpenError}</span>
                </div>
              )}

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2" id="preuves-list">
                {preuves.map((proof, idx) => {
                  const fileInputRef = React.createRef<HTMLInputElement>();

                  return (
                    <div key={proof.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1 max-w-sm">
                        <p className="font-extrabold text-gray-800">{idx + 1}. {proof.type_preuve}</p>
                        {proof.fichier_nom_original ? (
                          <p className="text-[10px] text-emerald-700 font-medium">✓ Fichier joint : {proof.fichier_nom_original}</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">Aucune preuve téléversée</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          value={proof.statut}
                          onChange={(e) => handleProofPropChange(idx, 'statut', e.target.value)}
                        >
                          <option value="disponible_consultee">Disponible et consultée</option>
                          <option value="disponible_non_consultee">Disponible mais non consultée</option>
                          <option value="declaree_non_presentee">Déclarée mais non présentée</option>
                          <option value="non_disponible">Non disponible</option>
                          <option value="non_applicable">Non applicable</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Justification ou motif..."
                          className="p-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                          value={proof.commentaire || ''}
                          onChange={(e) => handleProofPropChange(idx, 'commentaire', e.target.value.toUpperCase())}
                        />

                        {/* Custom Upload Button */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(idx, e.target.files[0]);
                            }
                          }}
                        />
                        <button
                          onClick={() => uploadingProofIdx === null && fileInputRef.current?.click()}
                          disabled={uploadingProofIdx !== null}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-wait text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center space-x-1"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span className="text-[10px]">{uploadingProofIdx === idx ? 'Envoi...' : 'Upload'}</span>
                        </button>
                        {proof.fichier_path && (
                          <button
                            type="button"
                            onClick={() => handleOpenUploadedProof(proof)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg border border-slate-900 flex items-center space-x-1"
                            title={`Consulter ${proof.fichier_nom_original || proof.type_preuve}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
                            <span className="text-[10px]">Voir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : currentSection.num === 20 ? (
            /* SECTION 20 REPEATABLE EVALUATORS TEAM LIST */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Membres de l'équipe d'évaluation</h4>
                <button
                  onClick={handleTeamMemberAdd}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Ajouter un membre</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {equipes.map((member, idx) => (
                  <div key={member.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 relative space-y-3 text-xs">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                      <span className="font-bold text-indigo-700">Évaluateur #{idx + 1}</span>
                      <button
                        onClick={() => handleTeamMemberRemove(idx)}
                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                        title="Retirer l'évaluateur"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-gray-600">Nom et prénoms</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                        value={member.nom_prenoms}
                        onChange={(e) => handleTeamPropChange(idx, 'nom_prenoms', e.target.value.toUpperCase())}
                        placeholder="Ex. Dr. Bakary Koné"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-gray-600">Fonction / Structure</label>
                      <input
                        type="text"
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs outline-none"
                        value={member.fonction_structure}
                        onChange={(e) => handleTeamPropChange(idx, 'fonction_structure', e.target.value.toUpperCase())}
                        placeholder="Ex. Conseiller COGES / IEPP Cocody"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STANDARD QUESTION TYPES RENDERER */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Special cascaded handles for regional setup in Section 1 */}
              {currentSection.num === 1 && (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">DRENA de collectes *</label>
                    <select
                      className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none disabled:bg-gray-100 disabled:text-gray-500"
                      disabled={!!currentUser.drena_id}
                      value={selectedDrenaId}
                      onChange={(e) => setSelectedDrenaId(e.target.value)}
                    >
                      <option value="">Sélectionner la DRENA...</option>
                      {drenas.map(d => (
                        <option key={d.id} value={d.id}>{d.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">Circonscription IEPP *</label>
                    <select
                      className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none disabled:bg-gray-100 disabled:text-gray-500"
                      disabled={!selectedDrenaId || !!currentUser.iepp_id}
                      value={selectedIeppId}
                      onChange={(e) => setSelectedIeppId(e.target.value)}
                    >
                      <option value="">Sélectionner l'IEPP...</option>
                      {availableIepps.map(i => (
                        <option key={i.id} value={i.id}>{i.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700">COGES *</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                      disabled={!selectedIeppId}
                      placeholder="Saisir le nom du COGES..."
                      value={etablissementUpdates.nom || ''}
                      onChange={(e) => handleEtablissementNameChange(e.target.value.toUpperCase())}
                    />
                  </div>
                </>
              )}

              {/* Dynamic JSON mapping of questions */}
              {currentSection.questions.map((q: any) => {
                // Ignore DRENA, IEPP and Etablissement fields in Section 1 standard loop since they are cascaded above
                if (currentSection.num === 1 && ['1.1', '1.2', '1.4'].includes(q.code)) return null;

                // Handle pre-filled investigator or collecte fields
                const propVal = q.storage_table === 'evaluations' ? evaluation[q.storage_column as keyof Evaluation] :
                                q.storage_table === 'recommandations' ? recommandations[q.storage_column as keyof Recommandation] :
                                q.storage_table === 'etablissements' ? (etablissementUpdates as any)[q.storage_column] :
                                q.storage_table === 'coges' ? (cogesUpdates as any)[q.storage_column] :
                                reponses[q.code] || '';

                return (
                  <div key={q.code} className={`space-y-1 ${q.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                    <div className="flex justify-between items-start">
                      <label className="text-xs font-semibold text-gray-700 leading-snug">
                        {q.code} {q.libelle} {q.required && <span className="text-red-500">*</span>}
                      </label>
                    </div>

                    {/* TEXT FIELD */}
                    {q.type === 'text' && (
                      <input
                        type="text"
                        disabled={q.storage_column === 'enqueteur_id'} // locked field
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
                        value={q.storage_column === 'enqueteur_id' ? `${currentUser.prenom} ${currentUser.nom}` : String(propVal || '')}
                        onChange={(e) => handleQuestionChange(q, e.target.value.toUpperCase())}
                      />
                    )}

                    {/* TELEPHONE FIELD (Exactly 10 digits as required) */}
                    {q.type === 'tel' && (
                      <div>
                        <input
                          type="text"
                          pattern="[0-9]{10}"
                          inputMode="tel"
                          placeholder="Ex. 0707080910 (10 chiffres)"
                          className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          value={String(propVal || '')}
                          onChange={(e) => {
                            // Filter non-digits
                            const clean = e.target.value.replace(/[^0-9]/g, '').substring(0, 10);
                            handleQuestionChange(q, clean);
                          }}
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Format ivoirien obligatoire à 10 chiffres (commence par 01, 05 ou 07).</p>
                      </div>
                    )}

                    {/* EMAIL FIELD (forced lowercase) */}
                    {q.type === 'email' && (
                      <input
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        placeholder="Ex. nom.prenom@education.gouv.ci"
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        value={String(propVal || '')}
                        onChange={(e) => handleQuestionChange(q, e.target.value.toLowerCase())}
                      />
                    )}

                    {/* DATE FIELD */}
                    {q.type === 'date' && (
                      <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]} // Ne doit pas être future
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        value={String(propVal || '')}
                        onChange={(e) => handleQuestionChange(q, e.target.value)}
                      />
                    )}

                    {/* NUMBER FIELD */}
                    {q.type === 'number' && (
                      <input
                        type="number"
                        min="0"
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        value={propVal !== undefined ? String(propVal) : ''}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const cleanVal = isNaN(parsed) ? 0 : parsed;
                          if (q.storage_table === 'evaluations' || q.storage_table === 'etablissements') {
                            handleQuestionChange(q, cleanVal);
                          } else {
                            handleQuestionChange(q, String(cleanVal));
                          }
                        }}
                      />
                    )}

                    {/* RATING 1 TO 5 SELECTOR */}
                    {q.type === 'rating_1_5' && (
                      <div className="space-y-1.5 pt-1">
                        <select
                          className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white font-medium focus:ring-1 focus:ring-indigo-500"
                          value={String(propVal || '')}
                          onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                        >
                          <option value="">Sélectionner une note (1 à 5)...</option>
                          {q.options.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>{opt.value} - {opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* SELECT BOX */}
                    {q.type === 'select' && (
                      <select
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500"
                        value={q.boolean_mapping ? (propVal ? 'oui' : 'non') : String(propVal || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          const finalVal = q.boolean_mapping ? q.boolean_mapping[val] : val;
                          handleQuestionChange(q, finalVal);
                        }}
                      >
                        <option value="">Sélectionner une option...</option>
                        {q.options.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}

                    {/* TEXTAREA FIELD */}
                    {q.type === 'textarea' && (
                      <textarea
                        className="w-full p-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 h-24"
                        value={String(propVal || '')}
                        onChange={(e) => handleQuestionChange(q, e.target.value.toUpperCase())}
                      />
                    )}

                    {/* GPS CAPTURE FIELD */}
                    {q.type === 'gps' && (
                      <div className="space-y-1">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Latitude, Longitude"
                            className="flex-1 p-2 border border-gray-200 rounded-lg text-xs outline-none bg-gray-50"
                            disabled
                            value={
                              etablissementUpdates.latitude !== undefined && etablissementUpdates.longitude !== undefined
                                ? `${etablissementUpdates.latitude}, ${etablissementUpdates.longitude}`
                                : 'GPS à capturer'
                            }
                          />
                          <button
                            type="button"
                            onClick={captureGpsPosition}
                            disabled={gpsLoading}
                            className="px-3 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-wait rounded-lg text-xs text-indigo-700 font-bold transition-all shrink-0"
                          >
                            {gpsLoading ? 'Localisation...' : 'Géolocaliser'}
                          </button>
                        </div>
                        {gpsError && (
                          <p className="text-[10px] text-red-600 font-semibold">{gpsError}</p>
                        )}
                      </div>
                    )}

                    {/* Validation hint */}
                    {q.controle_coherence && (
                      <p className="text-[10px] text-gray-400 font-medium italic mt-0.5">Règle de contrôle : {q.controle_coherence}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM VALIDATION ERRORS PREVIEW BANNER */}
        {submissionErrors.length > 0 && (
          <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2">
            <p className="text-xs font-bold text-red-800 flex items-center space-x-1.5 uppercase tracking-wide">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>Contrôle de conformité obligatoire : {submissionErrors.length} erreur(s) bloquante(s)</span>
            </p>
            <ul className="list-disc pl-5 text-[11px] text-red-900 space-y-1">
              {submissionErrors.map((err, idx) => (
                <li key={idx} className="leading-snug">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Wizard Footer controls */}
        <div className="border-t border-slate-200 pt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={safeActiveSectionIdx === 0 || !isDraftLikeStatus || isFormBusy}
            onClick={() => navigateToSection(safeActiveSectionIdx - 1)}
            className="flex items-center space-x-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {navigationSaving ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
            <span>Précédent</span>
          </button>

          {safeActiveSectionIdx < lastSectionIdx ? (
            <button
              type="button"
              disabled={!isDraftLikeStatus || isFormBusy}
              onClick={() => navigateToSection(safeActiveSectionIdx + 1)}
              className="flex items-center space-x-1 px-5 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white hover:text-amber-400 border border-slate-800 rounded text-xs font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Suivant</span>
              {navigationSaving ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          ) : (
            // Final submit definitively button (on last step 20)
            <button
              type="button"
              disabled={isFormBusy || noActiveCampagne}
              onClick={handleSubmitDefinitively}
              className="flex items-center space-x-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded text-xs font-black shadow-md border border-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Soumission en cours...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Soumettre Définitivement l'Évaluation</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
