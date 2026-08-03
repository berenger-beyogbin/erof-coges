import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle, Edit, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { AccessDifficulty, Campagne, Evaluation, EvaluationNiveau2, SelectionErof, User } from '../types';
import { computeNiveau2Scores, needsAccessJustification } from '../niveau2Scoring';

const emptyForm: Partial<EvaluationNiveau2> = {
  effectif_coges: null, existence_prescolaire: false, effectif_prescolaire: 0,
  distance_iepp_km: undefined, difficulte_acces: 'facile', justification_acces: '',
  distance_centre_sante_km: undefined, difficulte_acces_sante: 'facile', justification_acces_sante: '',
  statut: 'brouillon', commentaire_selection: ''
};

const difficultyOptions: { value: AccessDifficulty; label: string }[] = [
  { value: 'facile', label: 'Facile (0 pt)' },
  { value: 'moyennement_difficile', label: 'Moyennement difficile (1 pt)' },
  { value: 'difficile', label: 'Difficile (2 pts)' },
  { value: 'tres_difficile', label: 'Très difficile (3 pts)' }
];

export default function Niveau2Selection({ currentUser }: { currentUser: User }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [selections, setSelections] = useState<SelectionErof[]>([]);
  const [eligible, setEligible] = useState<(Evaluation & { etablissement_nom?: string; score_global?: number })[]>([]);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState('');
  const [editing, setEditing] = useState<SelectionErof | null>(null);
  const [form, setForm] = useState<Partial<EvaluationNiveau2>>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (preferredCampaign?: string) => {
    setLoading(true); setError('');
    try {
      const [campaignRows, evaluationRows] = await Promise.all([DataService.getCampagnes(), DataService.getEvaluations(currentUser)]);
      const target = preferredCampaign || campagneId || campaignRows.find(c => c.statut === 'ouverte')?.id || campaignRows[0]?.id || '';
      setCampagnes(campaignRows); setCampagneId(target);
      setEligible(evaluationRows.filter(e => e.campagne_id === target && ['valide', 'verrouille'].includes(e.statut) && e.score_global != null));
      setSelections(target ? await DataService.getNiveau2Selections(currentUser, target) : []);
    } catch (e) { setError(formatUserFacingError('le chargement de la sélection de niveau 2', e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const selectedIds = useMemo(() => new Set(selections.map(s => s.evaluation_id)), [selections]);
  const candidates = eligible.filter(e => !selectedIds.has(e.id)).sort((a, b) => Number(b.score_global || 0) - Number(a.score_global || 0));
  const ranked = useMemo(() => [...selections].sort((a, b) => {
    const na = a.niveau2; const nb = b.niveau2;
    return Number(nb?.score_total ?? -1) - Number(na?.score_total ?? -1)
      || Number(b.score_erof) - Number(a.score_erof)
      || (Number(nb?.score_distance_sante ?? -1) + Number(nb?.score_acces_sante ?? -1)) - (Number(na?.score_distance_sante ?? -1) + Number(na?.score_acces_sante ?? -1))
      || Number(nb?.score_acces_coges ?? -1) - Number(na?.score_acces_coges ?? -1)
      || Number(nb?.score_distance_iepp ?? -1) - Number(na?.score_distance_iepp ?? -1)
      || a.rang_erof - b.rang_erof;
  }), [selections]);

  const preview = computeNiveau2Scores({
    existence_prescolaire: Boolean(form.existence_prescolaire), effectif_prescolaire: Number(form.effectif_prescolaire || 0),
    distance_iepp_km: Number(form.distance_iepp_km || 0), difficulte_acces: form.difficulte_acces || 'facile',
    distance_centre_sante_km: Number(form.distance_centre_sante_km || 0), difficulte_acces_sante: form.difficulte_acces_sante || 'facile'
  });

  const addSelection = async () => {
    if (!selectedEvaluationId) return;
    setBusy(true); setError('');
    const result = await DataService.addNiveau2Selection(selectedEvaluationId, currentUser);
    if (!result.success) setError(result.error || 'Impossible de présélectionner ce COGES.');
    else { setSelectedEvaluationId(''); await load(campagneId); }
    setBusy(false);
  };

  const removeSelection = async (row: SelectionErof) => {
    if (!window.confirm(`Retirer ${row.evaluation?.etablissement_nom || 'ce COGES'} de la sélection ?`)) return;
    setBusy(true); const result = await DataService.removeNiveau2Selection(row.id, currentUser);
    if (!result.success) setError(result.error || 'Suppression impossible.'); else await load(campagneId);
    setBusy(false);
  };

  const openForm = (row: SelectionErof) => { setEditing(row); setForm({ ...emptyForm, ...(row.niveau2 || {}) }); setError(''); };
  const save = async (status: 'brouillon' | 'soumis' | 'valide') => {
    if (!editing) return;
    if (status !== 'brouillon') {
      if (form.distance_iepp_km === undefined || form.distance_iepp_km === null || form.distance_centre_sante_km === undefined || form.distance_centre_sante_km === null) return setError('Renseignez les deux distances avant de soumettre.');
      if (Number(form.distance_iepp_km) < 0 || Number(form.distance_centre_sante_km) < 0 || Number(form.effectif_prescolaire) < 0) return setError('Les valeurs numériques doivent être positives.');
      if (needsAccessJustification(form.difficulte_acces || 'facile') && !form.justification_acces?.trim()) return setError('Justifiez la difficulté d’accès au COGES.');
      if (needsAccessJustification(form.difficulte_acces_sante || 'facile') && !form.justification_acces_sante?.trim()) return setError('Justifiez la difficulté d’accès au centre de santé.');
    }
    setBusy(true); setError('');
    const result = await DataService.saveNiveau2(editing.id, { ...form, statut: status }, currentUser);
    if (!result.success) setError(result.error || 'Enregistrement impossible.');
    else { setEditing(null); await load(campagneId); }
    setBusy(false);
  };

  return <div className="space-y-5">
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><Award className="h-5 w-5 text-amber-500"/> Sélection COGES – niveau 2</h2>
        <p className="text-xs text-slate-500 mt-1">Présélection EROF, codification sur 16 points et classement final.</p></div>
      <div className="flex items-center gap-2"><select value={campagneId} onChange={e => { setCampagneId(e.target.value); void load(e.target.value); }} className="border rounded-lg px-3 py-2 text-xs bg-white">
        {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} – {c.annee_scolaire}</option>)}</select>
        <button onClick={() => void load(campagneId)} className="p-2 border rounded-lg hover:bg-slate-50"><RefreshCw className="h-4 w-4"/></button></div>
    </div>

    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs font-semibold">{error}</div>}

    {currentUser.role === 'admin_national' && <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-col md:flex-row gap-3 items-end"><div className="flex-1 w-full"><label className="text-xs font-bold text-slate-700">Ajouter une évaluation EROF validée ({selections.length}/15)</label>
        <select value={selectedEvaluationId} onChange={e => setSelectedEvaluationId(e.target.value)} disabled={selections.length >= 15} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs bg-white">
          <option value="">Choisir un COGES…</option>{candidates.map(e => <option key={e.id} value={e.id}>{e.etablissement_nom} — EROF {e.score_global}/5</option>)}</select></div>
        <button onClick={addSelection} disabled={!selectedEvaluationId || busy || selections.length >= 15} className="inline-flex items-center gap-2 bg-amber-500 disabled:opacity-40 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs"><Plus className="h-4 w-4"/> Présélectionner</button></div>
    </div>}

    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {loading ? <div className="p-12 text-center text-xs text-slate-500">Chargement…</div> : ranked.length === 0 ? <div className="p-12 text-center text-xs text-slate-500">Aucun COGES présélectionné pour cette campagne.</div> :
      <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-slate-600 uppercase text-[10px]"><tr>
        <th className="px-3 py-3 text-center">Rang final</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-center">Rang EROF</th><th className="px-3 py-3 text-center">EROF /5</th><th className="px-3 py-3 text-center">Niveau 2 /16</th><th className="px-3 py-3 text-center">Priorité</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 text-right">Actions</th>
      </tr></thead><tbody className="divide-y">{ranked.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-3 py-3 text-center font-mono font-bold">{row.niveau2 ? index + 1 : '—'}</td><td className="px-3 py-3"><p className="font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</p><p className="text-[10px] text-slate-500">{row.evaluation?.drena_nom} / {row.evaluation?.iepp_nom}</p></td>
        <td className="px-3 py-3 text-center">{row.rang_erof}</td><td className="px-3 py-3 text-center font-mono">{row.score_erof}</td><td className="px-3 py-3 text-center font-mono font-extrabold text-base">{row.niveau2?.score_total ?? '—'}</td>
        <td className="px-3 py-3 text-center">{row.niveau2?.niveau_priorite || 'Non évalué'}</td><td className="px-3 py-3 text-center"><span className="px-2 py-1 rounded bg-slate-100 font-bold text-[10px] uppercase">{row.niveau2?.statut || 'à saisir'}</span></td>
        <td className="px-3 py-3"><div className="flex justify-end gap-1"><button onClick={() => openForm(row)} className="p-2 rounded bg-slate-900 text-white" title="Remplir la grille"><Edit className="h-3.5 w-3.5"/></button>{currentUser.role === 'admin_national' && <button onClick={() => void removeSelection(row)} className="p-2 rounded bg-red-50 text-red-600" title="Retirer"><Trash2 className="h-3.5 w-3.5"/></button>}</div></td>
      </tr>)}</tbody></table></div>}
    </div>

    {editing && <div className="fixed inset-0 z-50 bg-slate-950/60 p-4 flex items-center justify-center"><div className="bg-white w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-xl shadow-2xl">
      <div className="sticky top-0 bg-slate-900 text-white p-4 flex justify-between"><div><p className="text-[10px] uppercase text-amber-400 font-bold">Grille de codification</p><h3 className="font-bold">{editing.evaluation?.etablissement_nom}</h3></div><button onClick={() => setEditing(null)}><X className="h-5 w-5"/></button></div>
      <div className="p-5 space-y-5"><div className="grid md:grid-cols-2 gap-4">
        <NumberField label="Effectif du COGES (informatif)" value={form.effectif_coges} onChange={v => setForm(f => ({...f,effectif_coges:v}))}/>
        <label className="text-xs font-bold text-slate-700">Existence du préscolaire<select value={form.existence_prescolaire ? 'oui':'non'} onChange={e => setForm(f => ({...f,existence_prescolaire:e.target.value==='oui',effectif_prescolaire:e.target.value==='oui'?f.effectif_prescolaire:0}))} className="mt-1 w-full border rounded-lg p-2 bg-white"><option value="non">Non (0 pt)</option><option value="oui">Oui (1 pt)</option></select></label>
        <NumberField label="Effectif préscolaire" value={form.effectif_prescolaire} disabled={!form.existence_prescolaire} onChange={v => setForm(f => ({...f,effectif_prescolaire:v}))}/>
        <NumberField label="Distance COGES – IEPP (km)" value={form.distance_iepp_km} step="0.1" onChange={v => setForm(f => ({...f,distance_iepp_km:v}))}/>
        <DifficultyField label="Difficulté d’accès au COGES" value={form.difficulte_acces || 'facile'} onChange={v => setForm(f => ({...f,difficulte_acces:v}))}/>
        <NumberField label="Distance COGES – centre de santé (km)" value={form.distance_centre_sante_km} step="0.1" onChange={v => setForm(f => ({...f,distance_centre_sante_km:v}))}/>
        <DifficultyField label="Difficulté d’accès au centre de santé" value={form.difficulte_acces_sante || 'facile'} onChange={v => setForm(f => ({...f,difficulte_acces_sante:v}))}/>
      </div>
      {needsAccessJustification(form.difficulte_acces || 'facile') && <TextField label="Justification de l’accès au COGES *" value={form.justification_acces || ''} onChange={v => setForm(f=>({...f,justification_acces:v}))}/>} 
      {needsAccessJustification(form.difficulte_acces_sante || 'facile') && <TextField label="Justification de l’accès au centre de santé *" value={form.justification_acces_sante || ''} onChange={v => setForm(f=>({...f,justification_acces_sante:v}))}/>} 
      <TextField label="Commentaire de sélection" value={form.commentaire_selection || ''} onChange={v => setForm(f=>({...f,commentaire_selection:v}))}/>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between"><div><p className="text-xs font-bold text-amber-900">Score calculé</p><p className="text-xs text-amber-700">{preview.niveau_priorite}</p></div><p className="text-3xl font-mono font-extrabold text-slate-900">{preview.score_total}<span className="text-sm text-slate-500">/16</span></p></div>
      <div className="flex flex-wrap justify-end gap-2"><button onClick={() => void save('brouillon')} disabled={busy} className="px-4 py-2 border rounded-lg text-xs font-bold">Enregistrer le brouillon</button><button onClick={() => void save('soumis')} disabled={busy} className="px-4 py-2 bg-amber-500 rounded-lg text-xs font-bold">Soumettre</button>{currentUser.role === 'admin_national' && <button onClick={() => void save('valide')} disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold inline-flex gap-2"><CheckCircle className="h-4 w-4"/>Valider</button>}</div>
      </div></div></div>}
  </div>;
}

function NumberField({label,value,onChange,disabled,step='1'}:{label:string;value:any;onChange:(v:number)=>void;disabled?:boolean;step?:string}) { return <label className="text-xs font-bold text-slate-700">{label}<input type="number" min="0" step={step} disabled={disabled} value={value ?? ''} onChange={e=>onChange(Number(e.target.value))} className="mt-1 w-full border rounded-lg p-2 disabled:bg-slate-100"/></label>; }
function DifficultyField({label,value,onChange}:{label:string;value:AccessDifficulty;onChange:(v:AccessDifficulty)=>void}) { return <label className="text-xs font-bold text-slate-700">{label}<select value={value} onChange={e=>onChange(e.target.value as AccessDifficulty)} className="mt-1 w-full border rounded-lg p-2 bg-white">{difficultyOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function TextField({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) { return <label className="block text-xs font-bold text-slate-700">{label}<textarea value={value} onChange={e=>onChange(e.target.value)} rows={2} className="mt-1 w-full border rounded-lg p-2 font-normal"/></label>; }
