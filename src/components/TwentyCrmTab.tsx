import React, { useState, useMemo } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Kanban, 
  Table as TableIcon, 
  Sparkles, 
  FileSpreadsheet, 
  FileCode, 
  Mail,
  RotateCcw
} from 'lucide-react';
import { Investor, OutreachStatus, StartupProfile } from '../types';
import { TwentyTable } from './TwentyTable';
import { TwentyKanban } from './TwentyKanban';
import { exportInvestorsToCsv, exportToTwentyCrmJson, exportToMauticCsv } from '../services/crmStorage';

interface TwentyCrmTabProps {
  investors: Investor[];
  startup: StartupProfile;
  onOpenInvestorDetail: (inv: Investor) => void;
  onUpdateStatus: (id: string, newStatus: OutreachStatus) => void;
  onUpdateFollowUp: (id: string, newDate: string) => void;
  onDeleteInvestor: (id: string) => void;
  onAddInvestor: (newInv: Investor) => void;
  onClearCrm: () => void;
}

export const TwentyCrmTab: React.FC<TwentyCrmTabProps> = ({
  investors,
  startup,
  onOpenInvestorDetail,
  onUpdateStatus,
  onUpdateFollowUp,
  onDeleteInvestor,
  onAddInvestor,
  onClearCrm
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Lead Form State
  const [newName, setNewName] = useState('');
  const [newFirm, setNewFirm] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newStage, setNewStage] = useState('Pre-seed');
  const [newCheck, setNewCheck] = useState('');
  const [newLinkedin, setNewLinkedin] = useState('');

  // Filtered Investors
  const filteredInvestors = useMemo(() => {
    return investors.filter(inv => {
      const q = searchFilter.toLowerCase();
      const matchesSearch = 
        !q ||
        inv.name.toLowerCase().includes(q) ||
        inv.firm.toLowerCase().includes(q) ||
        inv.location.toLowerCase().includes(q) ||
        inv.portfolio.some(p => p.toLowerCase().includes(q)) ||
        inv.industries.some(i => i.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || inv.outreach.status === statusFilter;
      const matchesStage = stageFilter === 'all' || inv.stage === stageFilter;

      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [investors, searchFilter, statusFilter, stageFilter]);

  // Metric counts
  const hotCount = investors.filter(i => i.fitScore.status === 'hot').length;
  const contactedCount = investors.filter(i => i.outreach.status === 'contacted').length;
  const repliedCount = investors.filter(i => i.outreach.status === 'replied').length;
  const meetingCount = investors.filter(i => i.outreach.status === 'meeting').length;

  const handleDownloadCsv = () => {
    const csv = exportInvestorsToCsv(filteredInvestors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `twenty_crm_investors_${startup.name.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTwentyJson = () => {
    const json = exportToTwentyCrmJson(filteredInvestors);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `twenty_crm_records_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadMauticCsv = () => {
    const csv = exportToMauticCsv(filteredInvestors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mautic_campaign_contacts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateCustomLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newFirm) return;

    const newInv: Investor = {
      id: `inv-${Date.now()}`,
      name: newName,
      title: 'Partner',
      firm: newFirm,
      website: newWebsite,
      email: newEmail,
      linkedin: newLinkedin,
      location: '',
      stage: newStage as any,
      checkSizeFormatted: newCheck || 'Unknown',
      checkSizeMin: 0,
      checkSizeMax: 0,
      industries: [],
      portfolio: [],
      recentInvestments: [],
      thesis: '',
      contactRoute: newEmail ? 'Email' : newLinkedin ? 'LinkedIn connection' : 'Unknown',
      activePartner: newName,
      fitScore: {
        total: 0,
        thesisMatch: 0,
        stageMatch: 0,
        sectorMatch: 0,
        checkSizeMatch: 0,
        synergyMatch: 0,
        status: 'cold',
        verdict: 'Not scored yet — open the AI Scoring tab and click Re-score.',
        whyInvest: [],
        hesitations: [],
        keyTalkingPoint: ''
      },
      researchNotes: 'Manually added.',
      extractedData: {
        rawUrl: newWebsite,
        crawledAt: new Date().toISOString(),
        pageTitle: '',
        metaDescription: '',
        extractedTextExcerpt: '',
        keyQuotes: [],
        portfolioFound: [],
        detectedCheckSize: newCheck,
        detectedContactEmail: newEmail
      },
      outreach: {
        status: 'discovered',
        sequenceGenerated: false,
        sequences: [],
        sentStepsCount: 0
      },
      tags: ['Manual Entry'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onAddInvestor(newInv);
    setIsAddingNew(false);
    setNewName('');
    setNewFirm('');
    setNewEmail('');
    setNewLinkedin('');
    setNewWebsite('');
  };

  return (
    <div className="space-y-5">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-mono text-zinc-400">TOTAL INVESTORS</div>
          <div className="text-xl font-bold text-white font-mono mt-0.5">{investors.length}</div>
          <div className="text-[10px] text-zinc-500 mt-1">AI-researched dossiers</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-mono text-emerald-400">🔥 HOT LEADS (75+)</div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{hotCount}</div>
          <div className="text-[10px] text-zinc-500 mt-1">High conviction for {startup.name}</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-mono text-purple-400">CONTACTED (CADENCE)</div>
          <div className="text-xl font-bold text-purple-300 font-mono mt-0.5">{contactedCount}</div>
          <div className="text-[10px] text-zinc-500 mt-1">In active follow-up cadence</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
          <div className="text-[11px] font-mono text-cyan-400">MEETINGS BOOKED</div>
          <div className="text-xl font-bold text-cyan-300 font-mono mt-0.5">{meetingCount}</div>
          <div className="text-[10px] text-zinc-500 mt-1">{repliedCount} Total replies</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters, View Mode & Export */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        
        {/* Left: Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search investors, firms, portfolio companies, location..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-white focus:outline-none focus:border-emerald-500 text-xs"
          />
        </div>

        {/* Middle: Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="discovered">Discovered</option>
            <option value="researched">Researched</option>
            <option value="hot">🔥 Hot Leads</option>
            <option value="warm">⚡ Warm Leads</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="meeting">Meeting Booked</option>
            <option value="passed">Passed</option>
          </select>

          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Stages</option>
            <option value="Pre-seed">Pre-seed</option>
            <option value="Seed">Seed</option>
            <option value="Series A">Series A</option>
          </select>
        </div>

        {/* Right: View Toggle, Add Lead & Exports */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Table / Kanban switch */}
          <div className="flex items-center border border-zinc-800 rounded overflow-hidden bg-zinc-950">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === 'kanban' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Kanban Pipeline Board"
            >
              <Kanban className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add custom lead */}
          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>

          {/* Export Dropdown buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Download full CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleDownloadMauticCsv}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Export contacts for self-hosted Mautic import"
            >
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>Mautic</span>
            </button>

            <button
              onClick={handleDownloadTwentyJson}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Download Twenty CRM JSON format"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Twenty JSON</span>
            </button>
          </div>

        </div>

      </div>

      {/* Add New Custom Lead Drawer */}
      {isAddingNew && (
        <form onSubmit={handleCreateCustomLead} className="p-4 bg-zinc-900/80 border border-emerald-500/40 rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Add an investor you already know (then AI-score it)</span>
            <button 
              type="button" 
              onClick={() => setIsAddingNew(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
              required
            />
            <input
              type="text"
              placeholder="Firm / angel group (or Independent Angel)"
              value={newFirm}
              onChange={e => setNewFirm(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
              required
            />
            <input
              type="email"
              placeholder="Direct Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="url"
              placeholder="Website URL"
              value={newWebsite}
              onChange={e => setNewWebsite(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
            />
            <select
              value={newStage}
              onChange={e => setNewStage(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
            >
              <option value="Pre-seed">Pre-seed</option>
              <option value="Seed">Seed</option>
              <option value="Series A">Series A</option>
            </select>
            <input
              type="text"
              placeholder="Check Size (e.g. $50k - $150k)"
              value={newCheck}
              onChange={e => setNewCheck(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
            />
          </div>

          <input
            type="url"
            placeholder="LinkedIn profile URL (optional, e.g. https://www.linkedin.com/in/...)"
            value={newLinkedin}
            onChange={e => setNewLinkedin(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-semibold rounded text-xs transition-colors cursor-pointer"
            >
              Save to CRM
            </button>
          </div>
        </form>
      )}

      {/* Main View: Table or Kanban */}
      {viewMode === 'table' ? (
        <TwentyTable
          investors={filteredInvestors}
          onOpenInvestorDetail={onOpenInvestorDetail}
          onUpdateStatus={onUpdateStatus}
          onUpdateFollowUp={onUpdateFollowUp}
          onDeleteInvestor={onDeleteInvestor}
        />
      ) : (
        <TwentyKanban
          investors={filteredInvestors}
          onOpenInvestorDetail={onOpenInvestorDetail}
          onUpdateStatus={onUpdateStatus}
        />
      )}

      {/* Footer helper */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2">
        <span>Showing {filteredInvestors.length} of {investors.length} records</span>
        <button
          onClick={onClearCrm}
          className="text-zinc-500 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear all investors</span>
        </button>
      </div>

    </div>
  );
};
