import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Terminal, Brain, Search, Cpu, Mail, Database, Square, Sparkles } from 'lucide-react';
import { Investor, StartupProfile, AppSettings, AgentJob, PipelineExecutionLog } from '../types';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  startup: StartupProfile;
  settings: AppSettings;
  existingInvestors: Investor[];
  onAddOrUpdateInvestor: (investor: Investor) => void;
  onStartupIntel: (intel: Partial<StartupProfile>) => void;
  onCompletePipeline?: (newCount: number) => void;
}

const PHASES: { id: PipelineExecutionLog['phase'][]; label: string; icon: React.ReactNode; color: string }[] = [
  { id: ['product'], label: '1. Understand app', icon: <Brain className="w-3.5 h-3.5 mx-auto mb-1" />, color: 'pink' },
  { id: ['search', 'extract'], label: '2. Search web + LinkedIn', icon: <Search className="w-3.5 h-3.5 mx-auto mb-1" />, color: 'cyan' },
  { id: ['research'], label: '3. Research', icon: <Terminal className="w-3.5 h-3.5 mx-auto mb-1" />, color: 'indigo' },
  { id: ['score'], label: '4. Score fit', icon: <Cpu className="w-3.5 h-3.5 mx-auto mb-1" />, color: 'amber' },
  { id: ['outreach', 'crm'], label: '5. Outreach + CRM', icon: <Mail className="w-3.5 h-3.5 mx-auto mb-1" />, color: 'purple' }
];

const phaseClass: Record<string, string> = {
  product: 'bg-pink-950 text-pink-400',
  search: 'bg-cyan-950 text-cyan-400',
  extract: 'bg-cyan-950 text-cyan-300',
  research: 'bg-indigo-950 text-indigo-400',
  score: 'bg-amber-950 text-amber-400',
  outreach: 'bg-purple-950 text-purple-400',
  crm: 'bg-emerald-950 text-emerald-400',
  system: 'bg-zinc-800 text-zinc-300'
};

