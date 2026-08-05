import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronRight, Printer, RefreshCw, TrendingUp } from 'lucide-react';
import { DataService, formatUserFacingError } from '../data/dataService';
import { Campagne, Evaluation, SelectionErof, User } from '../types';

export default function Niveau2Statistics({ currentUser }: { currentUser: User }) {
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [campagneId, setCampagneId] = useState('');
  const [eligible, setEligible] = useState<(Evaluation & {
    etablissement_nom?: string;
    drena_nom?: string;
    iepp_nom?: string;
    score_global?: number;
    classification?: string;
  })[]>([]);
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

  const drenaOptions = useMemo(() => [...new Set([
    ...eligible.map(row => row.drena_nom),
    ...selections.map(row => row.evaluation?.drena_nom)
  ].filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr')), [eligible, selections]);
  const recapByDrena = useMemo(() => drenaOptions.map(drena => {
    const drenaEligible = eligible.filter(row => row.drena_nom === drena);
    const drenaRows = selections.filter(row => row.evaluation?.drena_nom === drena);
    const started = drenaRows.filter(row => Boolean(row.niveau2));
    const draft = drenaRows.filter(row => row.niveau2?.statut === 'brouillon');
    const submitted = drenaRows.filter(row => row.niveau2?.statut === 'soumis');
    const validated = drenaRows.filter(row => row.niveau2?.statut === 'valide');
    const latestUpdate = started.reduce<string | undefined>((latest, row) => {
      const candidate = row.niveau2?.updated_at || row.niveau2?.created_at;
      return candidate && (!latest || candidate > latest) ? candidate : latest;
    }, undefined);
    return {
      drena,
      eligible: drenaEligible.length,
      selected: drenaRows.length,
      notStarted: Math.max(0, drenaEligible.length - started.length),
      started: started.length,
      draft: draft.length,
      submitted: submitted.length,
      validated: validated.length,
      completionRate: drenaEligible.length ? Math.round((validated.length / drenaEligible.length) * 100) : 0,
      latestUpdate
    };
  }), [drenaOptions, eligible, selections]);
  const globalRecap = useMemo(() => {
    const totals = recapByDrena.reduce((acc, row) => ({
      eligible: acc.eligible + row.eligible,
      selected: acc.selected + row.selected,
      notStarted: acc.notStarted + row.notStarted,
      started: acc.started + row.started,
      draft: acc.draft + row.draft,
      submitted: acc.submitted + row.submitted,
      validated: acc.validated + row.validated,
      latestUpdate: row.latestUpdate && (!acc.latestUpdate || row.latestUpdate > acc.latestUpdate) ? row.latestUpdate : acc.latestUpdate
    }), { eligible: 0, selected: 0, notStarted: 0, started: 0, draft: 0, submitted: 0, validated: 0, latestUpdate: undefined as string | undefined });
    return {
      ...totals,
      drena: 'TOTAL GLOBAL',
      completionRate: totals.eligible ? Math.round((totals.validated / totals.eligible) * 100) : 0
    };
  }, [recapByDrena]);
  const drenaEligibleCount = eligible.filter(row => row.drena_nom === selectedDrena).length;
  const drenaSelections = selections.filter(row => row.evaluation?.drena_nom === selectedDrena);
  const evaluation1Ranking = eligible
    .filter(row => row.drena_nom === selectedDrena)
    .sort((a, b) => Number(b.score_global ?? -1) - Number(a.score_global ?? -1)
      || (a.etablissement_nom || '').localeCompare(b.etablissement_nom || '', 'fr'));
  const evaluation2Ranking = drenaSelections
    .filter(row => row.niveau2?.statut === 'valide')
    .sort((a, b) => Number(b.niveau2?.score_total ?? -1) - Number(a.niveau2?.score_total ?? -1)
      || Number(b.niveau2?.effectif_coges ?? 0) - Number(a.niveau2?.effectif_coges ?? 0)
      || (a.evaluation?.etablissement_nom || '').localeCompare(b.evaluation?.etablissement_nom || '', 'fr'));
  const completionRate = drenaEligibleCount ? Math.round((evaluation2Ranking.length / drenaEligibleCount) * 100) : 0;
  const averageScore = evaluation2Ranking.length ? evaluation2Ranking.reduce((total, row) => total + Number(row.niveau2?.score_total || 0), 0) / evaluation2Ranking.length : 0;
  const selectedCampaign = campagnes.find(c => c.id === campagneId);

  const printResults = () => {
    const pageStyle = document.createElement('style');
    pageStyle.id = 'niveau-results-page-style';
    pageStyle.textContent = '@page { size: A4 portrait; margin: 10mm; }';
    document.head.appendChild(pageStyle);
    document.body.classList.add('niveau-results-print-mode');
    const cleanup = () => {
      document.body.classList.remove('niveau-results-print-mode');
      pageStyle.remove();
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

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

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900"><TrendingUp className="h-4 w-4 text-emerald-600"/> Avancement des évaluations de niveau 2</h3><p className="mt-0.5 text-[10px] text-slate-500">Lecture de gauche à droite : prévues → à démarrer → en cours → en attente → terminées.</p></div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{drenaOptions.length} DRENA</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <StatCard label="COGES validés au niveau 1" value={globalRecap.eligible}/>
        <StatCard label="À démarrer" value={globalRecap.notStarted}/>
        <StatCard label="En cours ou en attente" value={globalRecap.draft + globalRecap.submitted}/>
        <StatCard label="Terminées" value={`${globalRecap.validated} sur ${globalRecap.eligible}`}/>
      </div>
      <div className="mx-4 mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
        <strong>Les évaluations prévues</strong> correspondent à tous les COGES validés au niveau 1 EROF. Le taux d’avancement est donc : évaluations niveau 2 terminées ÷ COGES validés au niveau 1. Ici : {globalRecap.validated} ÷ {globalRecap.eligible || 0} = {globalRecap.completionRate} %.
      </div>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-[900px] w-full text-xs">
          <thead className="bg-slate-100 text-[9px] uppercase text-slate-600"><tr>
            <th className="sticky left-0 z-10 bg-slate-100 px-3 py-3 text-left">DRENA / Ensemble</th>
            <th className="px-3 py-3 text-center">Prévues</th><th className="px-3 py-3 text-center">À démarrer</th><th className="px-3 py-3 text-center">En cours</th><th className="px-3 py-3 text-center">En attente de validation</th><th className="px-3 py-3 text-center">Terminées</th><th className="px-3 py-3 text-center">Avancement</th><th className="px-3 py-3 text-left">Dernière activité</th><th className="px-2 py-3" aria-label="Ouvrir"/>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[globalRecap, ...recapByDrena].map((row, index) => {
              const isGlobal = index === 0;
              return <tr key={row.drena} className={isGlobal ? 'bg-slate-900 font-bold text-white' : 'cursor-pointer hover:bg-amber-50'} onClick={() => !isGlobal && setSelectedDrena(row.drena)}>
                <td className={`sticky left-0 z-10 px-3 py-3 font-extrabold ${isGlobal ? 'bg-slate-900' : 'bg-white'}`}>{row.drena}</td>
                <td className="px-3 py-3 text-center font-bold">{row.eligible}</td><td className="px-3 py-3 text-center">{row.notStarted}</td><td className="px-3 py-3 text-center">{row.draft}</td><td className="px-3 py-3 text-center">{row.submitted}</td><td className="px-3 py-3 text-center font-extrabold">{row.validated}</td>
                <td className="px-3 py-3 text-center"><ProgressBadge value={row.completionRate} dark={isGlobal}/></td>
                <td className={`px-3 py-3 text-[10px] ${isGlobal ? 'text-slate-300' : 'text-slate-500'}`}>{formatUpdateDate(row.latestUpdate)}</td><td className="px-2 py-3">{!isGlobal && <ChevronRight className="h-4 w-4 text-slate-400"/>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!loading && recapByDrena.length === 0 && <div className="p-8 text-center text-xs text-slate-500">Aucune donnée disponible pour cette campagne.</div>}
    </section>

    {!selectedDrena ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Sélectionnez une DRENA pour afficher son bilan.</div> :
    <div id="niveau-results-print-document" className="space-y-5">
    <div className="flex justify-end"><button type="button" onClick={printResults} disabled={!evaluation1Ranking.length && !evaluation2Ranking.length} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-40"><Printer className="h-4 w-4"/> Imprimer les deux tableaux</button></div>
    <section id="niveau-results-evaluation-1" className="niveau-results-print-sheet overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 px-4 py-3 text-white"><h3 className="text-sm font-extrabold">{selectedDrena} — Résultats de l’évaluation 1</h3><p className="mt-0.5 text-[10px] text-slate-300">Classement des COGES par score EROF décroissant.</p></div>
      <PrintMeta campagne={selectedCampaign} drena={selectedDrena}/>
      {evaluation1Ranking.length === 0 ? <div className="p-8 text-center text-xs text-slate-500">Aucune évaluation 1 validée à classer pour cette DRENA.</div> :
      <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-[9px] uppercase text-slate-600"><tr>
        <th className="px-3 py-3 text-center">Rang</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Score EROF</th><th className="px-3 py-3 text-left">Classification</th>
      </tr></thead><tbody className="divide-y">{evaluation1Ranking.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-3 py-3 text-center font-extrabold">{index + 1}</td><td className="px-3 py-3 font-bold text-slate-800">{row.etablissement_nom || row.id}</td><td className="px-3 py-3 text-slate-600">{row.iepp_nom || 'Non renseignée'}</td><td className="px-3 py-3 text-center font-extrabold">{Number(row.score_global).toFixed(2).replace('.', ',')} / 5</td><td className="px-3 py-3">{row.classification || '—'}</td>
      </tr>)}</tbody></table></div>}
    </section>

    <section id="niveau-results-evaluation-2" className="niveau-results-print-sheet overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-amber-500 px-4 py-3 text-slate-950"><h3 className="text-sm font-extrabold">{selectedDrena} — Résultats de l’évaluation 2</h3><p className="mt-0.5 text-[10px] text-slate-800">Classement par priorité décroissante, puis par effectif total en cas d’égalité.</p></div>
      <PrintMeta campagne={selectedCampaign} drena={selectedDrena}/>
      <div data-print-exclude="true" className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <StatCard label="COGES éligibles" value={drenaEligibleCount}/>
        <StatCard label="Grilles démarrées" value={drenaSelections.length}/>
        <StatCard label="Grilles validées" value={`${evaluation2Ranking.length} (${completionRate} %)`}/>
        <StatCard label="Score moyen" value={evaluation2Ranking.length ? `${averageScore.toFixed(1)} / 16` : '—'}/>
      </div>
      {evaluation2Ranking.length === 0 ? <div className="border-t border-slate-200 p-8 text-center text-xs text-slate-500">Aucune grille validée à classer pour cette DRENA.</div> :
      <div className="overflow-x-auto border-t border-slate-200"><table className="min-w-full text-xs"><thead className="bg-slate-100 text-[9px] uppercase text-slate-600"><tr>
        <th className="px-3 py-3 text-center">Rang</th><th className="px-3 py-3 text-left">COGES</th><th className="px-3 py-3 text-left">IEPP</th><th className="px-3 py-3 text-center">Effectif</th><th className="px-3 py-3 text-center">Score de priorité</th><th className="px-3 py-3 text-left">Niveau de priorité</th>
      </tr></thead><tbody className="divide-y">{evaluation2Ranking.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="px-3 py-3 text-center font-extrabold">{index + 1}</td><td className="px-3 py-3 font-bold text-slate-800">{row.evaluation?.etablissement_nom || row.evaluation_id}</td><td className="px-3 py-3 text-slate-600">{row.evaluation?.iepp_nom || 'Non renseignée'}</td><td className="px-3 py-3 text-center font-mono">{Number(row.niveau2?.effectif_coges || 0).toLocaleString('fr-FR')}</td><td className="px-3 py-3 text-center font-extrabold">{row.niveau2?.score_total}/16</td><td className="px-3 py-3">{row.niveau2?.niveau_priorite}</td>
      </tr>)}</tbody></table></div>}
    </section>
    </div>}
  </div>;
}

function PrintMeta({ campagne, drena }: { campagne?: Campagne; drena: string }) {
  return <div className="niveau-results-print-meta">
    <span>Campagne : <strong>{campagne ? `${campagne.nom} — ${campagne.annee_scolaire}` : '—'}</strong></span>
    <span>DRENA : <strong>{drena}</strong></span>
    <span>Imprimé le : <strong>{new Date().toLocaleDateString('fr-FR')}</strong></span>
  </div>;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p></div>;
}

function ProgressBadge({ value, dark = false }: { value: number; dark?: boolean }) {
  const tone = value >= 80 ? 'bg-emerald-100 text-emerald-800' : value >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 text-[10px] font-extrabold ${dark ? 'bg-white/15 text-white' : tone}`}>{value} %</span>;
}

function formatUpdateDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
