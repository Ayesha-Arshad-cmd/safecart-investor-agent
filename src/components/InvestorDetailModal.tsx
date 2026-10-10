import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Mail, 
  Linkedin, 
  Twitter, 
  MapPin, 
  DollarSign, 
  Briefcase, 
  Calendar, 
  Sparkles, 
  Check, 
  Copy, 
  FileText, 
  Globe, 
  ShieldCheck, 
  Send, 
  Save 
} from 'lucide-react';
import { Investor, OutreachStatus, StartupProfile, AppSettings } from '../types';
import { api, gmailComposeUrl } from '../services/api';

interface InvestorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  investor: Investor | null;
  startup: StartupProfile;
  settings: AppSettings;
  onUpdateInvestor: (updated: Investor) => void;
  showToast: (msg: string, error?: boolean) => void;
}

export const InvestorDetailModal: React.FC<InvestorDetailModalProps> = ({
  isOpen,
  onClose,
  investor,
  startup,
  settings,
  onUpdateInvestor,
  showToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'firecrawl' | 'sequences'>('overview');
  const [researchNotes, setResearchNotes] = useState(investor?.researchNotes || '');
  const [responseNotes, setResponseNotes] = useState(investor?.outreach.responseNotes || '');
  const [outreachStatus, setOutreachStatus] = useState<OutreachStatus>(investor?.outreach.status || 'discovered');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(investor?.outreach.nextFollowUpDate || '');
  const [email, setEmail] = useState(investor?.email || '');
  const [linkedin, setLinkedin] = useState(investor?.linkedin || '');
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [findingLi, setFindingLi] = useState(false);

  if (!isOpen || !investor) return null;

  const handleSaveNotes = () => {
    const updated: Investor = {
      ...investor,
      researchNotes,
      email: email.trim(),
      linkedin: linkedin.trim(),
      outreach: {
        ...investor.outreach,
        status: outreachStatus,
        responseNotes,
        nextFollowUpDate
      },
      updatedAt: new Date().toISOString()
    };
    onUpdateInvestor(updated);
  };

  const handleCopyEmail = (body: string, stepNumber: number) => {
    navigator.clipboard.writeText(body);
    setCopiedStep(stepNumber);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const handleRegenerateSequence = async () => {
    setIsRegenerating(true);
    try {
      const o = await api.outreach(startup, investor, settings);
      onUpdateInvestor({
        ...investor,
        linkedinNote: o.linkedinNote,
        linkedinMessage: o.linkedinMessage,
        outreach: { ...investor.outreach, sequences: o.sequences, sequenceGenerated: true },
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      showToast(e?.message || 'AI rewrite failed', true);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRescore = async () => {
    setIsRescoring(true);
    try {
      const result = await api.score(startup, investor);
      setResearchNotes(result.researchNotes);
      onUpdateInvestor({ ...investor, fitScore: result.fitScore, researchNotes: result.researchNotes, updatedAt: new Date().toISOString() });
    } catch (e: any) {
      showToast(e?.message || 'Scoring failed', true);
    } finally {
      setIsRescoring(false);
    }
  };

  const handleFindLinkedIn = async () => {
    setFindingLi(true);
    try {
      const r = await api.findLinkedIn(investor.name, investor.firm);
      if (r.linkedin) {
        setLinkedin(r.linkedin);
        onUpdateInvestor({ ...investor, linkedin: r.linkedin });
      } else showToast('No public LinkedIn profile found by search. Try the LinkedIn search link instead.', true);
    } catch (e: any) {
      showToast(e?.message || 'Search failed', true);
    } finally {
      setFindingLi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col text-zinc-200 shadow-2xl my-4">
        
        {/* Top Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-start justify-between gap-4 shrink-0 bg-zinc-900/40">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-white shrink-0">
              {investor.name.split(' ').map(n => n[0]).join('')}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">{investor.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                  {investor.title} · {investor.firm}
                </span>
                
                {/* Fit Score Pill */}
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold ${
                  investor.fitScore.status === 'hot' 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                    : investor.fitScore.status === 'warm'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}>
                  <span>{investor.fitScore.status === 'hot' ? '🔥' : investor.fitScore.status === 'warm' ? '⚡' : '❄️'}</span>
                  <span>{investor.fitScore.total}% Fit</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  {investor.location}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-zinc-500" />
                  {investor.stage}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  {investor.checkSizeFormatted}
                </span>
                <span>·</span>
                {investor.website && (
                  <a href={investor.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan-400 hover:underline">
                    <Globe className="w-3 h-3" />
                    <span>Website</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {investor.linkedin && (
                  <a
                    href={investor.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-indigo-400 hover:underline"
                  >
                    <Linkedin className="w-3 h-3" />
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center space-x-2 px-5 border-b border-zinc-800 bg-zinc-950 shrink-0 text-xs">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeSubTab === 'overview'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Dossier & AI fit
          </button>
          <button
            onClick={() => setActiveSubTab('firecrawl')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeSubTab === 'firecrawl'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sources & website data
          </button>
          <button
            onClick={() => setActiveSubTab('sequences')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeSubTab === 'sequences'
                ? 'border-purple-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Emails ({investor.outreach.sequences?.length || 0})
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* TAB 1: OVERVIEW & AI FIT */}
          {activeSubTab === 'overview' && (
            <div className="space-y-5">
              
              {/* Score Breakdown Bar */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">AI Deal Alignment Analysis for {startup.name}</span>
                  </div>
                  <button
                    onClick={handleRescore}
                    disabled={isRescoring}
                    className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer disabled:opacity-50"
                  >
                    {isRescoring ? 'AI scoring…' : 'Re-score with AI'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 font-medium">THESIS MATCH</div>
                    <div className="text-base font-bold text-white font-mono">{investor.fitScore.thesisMatch}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 font-medium">STAGE FIT</div>
                    <div className="text-base font-bold text-white font-mono">{investor.fitScore.stageMatch}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 font-medium">SECTOR FIT</div>
                    <div className="text-base font-bold text-white font-mono">{investor.fitScore.sectorMatch}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <div className="text-[10px] text-zinc-500 font-medium">CHECK SIZE</div>
                    <div className="text-base font-bold text-white font-mono">{investor.fitScore.checkSizeMatch}%</div>
                  </div>
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-zinc-500 font-medium">SYNERGY</div>
                    <div className="text-base font-bold text-emerald-400 font-mono">{investor.fitScore.synergyMatch}%</div>
                  </div>
                </div>

                <div className="mt-3 text-zinc-300 text-xs italic bg-zinc-950/50 p-2 rounded border border-zinc-800/60">
                  "{investor.fitScore.verdict}"
                </div>
              </div>

              {/* Why They'll Invest vs Hesitations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3.5">
                  <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Why They'll Back {startup.name}
                  </h4>
                  <ul className="space-y-1.5 text-zinc-300">
                    {investor.fitScore.whyInvest.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 font-bold shrink-0">·</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-3.5">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Diligence Hesitations & Red Flags
                  </h4>
                  <ul className="space-y-1.5 text-zinc-300">
                    {investor.fitScore.hesitations.map((hes, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold shrink-0">·</span>
                        <span>{hes}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Talking Point & Pitch Angle */}
              <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1">
                  Recommended Angle of Approach
                </div>
                <div className="text-xs text-white font-medium">
                  {investor.fitScore.keyTalkingPoint}
                </div>
              </div>

              {/* Portfolio & Industries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-400 block text-[11px] font-medium mb-1.5">Known Portfolio:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {investor.portfolio.map((p, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-400 block text-[11px] font-medium mb-1.5">Industries Covered:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {investor.industries.map((ind, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-[11px]">
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Twenty CRM Status & Follow-up Controls */}
              <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">CRM status & contact details</span>
                  <span className="text-[11px] text-zinc-500">Saved to your server</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-zinc-400 mb-1">Outreach Status</label>
                    <select
                      value={outreachStatus}
                      onChange={e => setOutreachStatus(e.target.value as OutreachStatus)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
                    >
                      <option value="discovered">Discovered</option>
                      <option value="researched">Researched</option>
                      <option value="hot">Hot (75+)</option>
                      <option value="warm">Warm</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="meeting">Meeting Booked</option>
                      <option value="diligence">Diligence</option>
                      <option value="passed">Passed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Direct Email</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="not found publicly"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 font-mono text-[11px]"
                      />
                      <a
                        href={gmailComposeUrl(email, investor.outreach.sequences[0]?.subject || '', investor.outreach.sequences[0]?.body || '')}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 shrink-0"
                        title="Open email 1 in Gmail"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={e => setNextFollowUpDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">LinkedIn profile URL</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="url"
                      value={linkedin}
                      onChange={e => setLinkedin(e.target.value)}
                      placeholder="https://www.linkedin.com/in/..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-300 font-mono text-[11px]"
                    />
                    <button
                      onClick={handleFindLinkedIn}
                      disabled={findingLi}
                      className="px-2.5 py-1.5 rounded bg-sky-900/60 hover:bg-sky-800 text-sky-100 text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {findingLi ? 'Searching…' : 'Find with AI search'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Reply / meeting notes</label>
                  <textarea
                    rows={2}
                    value={responseNotes}
                    onChange={e => setResponseNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Research notes</label>
                  <textarea
                    rows={2}
                    value={researchNotes}
                    onChange={e => setResearchNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white font-mono text-[11px]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-medium rounded text-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: FIRECRAWL EXTRACTED RAW WEBPAGE */}
          {activeSubTab === 'firecrawl' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-indigo-400 font-semibold text-xs block">
                    What the agent read
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Public pages used as evidence. Always double-check before you rely on a detail.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  Crawled: {new Date(investor.extractedData.crawledAt).toLocaleDateString()}
                </span>
              </div>

              {(investor.sourceUrls?.length || 0) > 0 && (
                <div>
                  <span className="text-zinc-400 block text-xs font-medium mb-1">Sources:</span>
                  <ul className="space-y-1">
                    {investor.sourceUrls!.map(u => (
                      <li key={u}>
                        <a href={u} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline break-all text-[11px]">
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <span className="text-zinc-400 block text-xs font-medium mb-1">Page title:</span>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-200 font-medium">
                  {investor.extractedData.pageTitle}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block text-xs font-medium mb-1">Quotes from their site:</span>
                <div className="space-y-1.5">
                  {investor.extractedData.keyQuotes.map((q, idx) => (
                    <div key={idx} className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 italic text-[11px]">
                      "{q}"
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 block text-xs font-medium mb-1">Website text excerpt:</span>
                <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-300 font-mono text-[11px] whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                  {investor.extractedData.extractedTextExcerpt}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: MAUTIC SEQUENCES */}
          {activeSubTab === 'sequences' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    4-Step Multi-Touch Cadence for {investor.name}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Written by AI from this investor's real thesis & portfolio. Edit and send from the Outreach tab.
                  </p>
                </div>
                <button
                  onClick={handleRegenerateSequence}
                  disabled={isRegenerating}
                  className="px-2.5 py-1 text-xs rounded border border-purple-800/60 bg-purple-950/40 text-purple-300 hover:bg-purple-900/40 cursor-pointer disabled:opacity-50"
                >
                  {isRegenerating ? 'Writing…' : 'Rewrite with AI'}
                </button>
              </div>

              <div className="space-y-3">
                {investor.outreach.sequences?.map(step => (
                  <div key={step.stepNumber} className="border border-zinc-800 rounded-lg p-3.5 bg-zinc-900/50">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                          Step {step.stepNumber} · Day {step.dayDelay}
                        </span>
                        <span className="font-medium text-white text-xs">{step.stepName}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyEmail(step.body, step.stepNumber)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] transition-colors cursor-pointer"
                        >
                          {copiedStep === step.stepNumber ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Body</span>
                            </>
                          )}
                        </button>

                        <a
                          href={gmailComposeUrl(investor.email, step.subject, step.body)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] transition-colors"
                          title="Open in Gmail"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send</span>
                        </a>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-1.5">
                      <strong className="text-zinc-300">Subject:</strong> {step.subject}
                    </div>

                    <div className="bg-zinc-950 p-3 rounded border border-zinc-800/80 font-mono text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {step.body}
                    </div>

                    <div className="mt-2 text-[10px] text-zinc-500 italic">
                      Why this works: {step.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
