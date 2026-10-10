import React from 'react';
import { Search, Database, Mail, Cpu, Settings, Play, Brain, Info } from 'lucide-react';
import { StartupProfile, HealthInfo } from '../types';

export type TabId = 'brain' | 'discovery' | 'scoring' | 'crm' | 'outreach';

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  startup: StartupProfile;
  health: HealthInfo | null;
  onOpenArchitectureModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenRunnerModal: () => void;
  totalInvestorsCount: number;
  hotLeadsCount: number;
  dueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  startup,
  health,
  onOpenArchitectureModal,
  onOpenSettingsModal,
  onOpenRunnerModal,
  totalInvestorsCount,
  hotLeadsCount,
  dueCount
}) => {
  const tab = (id: TabId, icon: React.ReactNode, label: string, badge?: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
        activeTab === id ? 'bg-zinc-800 text-white border border-zinc-700/60' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  );

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-mono font-bold text-sm">
              $0
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-tight text-sm sm:text-lg truncate">
                  {startup.name} <span className="text-zinc-500 font-normal text-xs sm:text-sm">Investor Agent</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate hidden sm:block">
                Finds investors on the web & LinkedIn → researches → scores → writes outreach → tracks follow-ups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium border ${
                health?.ai.configured ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
              title="AI providers configured on the server"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${health?.ai.configured ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              {health ? (health.ai.configured ? `AI: ${health.ai.providers[0]}` : 'AI: not set') : 'connecting…'}
            </span>
            <button
              onClick={onOpenArchitectureModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors cursor-pointer"
              title="How the agent works"
            >
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">How it works</span>
            </button>
            <button
              onClick={onOpenRunnerModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Run Agent</span>
            </button>
            <button
              onClick={onOpenSettingsModal}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-md transition-colors cursor-pointer"
              title="Settings & connection status"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-zinc-900 py-1 overflow-x-auto no-scrollbar">
          {tab('brain', <Brain className="w-3.5 h-3.5 text-pink-400" />, `1 · ${startup.name} Brain`)}
          {tab('discovery', <Search className="w-3.5 h-3.5 text-cyan-400" />, '2 · Find Investors')}
          {tab(
            'scoring',
            <Cpu className="w-3.5 h-3.5 text-amber-400" />,
            '3 · AI Scoring',
            <span className="text-[11px] px-1.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">{hotLeadsCount} hot</span>
          )}
          {tab(
            'crm',
            <Database className="w-3.5 h-3.5 text-emerald-400" />,
            '4 · CRM Pipeline',
            <span className="text-[11px] px-1.5 rounded bg-zinc-900 text-zinc-300 font-mono">{totalInvestorsCount}</span>
          )}
          {tab(
            'outreach',
            <Mail className="w-3.5 h-3.5 text-purple-400" />,
            '5 · Outreach & Follow-ups',
            dueCount > 0 ? <span className="text-[11px] px-1.5 rounded bg-purple-900 text-purple-200 font-mono">{dueCount} due</span> : undefined
          )}
        </div>
      </div>
    </header>
  );
};
