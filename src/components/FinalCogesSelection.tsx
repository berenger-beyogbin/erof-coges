import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, Download, Link2, LockKeyhole, RefreshCw, Save } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Campagne, Evaluation, FinalSelectionSession, SelectionErof, User } from '../types';
import { supabase } from '../supabaseClient';

type RankedEvaluation = Evaluation & {
  etablissement_nom?: string;
  drena_nom?: string;
  iepp_nom?: string;
  score_global?: number;
};

export default function FinalCogesSelection({ currentUser, publicToken }: { currentUser: User; publicToken?: string }) {
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
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const load = async (preferredCampaign?: string, preserveDrena = false) => {
    setLoading(true); setError('');
    try {
      if (publicToken) {
        const { data, error: rpcError } = await supabase!.rpc('final_selection_public_context', { p_token: publicToken });
        if (rpcError) throw rpcError;
        const context: any = data;
        const candidateRows: SelectionErof[] = (context?.candidates || []).map((row: any) => ({
          id: row.selection_id, campagne_id: row.campagne_id, evaluation_id: row.evaluation_id,
          rang_erof: 0, score_erof: Number(row.score_erof || 0), niveau2: row.niveau2,
          evaluation: { id: row.evaluation_id, campagne_id: row.campagne_id, statut: 'valide',
            etablissement_nom: row.etablissement_nom, iepp_nom: row.iepp_nom, drena_nom: row.drena_nom } as any
        }));
        const evaluationRows: RankedEvaluation[] = candidateRows.map(row => ({
          ...(row.evaluation as Evaluation), score_global: row.score_erof,
          etablissement_nom: row.evaluation?.etablissement_nom, iepp_nom: row.evaluation?.iepp_nom, drena_nom: row.evaluation?.drena_nom
        }));
        setCampagnes(context?.campagne ? [context.campagne] : []); setCampagneId(context?.campagne?.id || '');
        setEvaluations(evaluationRows); setNiveau2Rows(candidateRows); setSessions(context?.sessions || []);
        setLoading(false); return;
      }
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

  useEffect(() => { void load(); }, [publicToken]);

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
    const result = publicToken
      ? await (async () => { const { error: rpcError } = await supabase!.rpc('final_selection_public_save', {
          p_token: publicToken, p_drena_nom: selectedDrena, p_evaluation_ids: selectedIds,
          p_commentaire: commentaire || null, p_validate: validate
        }); return { success: !rpcError, error: rpcError?.message }; })()
      : await DataService.saveFinalSelection(campagneId, selectedDrena, selectedIds, commentaire, validate, currentUser);
    if (!result.success) setError(result.error || 'Enregistrement impossible.');
    else {
      setMessage(validate ? 'Sélection définitive validée et verrouillée.' : 'Brouillon enregistré.');
      await load(campagneId, true);
    }
    setBusy(false);
  };

  const generatePublicLink = async () => {
    if (!campagneId || !supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data, error: rpcError } = await supabase.rpc('create_final_selection_public_link', { p_campagne_id: campagneId, p_expires_at: expiresAt });
      if (rpcError) throw rpcError;
      const link = `${window.location.origin}${window.location.pathname}?selection_finale_public=${data}`;
      setGeneratedLink(link); await navigator.clipboard.writeText(link);
      setMessage('Lien public valable 24 heures généré et copié.');
    } catch (e) { setError(formatUserFacingError('la génération du lien public', e)); }
    finally { setBusy(false); }
  };

  const exportManualSelections = async () => {
    const niveau2ByEvaluation = new Map<string, SelectionErof>(niveau2Rows.map(row => [row.evaluation_id, row]));
    const evaluationById = new Map<string, RankedEvaluation>(evaluations.map(row => [row.id, row]));
    const exportRows = sessions
      .slice()
      .sort((a, b) => a.drena_nom.localeCompare(b.drena_nom, 'fr'))
      .flatMap(session => (session.evaluation_ids || []).map((evaluationId, index) => {
        const niveau2 = niveau2ByEvaluation.get(evaluationId);
        const evaluation = evaluationById.get(evaluationId);
        return {
          DRENA: session.drena_nom,
          'Rang final manuel': index + 1,
          'COGES retenu': evaluation?.etablissement_nom || niveau2?.evaluation?.etablissement_nom || evaluationId,
          IEPP: evaluation?.iepp_nom || niveau2?.evaluation?.iepp_nom || 'Non renseignée',
          'Score évaluation 1 / 5': Number(evaluation?.score_global ?? niveau2?.score_erof ?? 0),
          'Score évaluation 2 / 16': Number(niveau2?.niveau2?.score_total ?? 0),
          'Niveau de priorité': niveau2?.niveau2?.niveau_priorite || '',
          'Statut de la sélection': session.statut === 'valide' ? 'Validée' : 'Brouillon',
          'Commentaire / justification': session.commentaire || ''
        };
      }));

    if (!exportRows.length) {
      setError('Aucune sélection manuelle définitive n’est enregistrée pour cette campagne.');
      return;
    }

    setExporting(true); setError(''); setMessage('');
    try {
      const XLSX = await import('@e965/xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:I1' };
      worksheet['!cols'] = [
        { wch: 24 }, { wch: 18 }, { wch: 38 }, { wch: 26 }, { wch: 23 },
        { wch: 24 }, { wch: 25 }, { wch: 24 }, { wch: 45 }
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sélections définitives');
      const campaign = campagnes.find(item => item.id === campagneId);
      const safeCampaign = (campaign?.nom || 'campagne').replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '-').replace(/^-+|-+$/g, '');
      XLSX.writeFile(workbook, `selections-manuelles-definitives-toutes-drena-${safeCampaign}-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    } catch (e) {
      setError(formatUserFacingError('l’export Excel des sélections manuelles définitives', e));
    } finally { setExporting(false); }
  };

  return <div className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ClipboardCheck className="h-5 w-5 text-emerald-600"/> Sélection définitive des COGES</h2>
      <p className="mt-1 text-xs text-slate-500">Croisez les résultats validés des évaluations 1 et 2, retenez les COGES puis fixez leur classement final par DRENA.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-xs font-bold text-slate-700">Campagne<select value={campagneId} disabled={Boolean(publicToken)} onChange={e => void load(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 disabled:bg-slate-100">{campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.annee_scolaire}</option>)}</select></label>
        <label className="text-xs font-bold text-slate-700">DRENA<select value={selectedDrena} onChange={e => chooseDrena(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Sélectionner une DRENA…</option>{drenaOptions.map(name => <option key={name}>{name}</option>)}</select></label>
        <button type="button" onClick={() => void load(campagneId, true)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Actualiser</button>
      </div>
    </header>

    {!publicToken && currentUser.role === 'admin_national' && <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => void exportManualSelections()} disabled={loading || exporting || sessions.every(session => !session.evaluation_ids?.length)} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Download className="h-4 w-4"/> {exporting ? 'Export en cours…' : 'Exporter les sélections de toutes les DRENA'}</button><button type="button" onClick={() => void generatePublicLink()} disabled={busy || !campagneId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Link2 className="h-4 w-4"/> Générer un lien public</button></div>}
    {generatedLink && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><input readOnly value={generatedLink} className="flex-1 rounded-lg border bg-white px-3 py-2 text-xs"/><button type="button" onClick={() => void navigator.clipboard.writeText(generatedLink)} className="rounded-lg bg-emerald-600 p-2 text-white" title="Copier"><Copy className="h-4 w-4"/></button></div>}

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
