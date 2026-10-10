import React from 'react';
import { Investor, OutreachStatus } from '../types';
import { ChevronRight, ChevronLeft, Mail, ExternalLink, Calendar } from 'lucide-react';

interface TwentyKanbanProps {
  investors: Investor[];
  onOpenInvestorDetail: (inv: Investor) => void;
  onUpdateStatus: (id: string, newStatus: OutreachStatus) => void;
}

interface ColumnDef {
  key: OutreachStatus;
  label: string;
  badgeColor: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'discovered', label: 'Discovered', badgeColor: 'bg-zinc-800 text-zinc-300' },
  { key: 'researched', label: 'Researched', badgeColor: 'bg-cyan-950 text-cyan-400 border border-cyan-800/60' },
  { key: 'hot', label: '🔥 Hot (80%+)', badgeColor: 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' },
  { key: 'warm', label: '⚡ Warm (60-79%)', badgeColor: 'bg-amber-950 text-amber-400 border border-amber-800/60' },
  { key: 'contacted', label: 'Contacted', badgeColor: 'bg-purple-950 text-purple-400 border border-purple-800/60' },
  { key: 'replied', label: 'Replied', badgeColor: 'bg-blue-950 text-blue-400 border border-blue-800/60' },
  { key: 'meeting', label: 'Meeting Booked', badgeColor: 'bg-emerald-900 text-emerald-200 border border-emerald-700' },
  { key: 'passed', label: 'Passed', badgeColor: 'bg-zinc-900 text-zinc-500' },
];

export const TwentyKanban: React.FC<TwentyKanbanProps> = ({
  investors,
  onOpenInvestorDetail,
  onUpdateStatus
}) => {
  const getNextStage = (current: OutreachStatus): OutreachStatus | null => {
    const order: OutreachStatus[] = ['discovered', 'researched', 'hot', 'contacted', 'replied', 'meeting'];
    const idx = order.indexOf(current);
    if (idx !== -1 && idx < order.length - 1) return order[idx + 1];
    if (current === 'warm') return 'contacted';
    return null;
  };

  const getPrevStage = (current: OutreachStatus): OutreachStatus | null => {
    const order: OutreachStatus[] = ['discovered', 'researched', 'hot', 'contacted', 'replied', 'meeting'];
    const idx = order.indexOf(current);
    if (idx > 0) return order[idx - 1];
    return null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar min-h-[540px]">
      {COLUMNS.map(col => {
        const colInvestors = investors.filter(inv => inv.outreach.status === col.key);

        return (
          <div
            key={col.key}
            className="w-72 shrink-0 bg-zinc-950/70 border border-zinc-800 rounded-lg flex flex-col max-h-[750px]"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/40">
              <span className="font-semibold text-xs text-white tracking-tight flex items-center gap-1.5">
                <span>{col.label}</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${col.badgeColor}`}>
                {colInvestors.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="p-2 space-y-2 overflow-y-auto flex-1 text-xs">
              {colInvestors.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-zinc-600 text-[11px] italic">
                  No records
                </div>
              ) : (
                colInvestors.map(inv => {
                  const next = getNextStage(inv.outreach.status);
                  const prev = getPrevStage(inv.outreach.status);

                  return (
                    <div
                      key={inv.id}
                      onClick={() => onOpenInvestorDetail(inv)}
                      className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-md p-3 transition-colors cursor-pointer group shadow-sm flex flex-col justify-between space-y-2.5"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors text-xs leading-snug">
                            {inv.name}
                          </h4>
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${
                            inv.fitScore.status === 'hot' ? 'text-emerald-400' :
                            inv.fitScore.status === 'warm' ? 'text-amber-400' : 'text-zinc-500'
                          }`}>
                            {inv.fitScore.total}%
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {inv.firm}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-2 font-mono">
                          <span>{inv.stage}</span>
                          <span>·</span>
                          <span className="text-emerald-400 font-semibold">{inv.checkSizeFormatted}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {inv.portfolio.slice(0, 2).map((p, idx) => (
                            <span key={idx} className="text-[9px] px-1 py-0.2 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Bottom Controls */}
                      <div 
                        className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px]"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="text-zinc-500 text-[10px] truncate max-w-[120px]">
                          {inv.outreach.nextFollowUpDate ? `Due: ${inv.outreach.nextFollowUpDate}` : inv.location}
                        </span>

                        <div className="flex items-center gap-1">
                          {prev && (
                            <button
                              onClick={() => onUpdateStatus(inv.id, prev)}
                              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title={`Move back to ${prev}`}
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                          )}
                          {next && (
                            <button
                              onClick={() => onUpdateStatus(inv.id, next)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 font-medium text-[10px] transition-colors cursor-pointer"
                              title={`Advance to ${next}`}
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
