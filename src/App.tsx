import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header, TabId } from './components/Header';
import { ArchitectureModal } from './components/ArchitectureModal';
import { AutonomousRunnerModal } from './components/AutonomousRunnerModal';
import { SettingsModal } from './components/SettingsModal';
import { InvestorDetailModal } from './components/InvestorDetailModal';
import { ProductBrainTab } from './components/ProductBrainTab';
import { DiscoveryTab } from './components/DiscoveryTab';
import { TwentyCrmTab } from './components/TwentyCrmTab';
import { AiScoringTab } from './components/AiScoringTab';
import { MauticCampaignsTab } from './components/MauticCampaignsTab';
import { Investor, StartupProfile, AppSettings, OutreachStatus, HealthInfo } from './types';
import {
  loadStoredInvestors,
  saveStoredInvestors,
  loadStoredStartup,
  saveStoredStartup,
  loadStoredSettings,
  saveStoredSettings
} from './services/crmStorage';
import { api, setPassword, getPassword } from './services/api';
import { DEFAULT_STARTUP, DEFAULT_SETTINGS } from './data/defaultStartup';
import { CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

const sameInvestor = (a: Investor, b: Investor) =>
  a.id === b.id ||
  (a.name.toLowerCase() === b.name.toLowerCase() && a.firm.toLowerCase() === b.firm.toLowerCase()) ||
  (!!a.linkedin && a.linkedin === b.linkedin);

export default function App() {
  const [investors, setInvestors] = useState<Investor[]>(loadStoredInvestors);
  const [startup, setStartup] = useState<StartupProfile>(loadStoredStartup);
  const [settings, setSettings] = useState<AppSettings>(loadStoredSettings);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState(getPassword());
  const [loaded, setLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('brain');
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [isRunnerModalOpen, setIsRunnerModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), error ? 7000 : 3500);
  }, []);

  // ---------- initial load: health + server copy of the CRM
  const loadFromServer = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setServerReachable(true);
      const state = await api.loadState();
      setNeedsPassword(false);
      if (state.investors?.length) {
        setInvestors(state.investors);
      } else if (loadStoredInvestors().length) {
        // first deploy: push the browser copy up to the server
        await api.saveState({ investors: loadStoredInvestors() });
      }
      if (state.startup) setStartup({ ...DEFAULT_STARTUP, ...state.startup });
      if (state.settings) setSettings({ ...DEFAULT_SETTINGS, ...state.settings });
    } catch (e: any) {
      if (e?.status === 401) setNeedsPassword(true);
      else setServerReachable(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadFromServer();
    const onAuth = () => setNeedsPassword(true);
    window.addEventListener('safecart-auth-required', onAuth);
    return () => window.removeEventListener('safecart-auth-required', onAuth);
  }, [loadFromServer]);

  // ---------- persist (browser cache immediately, server debounced)
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!loaded) return;
    saveStoredInvestors(investors);
    saveStoredStartup(startup);
    saveStoredSettings(settings);
    if (needsPassword || serverReachable === false) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveState({ investors, startup, settings }).catch(() => {
        /* offline: browser copy is kept */
      });
    }, 800);
  }, [investors, startup, settings, loaded, needsPassword, serverReachable]);

  // ---------- CRM mutations
  const handleUpdateInvestor = (updated: Investor, quiet = false) => {
    setInvestors(prev => prev.map(i => (i.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : i)));
    if (!quiet) showToast(`Updated ${updated.name}`);
  };

  const handleAddInvestor = (newInv: Investor, quiet = false) => {
    setInvestors(prev => {
      const existing = prev.find(i => sameInvestor(i, newInv));
      if (existing) return prev.map(i => (i === existing ? { ...newInv, id: existing.id, outreach: { ...newInv.outreach, ...pickProgress(existing) } } : i));
      return [newInv, ...prev];
    });
    if (!quiet) showToast(`Added ${newInv.name}${newInv.firm && !/independent/i.test(newInv.firm) ? ` (${newInv.firm})` : ''} to CRM`);
  };

  const patchOutreach = (id: string, patch: Partial<Investor['outreach']>) =>
    setInvestors(prev => prev.map(inv => (inv.id === id ? { ...inv, outreach: { ...inv.outreach, ...patch }, updatedAt: new Date().toISOString() } : inv)));

  const handleUpdateStatus = (id: string, status: OutreachStatus) => patchOutreach(id, { status });
  const handleUpdateFollowUp = (id: string, nextFollowUpDate: string) => patchOutreach(id, { nextFollowUpDate });

  const handleDeleteInvestor = (id: string) => {
    if (!confirm('Remove this investor from your CRM?')) return;
    setInvestors(prev => prev.filter(inv => inv.id !== id));
    showToast('Investor removed');
  };

  const handleClearCrm = () => {
    if (!confirm('Delete ALL investors from the CRM? This cannot be undone (export a CSV first if you want a backup).')) return;
    setInvestors([]);
    showToast('CRM cleared');
  };

  const handleSaveStartup = (updated: StartupProfile, msg?: string) => {
    setStartup(updated);
    if (msg !== '') showToast(msg || `Saved ${updated.name} profile`);
  };

  const handleSaveSettings = (updated: AppSettings) => {
    setSettings(updated);
    showToast('Settings saved');
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassword(passwordInput);
    setLoaded(false);
    await loadFromServer();
  };

  const hotLeadsCount = investors.filter(i => i.fitScore.status === 'hot').length;
  const today = new Date().toISOString().slice(0, 10);
  const dueCount = investors.filter(
    i => i.outreach.nextFollowUpDate && i.outreach.nextFollowUpDate <= today && !['replied', 'meeting', 'diligence', 'passed'].includes(i.outreach.status)
  ).length;
  const selectedDetailInvestor = investors.find(i => i.id === selectedDetailId) || null;
  const openDetail = (inv: Investor) => setSelectedDetailId(inv.id);

  const common = { startup, settings, investors, onOpenInvestorDetail: openDetail, showToast };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {toast && (
        <div
          className={`fixed bottom-4 right-4 left-4 sm:left-auto z-[60] max-w-md border px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-start gap-2 ${
            toast.error ? 'bg-red-950 border-red-800 text-red-100' : 'bg-zinc-900 border-zinc-700 text-white'
          }`}
        >
          {toast.error ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span className="break-words">{toast.msg}</span>
        </div>
      )}

      {needsPassword && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4">
          <form onSubmit={submitPassword} className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Lock className="w-4 h-4 text-emerald-400" /> Enter app password
            </div>
            <p className="text-xs text-zinc-400">This is the APP_PASSWORD you set in Railway → Variables.</p>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button className="w-full py-2 rounded bg-emerald-400 hover:bg-emerald-300 text-emerald-950 text-sm font-semibold">Unlock</button>
          </form>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        startup={startup}
        health={health}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenRunnerModal={() => setIsRunnerModalOpen(true)}
        totalInvestorsCount={investors.length}
        hotLeadsCount={hotLeadsCount}
        dueCount={dueCount}
      />

      {serverReachable === false && (
        <div className="bg-amber-950/60 border-b border-amber-800 text-amber-200 text-xs px-4 py-2 text-center">
          Can't reach the agent server. You're seeing the copy saved in this browser. (On Railway this means the service is restarting or crashed — check its Deploy Logs.)
        </div>
      )}
      {health && !health.ai.configured && (
        <div className="bg-red-950/60 border-b border-red-800 text-red-200 text-xs px-4 py-2 text-center">
          No AI key set yet. In Railway → your service → Variables, add <b>GEMINI_API_KEY</b> (free, no card: aistudio.google.com/apikey) and redeploy.
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'brain' && (
          <ProductBrainTab {...common} onSaveStartup={handleSaveStartup} onOpenRunnerModal={() => setIsRunnerModalOpen(true)} goTo={setActiveTab} />
        )}
        {activeTab === 'discovery' && (
          <DiscoveryTab {...common} onAddInvestor={handleAddInvestor} onOpenRunnerModal={() => setIsRunnerModalOpen(true)} />
        )}
        {activeTab === 'scoring' && <AiScoringTab {...common} onUpdateInvestor={handleUpdateInvestor} />}
        {activeTab === 'crm' && (
          <TwentyCrmTab
            investors={investors}
            startup={startup}
            onOpenInvestorDetail={openDetail}
            onUpdateStatus={handleUpdateStatus}
            onUpdateFollowUp={handleUpdateFollowUp}
            onDeleteInvestor={handleDeleteInvestor}
            onAddInvestor={inv => handleAddInvestor(inv)}
            onClearCrm={handleClearCrm}
          />
        )}
        {activeTab === 'outreach' && <MauticCampaignsTab {...common} health={health} onUpdateInvestor={handleUpdateInvestor} />}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${health?.ai.configured ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
            <span>
              AI: {health?.ai.providers.join(' → ') || '—'} · Search: {health?.search.providers.join(' → ') || '—'}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500">{startup.name} Investor Agent · free-tier stack · no credit card</div>
        </div>
      </footer>

      <ArchitectureModal isOpen={isArchitectureModalOpen} onClose={() => setIsArchitectureModalOpen(false)} />

      <AutonomousRunnerModal
        isOpen={isRunnerModalOpen}
        onClose={() => setIsRunnerModalOpen(false)}
        startup={startup}
        settings={settings}
        existingInvestors={investors}
        onAddOrUpdateInvestor={inv => handleAddInvestor(inv, true)}
        onStartupIntel={intel => handleSaveStartup({ ...startup, ...intel }, '')}
        onCompletePipeline={count => {
          showToast(`Agent finished: ${count} investors added to your CRM`);
          setActiveTab('crm');
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        health={health}
        onSaveSettings={handleSaveSettings}
        onClearCrm={handleClearCrm}
        onRefreshHealth={loadFromServer}
      />

      <InvestorDetailModal
        key={selectedDetailInvestor?.id || 'none'}
        isOpen={!!selectedDetailInvestor}
        onClose={() => setSelectedDetailId(null)}
        investor={selectedDetailInvestor}
        startup={startup}
        settings={settings}
        onUpdateInvestor={handleUpdateInvestor}
        showToast={showToast}
      />
    </div>
  );
}

function pickProgress(i: Investor): Partial<Investor['outreach']> {
  const o = i.outreach;
  const contacted = ['contacted', 'replied', 'meeting', 'diligence', 'passed'].includes(o.status);
  return contacted
    ? { status: o.status, sentStepsCount: o.sentStepsCount, lastContactedDate: o.lastContactedDate, nextFollowUpDate: o.nextFollowUpDate, responseNotes: o.responseNotes, replyDate: o.replyDate }
    : {};
}
