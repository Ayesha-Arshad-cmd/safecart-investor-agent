import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  ExternalLink, 
  RotateCw, 
  Copy, 
  Send,
  Zap,
  Building2,
  AlertTriangle
} from 'lucide-react';
import { Investor, StartupProfile, AppSettings } from '../types';
import { api } from '../services/api';

interface AiScoringTabProps {
  investors: Investor[];
  startup: StartupProfile;
  settings: AppSettings;
  onUpdateInvestor: (updated: Investor) => void;
  onOpenInvestorDetail: (inv: Investor) => void;
  showToast: (msg: string, error?: boolean) => void;
}

export const AiScoringTab: React.FC<AiScoringTabProps> = ({
  investors,
  startup,
  settings,
  onUpdateInvestor,
  onOpenInvestorDetail,
  showToast
}) => {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investors[0]?.id || '');
  const [isScoring, setIsScoring] = useState(false);
  const [copiedAngle, setCopiedAngle] = useState(false);

  const selectedInvestor = investors.find(i => i.id === selectedInvestorId) || investors[0];

  const handleRunEvaluation = async () => {
    if (!selectedInvestor) return;
    setIsScoring(true);
    try {
      const result = await api.score(startup, selectedInvestor);
      const status = selectedInvestor.outreach.status;
      const autoStatus = ['discovered', 'researched', 'hot', 'warm'].includes(status);
      const updated: Investor = {
        ...selectedInvestor,
        fitScore: result.fitScore,
        researchNotes: result.researchNotes,
        outreach: {
          ...selectedInvestor.outreach,
          status: autoStatus ? (result.fitScore.status === 'cold' ? 'researched' : result.fitScore.status) : status
        },
        updatedAt: new Date().toISOString()
      };
      if (!updated.outreach.sequences?.length) {
        const o = await api.outreach(startup, updated, settings);
        updated.outreach = { ...updated.outreach, sequences: o.sequences, sequenceGenerated: true };
        updated.linkedinNote = o.linkedinNote;
        updated.linkedinMessage = o.linkedinMessage;
      }
      onUpdateInvestor(updated);
    } catch (e: any) {
      showToast(e?.message || 'Scoring failed', true);
    } finally {
      setIsScoring(false);
    }
  };

  const handleCopyTalkingPoint = () => {
    if (!selectedInvestor) return;
    navigator.clipboard.writeText(selectedInvestor.fitScore.keyTalkingPoint);
    setCopiedAngle(true);
    setTimeout(() => setCopiedAngle(false), 2000);
  };

  if (!selectedInvestor) {
    return (
      <div className="p-8 text-center text-zinc-500">
        No investors in the CRM yet. Click "Run Agent" at the top, or use the Find Investors tab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-400 border border-amber-800">
              PHASE 4
            </span>
            <h2 className="text-base font-semibold text-white tracking-tight">
              AI fit scoring for {startup.name}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            The AI compares each investor's real thesis, stage, check size and portfolio against {startup.name}, flags concerns,
            and picks the best angle for your first message.
          </p>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isScoring}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isScoring ? 'animate-spin' : ''}`} />
          <span>{isScoring ? 'AI scoring…' : 'Re-score selected'}</span>
        </button>
      </div>

      {/* Main Layout: Investor Selector on Left, Deep Dive on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column: Investor List */}
        <div className="space-y-2 bg-zinc-950 border border-zinc-800 rounded-xl p-3 max-h-[700px] overflow-y-auto">
          <div className="text-[11px] font-semibold text-zinc-400 px-2 uppercase tracking-wider mb-2">
            CRM Leads ({investors.length})
          </div>

          {[...investors].sort((a, b) => b.fitScore.total - a.fitScore.total).map(inv => (
            <div
              key={inv.id}
              onClick={() => setSelectedInvestorId(inv.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                selectedInvestorId === inv.id
                  ? 'bg-zinc-900 border-amber-500/80 text-white shadow-sm'
                  : 'bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold">{inv.name}</span>
                <span className={`text-[10px] font-mono font-bold ${
                  inv.fitScore.status === 'hot' ? 'text-emerald-400' :
                  inv.fitScore.status === 'warm' ? 'text-amber-400' : 'text-zinc-500'
                }`}>
                  {inv.fitScore.total}%
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                {inv.firm} · {inv.location}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-1">
                {inv.checkSizeFormatted}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Deep Dossier */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Target Investor Hero Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">{selectedInvestor.name}</h3>
                  <span className="text-xs text-zinc-400">({selectedInvestor.title}, {selectedInvestor.firm})</span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Investment Stage: <strong className="text-zinc-200">{selectedInvestor.stage}</strong> · Check Size: <strong className="text-emerald-400 font-mono">{selectedInvestor.checkSizeFormatted}</strong>
                </div>
              </div>

              {/* Total Score Display */}
              <div className="flex items-center gap-2 shrink-0 bg-zinc-950 px-3.5 py-2 rounded-lg border border-zinc-800">
                <span className="text-xl">
                  {selectedInvestor.fitScore.status === 'hot' ? '🔥' : selectedInvestor.fitScore.status === 'warm' ? '⚡' : '❄️'}
                </span>
                <div>
                  <div className="text-xs font-semibold text-zinc-400">FIT SCORE</div>
                  <div className="text-xl font-bold font-mono text-white leading-none">
                    {selectedInvestor.fitScore.total}%
                  </div>
                </div>
              </div>
            </div>

            {/* Radar / Subscore meters */}
            <div>
              <div className="text-xs font-semibold text-zinc-300 mb-2">Detailed Match Breakdown</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                
                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">THESIS</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">{selectedInvestor.fitScore.thesisMatch}%</div>
                  <div className="w-full bg-zinc-800 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div className="bg-cyan-400 h-1" style={{ width: `${selectedInvestor.fitScore.thesisMatch}%` }} />
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">STAGE</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">{selectedInvestor.fitScore.stageMatch}%</div>
                  <div className="w-full bg-zinc-800 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div className="bg-emerald-400 h-1" style={{ width: `${selectedInvestor.fitScore.stageMatch}%` }} />
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">SECTOR</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">{selectedInvestor.fitScore.sectorMatch}%</div>
                  <div className="w-full bg-zinc-800 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div className="bg-amber-400 h-1" style={{ width: `${selectedInvestor.fitScore.sectorMatch}%` }} />
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">SYNERGY</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">{selectedInvestor.fitScore.synergyMatch}%</div>
                  <div className="w-full bg-zinc-800 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div className="bg-purple-400 h-1" style={{ width: `${selectedInvestor.fitScore.synergyMatch}%` }} />
                  </div>
                </div>

              </div>
            </div>

            {/* Verdict */}
            <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 text-xs italic text-zinc-300">
              "{selectedInvestor.fitScore.verdict}"
            </div>

            {/* Why They'll Invest vs Hesitations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-2">
                  <Check className="w-3.5 h-3.5" /> High-Conviction Triggers
                </span>
                <ul className="space-y-1.5 text-zinc-300 text-[11px]">
                  {selectedInvestor.fitScore.whyInvest.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold shrink-0">·</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
                <span className="font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Potential Hesitations / Red Flags
                </span>
                <ul className="space-y-1.5 text-zinc-300 text-[11px]">
                  {selectedInvestor.fitScore.hesitations.map((h, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold shrink-0">·</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Psychological Angle */}
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Recommended Angle of Approach
                </span>
                <button
                  onClick={handleCopyTalkingPoint}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedAngle ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAngle ? 'Copied!' : 'Copy Angle'}</span>
                </button>
              </div>
              <div className="text-xs text-white font-medium">
                {selectedInvestor.fitScore.keyTalkingPoint}
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800 text-xs">
              <button
                onClick={() => onOpenInvestorDetail(selectedInvestor)}
                className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium transition-colors cursor-pointer"
              >
                Open full dossier
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
