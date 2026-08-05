import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, LockKeyhole, RefreshCw, Save } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Campagne, Evaluation, FinalSelectionSession, SelectionErof, User } from '../types';

type RankedEvaluation = Evaluation & {
  etablissement_nom?: string;
  drena_nom?: string;
  iepp_nom?: string;
  score_global?: number;
};

export default function FinalCogesSelection({ currentUser }: { currentUser: User }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [evaluations, setEvaluations] = useState<RankedEvaluation[]>([]);
  const [niveau2Rows, setNiveau2Rows] = useState<SelectionErof[]>([]);
  const [sessions, setSessions] = useState<FinalSelectionSession[]>([]);
  const [selectedDrena, setSelectedDrena] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commentaire, setCommentaire] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (preferredCampaign?: string, preserveDrena = false) => {
    setLoading(true); setError('');
    try {
      const [campaignRows, evaluationRows] = await Promise.all([DataService.getCampagnes(), DataService.getEvaluations(currentUser)]);
      const target = preferredCampaign || campagneId || campaignRows.find(c => c.statut === 'ouverte')?.id || campaignRows[0]?.id || '';
      const [n2, finalRows] = await Promise.all([
        target ? DataService.getNiveau2Selections(currentUser, target) : Promise.resolve([]),
        target ? DataService.getFinalSelections(target) : Promise.resolve([])
      ]);
      setCampagnes(campaignRows); setCampagneId(target);
      setEvaluations(evaluationRows.filter(e => e.campagne_id === target && ['valide', 'verrouille'].includes(e.statut) && e.score_global != null));
      setNiveau2Rows(n2); setSessions(finalRows);
      if (!preserveDrena) { setSelectedDrena(''); setSelectedIds([]); setCommentaire(''); }
    } catch (e) { setError(formatUserFacingError('le chargement de la sélection définitive', e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const drenaOptions = useMemo(() => [...new Set(niveau2Rows
    .filter(row => row.niveau2?.statut === 'valide')
    .map(row => row.evaluation?.drena_nom).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr')), [niveau2Rows]);
  const currentSession = sessions.find(row => row.drena_nom === selectedDrena);
  const isLocked = currentSession?.statut === 'valide';

  const level1Ranks = useMemo(() => {
    const ranked = evaluations.filter(row => row.drena_nom === selectedDrena)
      .sort((a, b) => Number(b.score_global ?? -1) - Number(a.score_global ?? -1)
        || (a.etablissement_nom || '').localeCompare(b.etablissement_nom || '', 'fr'));
    return new Map(ranked.map((row, index) => [row.id, index + 1]));
  }, [evaluations, selectedDrena]);

  const candidates = useMemo(() => niveau2Rows
    .filter(row => row.evaluation?.drena_nom === selectedDrena && row.niveau2?.statut === 'valide')
    .sort((a, b) => Number(b.niveau2?.score_total ?? -1) - Number(a.niveau2?.score_total ?? -1)
      || Number(b.niveau2?.effectif_coges ?? 0) - Number(a.niveau2?.effectif_coges ?? 0)
      || (a.evaluation?.etablissement_nom || '').localeCompare(b.evaluation?.etablissement_nom || '', 'fr')),
  [niveau2Rows, selectedDrena]);
  const level2Ranks = useMemo(() => new Map(candidates.map((row, index) => [row.evaluation_id, index + 1])), [candidates]);

  const chooseDrena = (name: string) => {
    setSelectedDrena(name); setError(''); setMessage('');
    const session = sessions.find(row => row.drena_nom === name);
    setSelectedIds(session?.evaluation_ids || []);
    setCommentaire(session?.commentaire || '');
  };

  const toggle = (evaluationId: string) => {
    if (isLocked) return;
    setSelectedIds(ids => ids.includes(evaluationId) ? ids.filter(id => id !== evaluationId) : [...ids, evaluationId]);
  };

  const save = async (validate: boolean) => {
    if (!selectedDrena || !selectedIds.length || busy) return;
    if (validate && !window.confirm(`Valider définitivement ${selectedIds.length} COGES pour ${selectedDrena} ? Cette action verrouillera la sélection.`)) return;
    setBusy(true); setError(''); setMessage('');
    const result = await DataService.saveFinalSelection(campagneId, selectedDrena, selectedIds, commentaire, validate, currentUser);
    if (!result.success) setError(result.error || 'Enregistrement impossible.');
    else {
      setMessage(validate ? 'Sélection définitive validée et verrouillée.' : 'Brouillon enregistré.');
      await load(campagneId, true);
    }
    setBusy(false);
  };

  return <div className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ClipboardCheck className="h-5 w-5 text-emerald-600"/> Sélection définitive des COGES</h2>
      <p className="mt-1 text-xs text-slate-500">Croisez les résultats validés des évaluations 1 et 2, retenez les COGES puis fixez leur classement final par DRENA.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-xs font-bold text-slate-700">Campagne<select value={campagneId} onChange={e => void load(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">{campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.annee_scolaire}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">DRENA<select value={selectedDrena} onChange={e => chooseDrena(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Sélectionner une DRENA…</option>{drenaOptions.map(name => <option key={name}>{name}</option>)}</select></label>
        <button type="button" onClick={() => void load(campagneId, true)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Actualiser</button>
      </div>
    </header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
    {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</div>}

    {!selectedDrena ? <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Sélectionnez une DRENA pour commencer.</div> :
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
        <div><h3 className="text-sm font-extrabold">{selectedDrena}</h3><p className="text-[10px] text-slate-300">{candidates.length} COGES disposent des deux évaluations validées · {selectedIds.length} retenu(s) et classé(s)</p></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${isLocked ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950'}`}>{isLocked ? <LockKeyhole className="h-3.5 w-3.5"/> : null}{isLocked ? 'Sélection validée' : 'Brouillon modifiable'}</span>
      </div>
      {!isLocked && candidates.length > 0 && <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900"><strong>Comment classer :</strong> cochez les COGES dans l’ordre souhaité. Le premier coché devient rang 1, le deuxième rang 2, et ainsi de suite. Une ligne décochée perd son rang et les suivants sont automatiquement remontés.</div>}
      {candidates.length === 0 ? <div className="p-10 text-center text-xs text-slate-500">Aucun COGES avec une évaluation 2 validée dans cette DRENA.</div> :
      <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-xs"><thead className="bg-slate-100 text-[9px] uppercase text-slate-600"><tr>
        <th className="px-3 py-3 text-center">Retenir</th><th className="px-3 py-3 text-center">Rang final</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Rang éval. 1</th><th className="px-3 py-3 text-center">Score éval. 1</th><th className="px-3 py-3 text-center">Rang éval. 2</th><th className="px-3 py-3 text-center">Score priorité</th><th className="px-3 py-3 text-left">Priorité</th>
      </tr></thead><tbody className="divide-y">{candidates.map(row => {
        const finalIndex = selectedIds.indexOf(row.evaluation_id);
        const checked = finalIndex >= 0;
        return <tr key={row.id} onClick={() => toggle(row.evaluation_id)} className={`${isLocked ? '' : 'cursor-pointer'} ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
          <td className="px-3 py-3 text-center"><input type="checkbox" checked={checked} disabled={isLocked} onChange={() => toggle(row.evaluation_id)} onClick={e => e.stopPropagation()} className="h-4 w-4 accent-emerald-600"/></td>
          <td className="px-3 py-3 text-center">{checked ? <span className="inline-flex min-w-7 justify-center rounded-full bg-emerald-600 px-2 py-1 font-extrabold text-white">{finalIndex + 1}</span> : '—'}</td>
          <td className="px-3 py-3 font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</td><td className="px-3 py-3 text-slate-600">{row.evaluation?.iepp_nom || '—'}</td><td className="px-3 py-3 text-center font-bold">{level1Ranks.get(row.evaluation_id) || '—'}</td><td className="px-3 py-3 text-center">{Number(row.score_erof).toFixed(2).replace('.', ',')} / 5</td><td className="px-3 py-3 text-center font-bold">{level2Ranks.get(row.evaluation_id) || '—'}</td><td className="px-3 py-3 text-center font-extrabold">{row.niveau2?.score_total} / 16</td><td className="px-3 py-3">{row.niveau2?.niveau_priorite}</td>
        </tr>;
      })}</tbody></table></div>}
      <div className="space-y-3 border-t bg-slate-50 p-4">
        <label className="block text-xs font-bold text-slate-700">Commentaire ou justification de la sélection<textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} disabled={isLocked} rows={3} className="mt-1 w-full rounded-lg border bg-white p-3 font-normal disabled:bg-slate-100" placeholder="Préciser les raisons de la sélection finale…"/></label>
        {!isLocked && <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void save(false)} disabled={busy || !selectedIds.length} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"><Save className="h-4 w-4"/> Enregistrer le brouillon</button><button type="button" onClick={() => void save(true)} disabled={busy || !selectedIds.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4"/> Valider définitivement</button></div>}
      </div>
    </section>}
  </div>;
}