export const AutonomousRunnerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  startup,
  settings,
  existingInvestors,
  onAddOrUpdateInvestor,
  onStartupIntel,
  onCompletePipeline
}) => {
  const [job, setJob] = useState<AgentJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [refreshProduct, setRefreshProduct] = useState(false);
  const [leads, setLeads] = useState(settings.leadsPerRun);
  const added = useRef<Set<string>>(new Set());
  const intelApplied = useRef<string>('');
  const finishedReported = useRef<string>('');
  const logRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onAddOrUpdateInvestor, onStartupIntel, onCompletePipeline });
  callbacks.current = { onAddOrUpdateInvestor, onStartupIntel, onCompletePipeline };

  useEffect(() => setLeads(settings.leadsPerRun), [settings.leadsPerRun]);

  // on open: re-attach to a running job (e.g. after a page refresh)
  useEffect(() => {
    if (!isOpen || job) return;
    api
      .latestJob()
      .then(r => {
        // merging is idempotent (same name+firm replaces), so re-adding is safe
        if (r.job && r.job.status === 'running') setJob(r.job);
      })
      .catch(() => {});
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // poll while running
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const t = window.setInterval(async () => {
      try {
        const { job: j } = await api.getJob(job.id);
        setJob(j);
      } catch (e: any) {
        setError(e?.message || 'Lost connection to the job');
        setJob(prev => (prev ? { ...prev, status: 'error' } : prev));
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [job?.id, job?.status]);

  // merge results into the CRM as they arrive
  useEffect(() => {
    if (!job) return;
    if (job.startupUpdate && intelApplied.current !== job.id) {
      intelApplied.current = job.id;
      callbacks.current.onStartupIntel(job.startupUpdate);
    }
    for (const inv of job.investors) {
      if (!added.current.has(inv.id)) {
        added.current.add(inv.id);
        callbacks.current.onAddOrUpdateInvestor(inv);
      }
    }
    if (job.status !== 'running' && finishedReported.current !== job.id) {
      finishedReported.current = job.id;
      if (job.status === 'done') callbacks.current.onCompletePipeline?.(job.investors.length);
    }
  }, [job]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job?.logs.length]);

  if (!isOpen) return null;

  const running = job?.status === 'running';
  const lastPhase = job?.logs.length ? job.logs[job.logs.length - 1].phase : null;

  const start = async () => {
    setError('');
    setStarting(true);
    try {
      const { jobId } = await api.runAgent(startup, { ...settings, leadsPerRun: leads }, existingInvestors, refreshProduct);
      const { job: j } = await api.getJob(jobId);
      setJob(j);
    } catch (e: any) {
      setError(e?.message || 'Could not start the agent');
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (job) await api.cancelJob(job.id).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-3xl w-full p-5 sm:p-6 text-zinc-200 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Run the investor agent for {startup.name}</h2>
              <p className="text-xs text-zinc-400">Understand app → search web & LinkedIn → research → score → write outreach → save to CRM</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-900 cursor-pointer" title="Close (the agent keeps running on the server)">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-end">
          <div>
            <label className="block text-zinc-400 mb-1">Investors to research this run</label>
            <input
              type="number"
              min={1}
              max={30}
              value={leads}
              disabled={running}
              onChange={e => setLeads(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <label className="flex items-center gap-2 text-zinc-300 cursor-pointer select-none sm:pb-2">
            <input type="checkbox" checked={refreshProduct} disabled={running} onChange={e => setRefreshProduct(e.target.checked)} />
            Re-analyse the app first
          </label>
          {running ? (
            <button onClick={stop} className="px-4 py-2 font-semibold text-red-200 bg-red-900/70 hover:bg-red-800 rounded flex items-center justify-center gap-1.5 cursor-pointer">
              <Square className="w-3.5 h-3.5 fill-current" /> Stop
            </button>
          ) : (
            <button
              onClick={start}
              disabled={starting}
              className="px-4 py-2 font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {job ? 'Run again' : 'Start agent'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5 my-4 text-center">
          {PHASES.map(p => {
            const active = running && lastPhase && p.id.includes(lastPhase);
            return (
              <div
                key={p.label}
                className={`p-2 rounded border text-[10px] sm:text-[11px] font-mono transition-colors ${
                  active ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
                }`}
              >
                {p.icon}
                <span>{p.label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Live agent log
          </span>
          <span className="font-mono text-[11px]">
            {job ? `${job.progress}% · ${job.investors.length} saved · ${job.status}` : 'idle'}
          </span>
        </div>
        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden mb-2">
          <div className="bg-emerald-400 h-1.5 transition-all duration-500" style={{ width: `${job?.progress || 0}%` }} />
        </div>

        <div ref={logRef} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] h-72 overflow-y-auto space-y-1.5">
          {!job ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-6">
              <Play className="w-6 h-6 mb-2 opacity-40" />
              <p>Click "Start agent". A run of 10 investors usually takes 3-8 minutes on free AI tiers. You can close this window — it keeps running on the server.</p>
            </div>
          ) : (
            job.logs.map(log => (
              <div key={log.id} className="flex items-start gap-2 leading-tight">
                <span className="text-zinc-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`px-1 rounded text-[10px] uppercase font-bold shrink-0 ${phaseClass[log.phase] || phaseClass.system}`}>{log.phase}</span>
                {log.investorName && <span className="text-zinc-300 font-semibold shrink-0">[{log.investorName}]</span>}
                <span
                  className={
                    log.level === 'success' ? 'text-emerald-300' : log.level === 'warn' ? 'text-amber-300' : log.level === 'error' ? 'text-red-400' : 'text-zinc-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>

        {error && <div className="mt-3 p-2 rounded bg-red-950/50 border border-red-900 text-red-200 text-xs">{error}</div>}

        <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800 text-xs">
          <span className="text-zinc-500 flex items-center gap-1">
            <Database className="w-3.5 h-3.5" /> New investors are saved to your CRM as soon as each one is finished.
          </span>
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer">
            {job?.status === 'done' ? 'View CRM' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
