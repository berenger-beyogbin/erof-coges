import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, RefreshCw, Trophy } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Campagne, FinalSelectionSession, SelectionErof, User } from '../types';

type RankedCoges = SelectionErof & { combinedScore: number };

function computeCombinedScore(row: SelectionErof): number {
  const level1 = Math.max(0, Math.min(5, Number(row.score_erof) || 0));
  const level2 = Math.max(0, Math.min(16, Number(row.niveau2?.score_total) || 0));
  return 40 * (level1 / 5) + 60 * (level2 / 16);
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export default function CombinedCogesRanking({ currentUser }: { currentUser: User }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [rows, setRows] = useState<SelectionErof[]>([]);
  const [sessions, setSessions] = useState<FinalSelectionSession[]>([]);
  const [selectedDrena, setSelectedDrena] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (preferredCampaign?: string) => {
    setLoading(true);
    setError('');
    try {
      const campaignRows = await DataService.getCampagnes();
      const target = preferredCampaign || campagneId || campaignRows.find(c => c.statut === 'ouverte')?.id || campaignRows[0]?.id || '';
      const [niveau2Rows, finalRows] = await Promise.all([
        target ? DataService.getNiveau2Selections(currentUser, target) : Promise.resolve([]),
        target ? DataService.getFinalSelections(target) : Promise.resolve([])
      ]);
      setCampagnes(campaignRows);
      setCampagneId(target);
      setRows(niveau2Rows);
      setSessions(finalRows);
    } catch (e) {
      setError(formatUserFacingError('le chargement du classement combiné', e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const rankings = useMemo(() => {
    const grouped = new Map<string, RankedCoges[]>();
    rows.filter(row => row.niveau2?.statut === 'valide' && row.evaluation?.drena_nom).forEach(row => {
      const drena = row.evaluation!.drena_nom!;
      const current = grouped.get(drena) || [];
      current.push({ ...row, combinedScore: computeCombinedScore(row) });
      grouped.set(drena, current);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr')).map(([drena, candidates]) => ({
      drena,
      candidates: candidates.sort((a, b) => b.combinedScore - a.combinedScore
        || Number(b.niveau2?.score_total || 0) - Number(a.niveau2?.score_total || 0)
        || Number(b.score_erof || 0) - Number(a.score_erof || 0)
        || Number(b.niveau2?.effectif_coges || 0) - Number(a.niveau2?.effectif_coges || 0)
        || (a.evaluation?.etablissement_nom || '').localeCompare(b.evaluation?.etablissement_nom || '', 'fr'))
    }));
  }, [rows]);

  const sessionByDrena = useMemo(() => new Map(sessions.map(session => [session.drena_nom, session])), [sessions]);
  const rowByEvaluation = useMemo(() => new Map(rows.map(row => [row.evaluation_id, row])), [rows]);
  const displayedRanking = rankings.find(item => item.drena === selectedDrena) || rankings[0];

  useEffect(() => {
    if (rankings.length && !rankings.some(item => item.drena === selectedDrena)) setSelectedDrena(rankings[0].drena);
  }, [rankings, selectedDrena]);

  return <div className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><Trophy className="h-5 w-5 text-violet-600"/> Classement combiné des COGES</h2>
          <p className="mt-1 text-xs text-slate-500">Classement automatique par DRENA, suivi de la sélection définitive classée manuellement.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-slate-700">Campagne
            <select value={campagneId} onChange={e => void load(e.target.value)} className="mt-1 block min-w-64 rounded-lg border bg-white px-3 py-2">
              {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.annee_scolaire}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void load(campagneId)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Actualiser</button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-950">
        <Calculator className="h-4 w-4 shrink-0"/><strong>Score / 100 = 40 × (évaluation 1 ÷ 5) + 60 × (évaluation 2 ÷ 16).</strong>
      </div>
      {rankings.length > 0 && <label className="mt-4 block max-w-md text-xs font-bold text-slate-700">DRENA à afficher
        <select value={displayedRanking?.drena || ''} onChange={e => setSelectedDrena(e.target.value)} className="mt-1 block w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm">
          {rankings.map(item => <option key={item.drena} value={item.drena}>{item.drena} — {item.candidates.length} COGES</option>)}
        </select>
      </label>}
    </header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
    {!loading && rankings.length === 0 && <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">Aucun COGES ne possède une évaluation 2 validée pour cette campagne.</div>}

    {displayedRanking && [displayedRanking].map(({ drena, candidates }) => {
      const session = sessionByDrena.get(drena);
      const manualRows = (session?.evaluation_ids || []).map(id => rowByEvaluation.get(id)).filter(Boolean) as SelectionErof[];
      return <section key={drena} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-900 px-4 py-3 text-white"><h3 className="text-sm font-extrabold">DRENA {drena}</h3><p className="text-[10px] text-slate-300">{candidates.length} COGES classé(s) automatiquement</p></div>

        <div className="bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">1. Sélection définitive manuelle</h4><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${session?.statut === 'valide' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{session ? session.statut : 'Non réalisée'}</span></div>
          {manualRows.length === 0 ? <p className="rounded-lg border border-dashed bg-white p-5 text-center text-xs text-slate-500">Aucune sélection définitive manuelle enregistrée pour cette DRENA.</p> :
          <div className="overflow-x-auto"><table className="min-w-[680px] w-full bg-white text-xs"><thead className="bg-emerald-50 text-[9px] uppercase text-emerald-900"><tr><th className="px-3 py-3 text-center">Rang manuel</th><th className="px-3 py-3 text-left">COGES retenu</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Score combiné / 100</th></tr></thead><tbody className="divide-y">{manualRows.map((row, index) => <tr key={row.id}><td className="px-3 py-3 text-center font-extrabold text-emerald-700">{index + 1}</td><td className="px-3 py-3 font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</td><td className="px-3 py-3 text-slate-600">{row.evaluation?.iepp_nom || '—'}</td><td className="px-3 py-3 text-center font-bold">{formatNumber(computeCombinedScore(row))}</td></tr>)}</tbody></table></div>}
          {session?.commentaire && <p className="mt-3 rounded-lg border bg-white p-3 text-xs text-slate-600"><strong>Justification :</strong> {session.commentaire}</p>}
        </div>

        <div className="border-t border-slate-200 p-4"><h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-violet-700">2. Classement automatique combiné</h4>
          <div className="overflow-x-auto"><table className="min-w-[780px] w-full text-xs"><thead className="bg-violet-50 text-[9px] uppercase text-violet-900"><tr><th className="px-3 py-3 text-center">Rang</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Éval. 1 / 5</th><th className="px-3 py-3 text-center">Éval. 2 / 16</th><th className="px-3 py-3 text-center">Score / 100</th><th className="px-3 py-3 text-left">Priorité</th></tr></thead>
            <tbody className="divide-y">{candidates.map((row, index) => <tr key={row.id} className={index < 3 ? 'bg-amber-50/50' : ''}><td className="px-3 py-3 text-center font-extrabold">{index + 1}</td><td className="px-3 py-3 font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</td><td className="px-3 py-3 text-slate-600">{row.evaluation?.iepp_nom || '—'}</td><td className="px-3 py-3 text-center">{formatNumber(Number(row.score_erof))}</td><td className="px-3 py-3 text-center font-bold">{row.niveau2?.score_total}</td><td className="px-3 py-3 text-center"><span className="rounded-full bg-violet-100 px-2.5 py-1 font-extrabold text-violet-800">{formatNumber(row.combinedScore)}</span></td><td className="px-3 py-3">{row.niveau2?.niveau_priorite}</td></tr>)}</tbody>
          </table></div>
        </div>
      </section>;
    })}
  </div>;
}
