import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Campagne, Evaluation, SelectionErof, User } from '../types';

export default function Niveau2Statistics({ currentUser }: { currentUser: User }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [eligible, setEligible] = useState<(Evaluation & { drena_nom?: string })[]>([]);
  const [selections, setSelections] = useState<SelectionErof[]>([]);
  const [selectedDrena, setSelectedDrena] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (preferredCampaign?: string) => {
    setLoading(true);
    setError('');
    try {
      const [campaignRows, evaluationRows] = await Promise.all([DataService.getCampagnes(), DataService.getEvaluations(currentUser)]);
      const target = preferredCampaign || campagneId || campaignRows.find(c => c.statut === 'ouverte')?.id || campaignRows[0]?.id || '';
      setCampagnes(campaignRows);
      setCampagneId(target);
      setEligible(evaluationRows.filter(e => e.campagne_id === target && ['valide', 'verrouille'].includes(e.statut) && e.score_global != null));
      setSelections(target ? await DataService.getNiveau2Selections(currentUser, target) : []);
      setSelectedDrena('');
    } catch (e) {
      setError(formatUserFacingError('le chargement du bilan statistique de niveau 2', e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const drenaOptions = useMemo(() => [...new Set(eligible.map(row => row.drena_nom).filter(Boolean) as string[])].sort(), [eligible]);
  const drenaEligibleCount = eligible.filter(row => row.drena_nom === selectedDrena).length;
  const drenaSelections = selections.filter(row => row.evaluation?.drena_nom === selectedDrena);
  const ranking = drenaSelections
    .filter(row => row.niveau2?.statut === 'valide')
    .sort((a, b) => Number(b.niveau2?.score_total ?? -1) - Number(a.niveau2?.score_total ?? -1)
      || Number(b.niveau2?.effectif_coges ?? 0) - Number(a.niveau2?.effectif_coges ?? 0)
      || (a.evaluation?.etablissement_nom || '').localeCompare(b.evaluation?.etablissement_nom || '', 'fr'));
  const completionRate = drenaEligibleCount ? Math.round((ranking.length / drenaEligibleCount) * 100) : 0;
  const averageScore = ranking.length ? ranking.reduce((total, row) => total + Number(row.niveau2?.score_total || 0), 0) / ranking.length : 0;

  return <div className="space-y-5">
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><BarChart3 className="h-5 w-5 text-amber-500"/> Bilan statistique — niveau 2</h2>
      <p className="mt-1 text-xs text-slate-500">Suivi du remplissage et classement des COGES validés par DRENA.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1fr)_minmax(240px,1fr)_auto] md:items-end">
        <label className="text-xs font-bold text-slate-700">Campagne<select value={campagneId} onChange={e => void load(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
          {campagnes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.annee_scolaire}</option>)}
        </select></label>
        <label className="text-xs font-bold text-slate-700">DRENA<select value={selectedDrena} onChange={e => setSelectedDrena(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
          <option value="">Sélectionner une DRENA…</option>{drenaOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <button type="button" onClick={() => void load(campagneId)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Actualiser</button>
      </div>
    </header>

    {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
    {!selectedDrena ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Sélectionnez une DRENA pour afficher son bilan.</div> :
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-4 py-3 text-white"><h3 className="text-sm font-extrabold">{selectedDrena}</h3><p className="mt-0.5 text-[10px] text-slate-300">Classement par score niveau 2, puis par effectif total en cas d’égalité.</p></div>
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <StatCard label="COGES éligibles" value={drenaEligibleCount}/>
        <StatCard label="Grilles démarrées" value={drenaSelections.length}/>
        <StatCard label="Grilles validées" value={`${ranking.length} (${completionRate} %)`}/>
        <StatCard label="Score moyen" value={ranking.length ? `${averageScore.toFixed(1)} / 16` : '—'}/>
      </div>
      {ranking.length === 0 ? <div className="border-t border-slate-200 p-8 text-center text-xs text-slate-500">Aucune grille validée à classer pour cette DRENA.</div> :
      <div className="overflow-x-auto border-t border-slate-200"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-[9px] uppercase text-slate-600"><tr>
        <th className="px-3 py-3 text-center">Rang</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Effectif</th><th className="px-3 py-3 text-center">Score</th><th className="px-3 py-3 text-left">Priorité</th>
      </tr></thead><tbody className="divide-y">{ranking.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-3 py-3 text-center font-extrabold">{index + 1}</td><td className="px-3 py-3 font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</td><td className="px-3 py-3 text-slate-600">{row.evaluation?.iepp_nom || 'Non renseignée'}</td><td className="px-3 py-3 text-center font-mono">{Number(row.niveau2?.effectif_coges || 0).toLocaleString('fr-FR')}</td><td className="px-3 py-3 text-center font-extrabold">{row.niveau2?.score_total}/16</td><td className="px-3 py-3">{row.niveau2?.niveau_priorite}</td>
      </tr>)}</tbody></table></div>}
    </section>}
  </div>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p></div>;
}
