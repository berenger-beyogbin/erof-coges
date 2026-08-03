import React, { useEffect, useMemo, useState } from 'react';
import { Award, Copy, Edit, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { AccessDifficulty, Campagne, Evaluation, EvaluationNiveau2, SelectionErof, User } from '../types';
import { needsAccessJustification } from '../niveau2Scoring';
import { supabase } from '../supabaseClient';

const emptyForm: Partial<EvaluationNiveau2> = {
  effectif_coges: null, existence_prescolaire: false, effectif_prescolaire: 0,
  distance_iepp_km: undefined, difficulte_acces: 'facile', justification_acces: '',
  distance_centre_sante_km: undefined, difficulte_acces_sante: 'facile', justification_acces_sante: '',
  statut: 'brouillon', commentaire_selection: '', participants_atelier: ''
};

const difficultyOptions: { value: AccessDifficulty; label: string }[] = [
  { value: 'facile', label: 'Facile' },
  { value: 'moyennement_difficile', label: 'Moyennement difficile' },
  { value: 'difficile', label: 'Difficile' },
  { value: 'tres_difficile', label: 'Très difficile' }
];

export default function Niveau2Selection({ currentUser, publicToken }: { currentUser: User; publicToken?: string }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [selections, setSelections] = useState<SelectionErof[]>([]);
  const [eligible, setEligible] = useState<(Evaluation & { etablissement_nom?: string; drena_nom?: string; iepp_nom?: string; score_global?: number })[]>([]);
  const [selectedDrena, setSelectedDrena] = useState('');
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [editing, setEditing] = useState<SelectionErof | null>(null);
  const [form, setForm] = useState<Partial<EvaluationNiveau2>>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const load = async (preferredCampaign?: string) => {
    setLoading(true); setError('');
    try {
      if (publicToken) {
        const { data, error: rpcError } = await supabase!.rpc('niveau2_public_context', { p_token: publicToken });
        if (rpcError) throw rpcError;
        const context: any = data;
        const publicEvaluations = (context?.evaluations || []).map((row: any) => ({
          id: row.id, campagne_id: row.campagne_id, statut: 'valide', effectif_total: row.effectif_total,
          etablissement_nom: row.etablissement_nom, drena_nom: row.drena_nom, iepp_nom: row.iepp_nom,
          score_global: row.score_erof
        }));
        const publicSelections: SelectionErof[] = (context?.evaluations || []).filter((row: any) => row.selection_id).map((row: any) => ({
          id: row.selection_id, campagne_id: row.campagne_id, evaluation_id: row.id, rang_erof: 0,
          score_erof: row.score_erof, evaluation: publicEvaluations.find((ev: any) => ev.id === row.id), niveau2: row.niveau2
        }));
        setCampagnes(context?.campagne ? [context.campagne] : []); setCampagneId(context?.campagne?.id || '');
        setEligible(publicEvaluations); setSelections(publicSelections); setLoading(false); return publicSelections;
      }
      const [campaignRows, evaluationRows] = await Promise.all([DataService.getCampagnes(), DataService.getEvaluations(currentUser)]);
      const target = preferredCampaign || campagneId || campaignRows.find(c => c.statut === 'ouverte')?.id || campaignRows[0]?.id || '';
      setCampagnes(campaignRows); setCampagneId(target);
      setEligible(evaluationRows.filter(e => e.campagne_id === target && ['valide', 'verrouille'].includes(e.statut) && e.score_global != null));
      const loadedSelections = target ? await DataService.getNiveau2Selections(currentUser, target) : [];
      setSelections(loadedSelections); return loadedSelections;
    } catch (e) { setError(formatUserFacingError('le chargement de la sélection de niveau 2', e)); return []; }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [publicToken]);

  const drenaOptions = useMemo(() => [...new Set(eligible.map(e => e.drena_nom).filter(Boolean) as string[])].sort(), [eligible]);
  const candidates = eligible.filter(e => !selectedDrena || e.drena_nom === selectedDrena)
    .sort((a, b) => Number(b.score_global || 0) - Number(a.score_global || 0));
  const ranked = useMemo(() => [...selections].sort((a, b) => {
    const na = a.niveau2; const nb = b.niveau2;
    return Number(nb?.score_total ?? -1) - Number(na?.score_total ?? -1)
      || Number(b.score_erof) - Number(a.score_erof)
      || (Number(nb?.score_distance_sante ?? -1) + Number(nb?.score_acces_sante ?? -1)) - (Number(na?.score_distance_sante ?? -1) + Number(na?.score_acces_sante ?? -1))
      || Number(nb?.score_acces_coges ?? -1) - Number(na?.score_acces_coges ?? -1)
      || Number(nb?.score_distance_iepp ?? -1) - Number(na?.score_distance_iepp ?? -1)
      || a.rang_erof - b.rang_erof;
  }), [selections]);
  const displayedRanked = useMemo(() => selectedDrena ? ranked.filter(row => row.evaluation?.drena_nom === selectedDrena) : [], [ranked, selectedDrena]);
  const drenaEligibleCount = selectedDrena ? eligible.filter(row => row.drena_nom === selectedDrena).length : 0;
  const drenaValidatedCount = displayedRanked.filter(row => row.niveau2?.statut === 'valide').length;
  const isReadOnly = editing?.niveau2?.statut === 'valide' && currentUser.role !== 'admin_national';

  const startEvaluation = async () => {
    if (!selectedEvaluationId) return;
    const existingSelection = selections.find(row => row.evaluation_id === selectedEvaluationId);
    if (existingSelection) {
      openForm(existingSelection);
      setSelectedEvaluationId('');
      return;
    }
    setBusy(true); setError('');
    const result = publicToken
      ? await (async () => { const { error: rpcError } = await supabase!.rpc('niveau2_public_start', { p_token: publicToken, p_evaluation_id: selectedEvaluationId }); return { success: !rpcError, error: rpcError?.message }; })()
      : await DataService.addNiveau2Selection(selectedEvaluationId, currentUser);
    if (!result.success) setError(result.error || 'Impossible de démarrer cette grille.');
    else {
      const next = await load(campagneId);
      const opened = next.find(row => row.evaluation_id === selectedEvaluationId);
      if (opened) openForm(opened);
      setSelectedEvaluationId('');
    }
    setBusy(false);
  };

  const removeSelection = async (row: SelectionErof) => {
    if (!window.confirm(`Retirer ${row.evaluation?.etablissement_nom || 'ce COGES'} de la sélection ?`)) return;
    setBusy(true); const result = await DataService.removeNiveau2Selection(row.id, currentUser);
    if (!result.success) setError(result.error || 'Suppression impossible.'); else await load(campagneId);
    setBusy(false);
  };

  const openForm = (row: SelectionErof) => {
    setEditing(row);
    setForm({ ...emptyForm, ...(row.niveau2 || {}), effectif_coges: row.evaluation?.effectif_total ?? null });
    setError('');
    setActionMessage('');
  };
  const save = async (status: 'brouillon' | 'soumis' | 'valide') => {
    if (!editing) return;
    if (isReadOnly) return setError('Cette grille a été soumise et ne peut plus être modifiée. Contactez un administrateur si une correction est nécessaire.');
    setActionMessage('');
    if (status !== 'brouillon') {
      if (form.distance_iepp_km === undefined || form.distance_iepp_km === null || form.distance_centre_sante_km === undefined || form.distance_centre_sante_km === null) return setError('Renseignez les deux distances avant de soumettre.');
      if (Number(form.distance_iepp_km) < 0 || Number(form.distance_centre_sante_km) < 0 || Number(form.effectif_prescolaire) < 0) return setError('Les valeurs numériques doivent être positives.');
      if (needsAccessJustification(form.difficulte_acces_sante || 'facile') && !form.justification_acces_sante?.trim()) return setError('Justifiez la difficulté d’accès au centre de santé.');
    }
    setBusy(true); setError('');
    try {
      const result = publicToken
        ? await (async () => { const { error: rpcError } = await supabase!.rpc('niveau2_public_save', { p_token: publicToken, p_selection_id: editing.id, p_payload: form, p_submit: status === 'valide' }); return { success: !rpcError, error: rpcError?.message }; })()
        : await DataService.saveNiveau2(editing.id, { ...form, statut: status }, currentUser);
      if (!result.success) {
        setError(result.error || 'Enregistrement impossible.');
        return;
      }
      setActionMessage(status === 'brouillon' ? 'Brouillon enregistré avec succès.' : status === 'soumis' ? 'Grille soumise avec succès.' : 'Grille soumise et validée avec succès.');
      if (publicToken) await load(campagneId);
      else {
        const next = await DataService.getNiveau2Selections(currentUser, campagneId);
        setSelections(next);
        const updated = next.find(s => s.id === editing.id);
        if (updated) { setEditing(updated); setForm({ ...emptyForm, ...(updated.niveau2 || {}), effectif_coges: updated.evaluation?.effectif_total ?? null }); }
      }
    } catch (e) {
      setError(formatUserFacingError('l’enregistrement de la grille de niveau 2', e));
    } finally {
      setBusy(false);
    }
  };

  const generateWorkshopLink = async () => {
    if (!campagneId || !supabase) return;
    setBusy(true); setError('');
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error: rpcError } = await supabase.rpc('create_niveau2_workshop_link', { p_campagne_id: campagneId, p_expires_at: expiresAt });
      if (rpcError) throw rpcError;
      const link = `${window.location.origin}${window.location.pathname}?niveau2_public=${data}`;
      setGeneratedLink(link); await navigator.clipboard.writeText(link);
      setActionMessage('Lien d’atelier valable 24 heures généré et copié.');
    } catch (e) { setError(formatUserFacingError('la génération du lien d’atelier', e)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="hidden md:flex bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Award className="h-5 w-5 text-amber-500"/> Sélection COGES – niveau 2</h2>
        <p className="text-xs text-slate-500 mt-1">Valorisation en atelier de chaque COGES déjà évalué et validé dans EROF.</p></div>
      <div className="flex flex-wrap items-center gap-2">{!publicToken && <select value={campagneId} onChange={e => { setCampagneId(e.target.value); void load(e.target.value); }} className="border rounded-lg px-3 py-2 text-xs bg-white">
        {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} – {c.annee_scolaire}</option>)}</select>
        }<button onClick={() => void load(campagneId)} className="p-2 border rounded-lg hover:bg-slate-50"><RefreshCw className="h-4 w-4"/></button>
        {!publicToken && currentUser.role === 'admin_national' && <button onClick={() => void generateWorkshopLink()} disabled={busy || !campagneId} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-50"><Link2 className="h-4 w-4"/>Générer le lien</button>}</div>
    </div>

    {generatedLink && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2"><input readOnly value={generatedLink} className="flex-1 bg-white border rounded-lg px-3 py-2 text-xs"/><button onClick={() => void navigator.clipboard.writeText(generatedLink)} className="p-2 bg-emerald-600 text-white rounded-lg" title="Copier"><Copy className="h-4 w-4"/></button></div>}

    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs font-semibold">{error}</div>}

    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div><h3 className="text-sm font-extrabold text-slate-900">Identifier le COGES à évaluer en atelier</h3>
        <p className="text-[11px] text-slate-500 mt-1">Les choix proposés proviennent exclusivement des résultats EROF validés ou verrouillés de la campagne.</p></div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,0.7fr)_minmax(320px,1.3fr)_auto] gap-3 items-end">
        <label className="text-xs font-bold text-slate-700">1. DRENA<select value={selectedDrena} onChange={e => { setSelectedDrena(e.target.value); setSelectedEvaluationId(''); setEditing(null); setActionMessage(''); setError(''); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white">
          <option value="">Choisir une DRENA…</option>{drenaOptions.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">2. COGES<select value={selectedEvaluationId} onChange={e => setSelectedEvaluationId(e.target.value)} disabled={!selectedDrena} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white disabled:bg-slate-100">
          <option value="">Choisir un COGES…</option>{candidates.map(e => <option key={e.id} value={e.id}>{e.etablissement_nom} — {e.iepp_nom || 'IEPP non renseignée'} — EROF {e.score_global}/5</option>)}</select></label>
        <button onClick={startEvaluation} disabled={!selectedEvaluationId || busy} className="inline-flex items-center justify-center gap-2 bg-amber-500 disabled:opacity-40 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"><Plus className="h-4 w-4"/> Remplir le niveau 2</button>
      </div>
      {selectedDrena && <p className="text-[11px] font-semibold text-slate-600">Progression pour {selectedDrena} : {drenaValidatedCount} grille(s) validée(s) sur {drenaEligibleCount} COGES EROF éligible(s).</p>}
    </div>

    {selectedDrena && <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,0.9fr)_minmax(560px,1.1fr)] gap-5 items-start">
      <section className="hidden md:block order-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden xl:sticky xl:top-4">
        <div className="px-4 py-3 bg-slate-900 text-white"><h3 className="text-sm font-extrabold">COGES en évaluation niveau 2</h3><p className="text-[10px] text-slate-300 mt-0.5">Cliquez sur une ligne pour saisir ou modifier sa grille.</p></div>
        {loading ? <div className="p-12 text-center text-xs text-slate-500">Chargement…</div> : displayedRanked.length === 0 ? <div className="p-12 text-center text-xs text-slate-500">Aucune grille niveau 2 démarrée pour cette DRENA.</div> :
        <div className="overflow-x-auto max-h-[68vh] overflow-y-auto"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-slate-600 uppercase text-[9px] sticky top-0"><tr>
          <th className="px-3 py-3 text-left">COGES</th><th className="px-2 py-3 text-center">EROF</th><th className="px-2 py-3 text-center">Statut</th><th className="px-2 py-3"></th>
        </tr></thead><tbody className="divide-y">{displayedRanked.map(row => <tr key={row.id} onClick={() => openForm(row)} className={`cursor-pointer transition-colors ${editing?.id === row.id ? 'bg-amber-50 border-l-4 border-amber-500' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
          <td className="px-3 py-3"><p className="font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</p><p className="text-[10px] text-slate-500">{row.evaluation?.drena_nom} / {row.evaluation?.iepp_nom}</p></td>
          <td className="px-2 py-3 text-center font-mono">{row.score_erof}/5</td>
          <td className="px-2 py-3 text-center"><span className="px-1.5 py-1 rounded bg-slate-100 font-bold text-[9px] uppercase">{row.niveau2?.statut || 'à saisir'}</span></td>
          <td className="px-2 py-3"><div className="flex gap-1"><button onClick={e => { e.stopPropagation(); openForm(row); }} className="p-2 rounded bg-slate-900 text-white" title="Remplir la grille"><Edit className="h-3.5 w-3.5"/></button>{currentUser.role === 'admin_national' && <button onClick={e => { e.stopPropagation(); void removeSelection(row); }} className="p-2 rounded bg-red-50 text-red-600" title="Retirer"><Trash2 className="h-3.5 w-3.5"/></button>}</div></td>
        </tr>)}</tbody></table></div>}
      </section>

      <section className="order-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[460px]">
      {editing ? <>
      <div className="bg-slate-900 text-white p-4"><p className="text-[10px] uppercase text-amber-400 font-bold">Grille</p><h3 className="font-bold">{editing.evaluation?.etablissement_nom}</h3><p className="text-[10px] text-slate-300 mt-1">{editing.evaluation?.drena_nom} / {editing.evaluation?.iepp_nom}</p></div>
      <div className="p-5 space-y-5"><div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><NumberField label="Effectif total des élèves (provenant d’EROF)" value={form.effectif_coges} disabled onChange={() => undefined}/></div>
        <label className="text-xs font-bold text-slate-700">Existence du préscolaire<select disabled={isReadOnly} value={form.existence_prescolaire ? 'oui':'non'} onChange={e => setForm(f => ({...f,existence_prescolaire:e.target.value==='oui',effectif_prescolaire:e.target.value==='oui'?f.effectif_prescolaire:0}))} className="mt-1 w-full border rounded-lg p-2 bg-white disabled:bg-slate-100"><option value="non">Non</option><option value="oui">Oui</option></select></label>
        <NumberField label="Effectif préscolaire" value={form.effectif_prescolaire} disabled={!form.existence_prescolaire || isReadOnly} onChange={v => setForm(f => ({...f,effectif_prescolaire:v}))}/>
        <NumberField label="Distance COGES – IEPP (km)" value={form.distance_iepp_km} disabled={isReadOnly} step="0.1" onChange={v => setForm(f => ({...f,distance_iepp_km:v}))}/>
        <DifficultyField label="Difficulté d’accès au COGES" value={form.difficulte_acces || 'facile'} disabled={isReadOnly} onChange={v => setForm(f => ({...f,difficulte_acces:v}))}/>
        <NumberField label="Distance COGES – centre de santé (km)" value={form.distance_centre_sante_km} disabled={isReadOnly} step="0.1" onChange={v => setForm(f => ({...f,distance_centre_sante_km:v}))}/>
        <DifficultyField label="Difficulté d’accès au centre de santé" value={form.difficulte_acces_sante || 'facile'} disabled={isReadOnly} onChange={v => setForm(f => ({...f,difficulte_acces_sante:v}))}/>
      </div>
      {needsAccessJustification(form.difficulte_acces_sante || 'facile') && <TextField label="Justification de l’accès au centre de santé *" value={form.justification_acces_sante || ''} disabled={isReadOnly} onChange={v => setForm(f=>({...f,justification_acces_sante:v}))}/>} 
      <div className="border-t border-slate-200 pt-4 space-y-3">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
        {actionMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{actionMessage}</div>}
        {busy && <div className="text-xs font-semibold text-slate-500">Enregistrement en cours…</div>}
        {isReadOnly ? <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-600">Grille soumise et verrouillée. Seul un administrateur peut la modifier.</div> : <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void save('brouillon')} disabled={busy} className="px-4 py-2 border rounded-lg text-xs font-bold disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button><button type="button" onClick={() => void save('valide')} disabled={busy} className="px-4 py-2 bg-amber-500 rounded-lg text-xs font-bold disabled:opacity-50">Soumettre</button></div>}
      </div>
      </div></> : <div className="min-h-[460px] flex flex-col items-center justify-center text-center p-10"><Edit className="h-10 w-10 text-slate-300 mb-3"/><h3 className="text-sm font-bold text-slate-700">Sélectionnez un COGES</h3><p className="text-xs text-slate-500 mt-1 max-w-sm">Choisissez un COGES dans le tableau de gauche pour afficher ici sa grille de saisie ou de modification.</p></div>}
      </section>
    </div>}
  </div>;
}

function NumberField({label,value,onChange,disabled,step='1'}:{label:string;value:any;onChange:(v:number|undefined)=>void;disabled?:boolean;step?:string}) { return <label className="text-xs font-bold text-slate-700">{label}<input type="number" min="0" step={step} disabled={disabled} value={value ?? ''} onChange={e=>onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="mt-1 w-full border rounded-lg p-2 disabled:bg-slate-100"/></label>; }
function DifficultyField({label,value,onChange,disabled}:{label:string;value:AccessDifficulty;onChange:(v:AccessDifficulty)=>void;disabled?:boolean}) { return <label className="text-xs font-bold text-slate-700">{label}<select disabled={disabled} value={value} onChange={e=>onChange(e.target.value as AccessDifficulty)} className="mt-1 w-full border rounded-lg p-2 bg-white disabled:bg-slate-100">{difficultyOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function TextField({label,value,onChange,disabled}:{label:string;value:string;onChange:(v:string)=>void;disabled?:boolean}) { return <label className="block text-xs font-bold text-slate-700">{label}<textarea disabled={disabled} value={value} onChange={e=>onChange(e.target.value)} rows={2} className="mt-1 w-full border rounded-lg p-2 font-normal disabled:bg-slate-100"/></label>; }
