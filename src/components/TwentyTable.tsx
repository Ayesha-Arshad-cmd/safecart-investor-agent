import React from 'react';
import { 
  ExternalLink, 
  Mail, 
  Linkedin, 
  ChevronRight, 
  Send, 
  Sparkles,
  Calendar,
  MoreHorizontal,
  Trash2,
  Eye
} from 'lucide-react';
import { Investor, OutreachStatus } from '../types';

interface TwentyTableProps {
  investors: Investor[];
  onOpenInvestorDetail: (inv: Investor) => void;
  onUpdateStatus: (id: string, newStatus: OutreachStatus) => void;
  onUpdateFollowUp: (id: string, newDate: string) => void;
  onDeleteInvestor: (id: string) => void;
}

export const TwentyTable: React.FC<TwentyTableProps> = ({
  investors,
  onOpenInvestorDetail,
  onUpdateStatus,
  onUpdateFollowUp,
  onDeleteInvestor
}) => {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-3.5 font-medium">Investor & Firm</th>
              <th className="py-3 px-3 font-medium">Stage & Check</th>
              <th className="py-3 px-3 font-medium">Fit Score</th>
              <th className="py-3 px-3 font-medium">Portfolio Synergy</th>
              <th className="py-3 px-3 font-medium">Outreach Status</th>
              <th className="py-3 px-3 font-medium">Next Follow-up</th>
              <th className="py-3 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {investors.map(inv => (
              <tr 
                key={inv.id}
                className="hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                onClick={() => onOpenInvestorDetail(inv)}
              >
                
                {/* Investor & Firm */}
                <td className="py-3 px-3.5">
                  <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    {inv.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                    <span>{inv.firm}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{inv.location}</span>
                  </div>
                </td>

                {/* Stage & Check */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="text-zinc-300">{inv.stage}</div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                    {inv.checkSizeFormatted}
                  </div>
                </td>

                {/* Fit Score */}
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-bold text-xs ${
                      inv.fitScore.status === 'hot' 
                        ? 'text-emerald-400' 
                        : inv.fitScore.status === 'warm' 
                        ? 'text-amber-400' 
                        : 'text-zinc-400'
                    }`}>
                      {inv.fitScore.status === 'hot' ? '🔥' : inv.fitScore.status === 'warm' ? '⚡' : '❄️'} {inv.fitScore.total}%
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate max-w-[130px]" title={inv.fitScore.verdict}>
                    {inv.fitScore.status.toUpperCase()} LEAD
                  </div>
                </td>

                {/* Portfolio */}
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {inv.portfolio.slice(0, 3).map((p, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-300 border border-zinc-800">
                        {p}
                      </span>
                    ))}
                    {inv.portfolio.length > 3 && (
                      <span className="text-[10px] text-zinc-500">+{inv.portfolio.length - 3}</span>
                    )}
                  </div>
                </td>

                {/* Outreach Status Selector */}
                <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={inv.outreach.status}
                    onChange={e => onUpdateStatus(inv.id, e.target.value as OutreachStatus)}
                    className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="discovered">Discovered</option>
                    <option value="researched">Researched</option>
                    <option value="hot">🔥 Hot Lead</option>
                    <option value="warm">⚡ Warm Lead</option>
                    <option value="contacted">Contacted</option>
                    <option value="replied">Replied</option>
                    <option value="meeting">Meeting Booked</option>
                    <option value="diligence">Diligence</option>
                    <option value="passed">Passed</option>
                  </select>
                </td>

                {/* Follow-up Date */}
                <td className="py-3 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <input
                    type="date"
                    value={inv.outreach.nextFollowUpDate || ''}
                    onChange={e => onUpdateFollowUp(inv.id, e.target.value)}
                    className="bg-transparent border border-transparent hover:border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-300 focus:bg-zinc-900 focus:border-zinc-700 focus:outline-none"
                  />
                </td>

                {/* Actions */}
                <td className="py-3 px-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onOpenInvestorDetail(inv)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                      title="Open full investor dossier"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {inv.linkedin && (
                      <a
                        href={inv.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 rounded transition-colors text-[10px] font-bold"
                        title="Open public LinkedIn profile"
                      >
                        in
                      </a>
                    )}
                    {inv.email && <a
                      href={`mailto:${inv.email}?subject=${encodeURIComponent(inv.outreach.sequences[0]?.subject || '')}&body=${encodeURIComponent(inv.outreach.sequences[0]?.body || '')}`}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded transition-colors"
                      title="Send email via default client"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>}

                    <button
                      onClick={() => onDeleteInvestor(inv.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                      title="Delete investor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
