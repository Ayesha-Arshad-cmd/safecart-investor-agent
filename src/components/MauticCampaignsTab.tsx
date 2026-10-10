import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Send, Copy, Check, RotateCw, CheckCircle2, AlertCircle, FileSpreadsheet, Clock, Linkedin, MessageSquareReply, Loader2, CalendarClock, ExternalLink } from 'lucide-react';
import { Investor, StartupProfile, AppSettings, HealthInfo } from '../types';
import { exportToMauticCsv } from '../services/crmStorage';
import { api, gmailComposeUrl, mailtoUrl, linkedinSearchUrl, addDays, todayIso } from '../services/api';

interface Props {
  investors: Investor[];
  startup: StartupProfile;
  settings: AppSettings;
  health: HealthInfo | null;
  onUpdateInvestor: (updated: Investor, quiet?: boolean) => void;
  onOpenInvestorDetail: (inv: Investor) => void;
  showToast: (msg: string, error?: boolean) => void;
}

type Filter = 'due' | 'ready' | 'contacted' | 'all';
const CLOSED = ['replied', 'meeting', 'diligence', 'passed'];

export const MauticCampaignsTab: React.FC<Props> = ({ investors, startup, settings, health, onUpdateInvestor, onOpenInvestorDetail, showToast }) => {
  const today = todayIso();
  const isDue = (i: Investor) => !!i.outreach.nextFollowUpDate && i.outreach.nextFollowUpDate <= today && !CLOSED.includes(i.outreach.status);
  const isReady = (i: Investor) => i.outreach.sentStepsCount === 0 && !i.outreach.linkedinRequestSentAt && !CLOSED.includes(i.outreach.status) && i.fitScore.status !== 'cold';
  const counts = {
    due: investors.filter(isDue).length,
    ready: investors.filter(isReady).length,
    contacted: investors.filter(i => i.outreach.sentStepsCount > 0 || !!i.outreach.linkedinRequestSentAt).length,
    all: investors.length
  };
  const [filter, setFilter] = useState<Filter>(counts.due ? 'due' : 'ready');
  const list = useMemo(() => {
    const l = investors.filter(i => (filter === 'due' ? isDue(i) : filter === 'ready' ? isReady(i) : filter === 'contacted' ? i.outreach.sentStepsCount > 0 || !!i.outreach.linkedinRequestSentAt : true));
    return l.sort((a, b) => b.fitScore.total - a.fitScore.total);
  }, [investors, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = investors.find(i => i.id === selectedId) || list[0];
  const sequences = selected?.outreach.sequences || [];
  const nextStepNumber = Math.min((selected?.outreach.sentStepsCount || 0) + 1, Math.max(sequences.length, 1));
  const [activeStep, setActiveStep] = useState(nextStepNumber);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState<'' | 'regen' | 'send'>('');

  useEffect(() => {
    setActiveStep(nextStepNumber);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = sequences.find(s => s.stepNumber === activeStep) || sequences[0];
  useEffect(() => {
    setSubject(step?.subject || '');
    setBody(step?.body || '');
  }, [selected?.id, step?.stepNumber, step?.subject, step?.body]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  };

  const edited = !!step && (subject !== step.subject || body !== step.body);
  const saveEdits = () => {
    if (!selected || !step) return;
    onUpdateInvestor({
      ...selected,
      outreach: { ...selected.outreach, sequences: sequences.map(s => (s.stepNumber === step.stepNumber ? { ...s, subject, body } : s)) }
    });
  };

  const markSent = (via: string) => {
    if (!selected || !step) return;
    const idx = sequences.findIndex(s => s.stepNumber === step.stepNumber);
    const next = sequences[idx + 1];
    const nextDate = next ? addDays(today, Math.max(1, next.dayDelay - step.dayDelay)) : '';
    onUpdateInvestor(
      {
        ...selected,
        outreach: {
          ...selected.outreach,
          sequences: sequences.map(s => (s.stepNumber === step.stepNumber ? { ...s, subject, body, sentAt: new Date().toISOString() } : s)),
          status: CLOSED.includes(selected.outreach.status) ? selected.outreach.status : 'contacted',
          sentStepsCount: Math.max(selected.outreach.sentStepsCount, step.stepNumber),
          lastContactedDate: today,
          nextFollowUpDate: nextDate
        }
      },
      true
    );
    showToast(next ? `Step ${step.stepNumber} marked sent${via}. Next follow-up scheduled for ${nextDate}.` : `Final step sent${via}. Sequence complete.`);
    if (next) setActiveStep(next.stepNumber);
  };

  const sendViaServer = async () => {
    if (!selected?.email || !step) return;
    setBusy('send');
    try {
      const r = await api.sendEmail(selected.email, subject, body, startup.founderEmail || settings.senderEmail || undefined);
      if (!r.ok) throw new Error(r.error);
      markSent(' via Brevo');
    } catch (e: any) {
      showToast(e?.message || 'Send failed', true);
    } finally {
      setBusy('');
    }
  };

  const markReplied = () => {
    if (!selected) return;
    onUpdateInvestor({ ...selected, outreach: { ...selected.outreach, status: 'replied', replyDate: today, nextFollowUpDate: '' } });
  };

  const markLinkedInSent = () => {
    if (!selected) return;
    onUpdateInvestor({
      ...selected,
      outreach: {
        ...selected.outreach,
        linkedinRequestSentAt: new Date().toISOString(),
        status: CLOSED.includes(selected.outreach.status) ? selected.outreach.status : 'contacted',
        lastContactedDate: today,
        nextFollowUpDate: selected.outreach.nextFollowUpDate || addDays(today, 5)
      }
    });
  };

  const regenerate = async () => {
    if (!selected) return;
    setBusy('regen');
    try {
      const o = await api.outreach(startup, selected, settings);
      onUpdateInvestor({
        ...selected,
        linkedinNote: o.linkedinNote,
        linkedinMessage: o.linkedinMessage,
        outreach: {
          ...selected.outreach,
          sequenceGenerated: true,
          sequences: o.sequences.map(s => ({ ...s, sentAt: sequences.find(x => x.stepNumber === s.stepNumber)?.sentAt }))
        }
      });
    } catch (e: any) {
      showToast(e?.message || 'AI rewrite failed', true);
    } finally {
      setBusy('');
    }
  };

  const exportCsv = () => {
    const csv = exportToMauticCsv(investors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${startup.name.replace(/\s+/g, '_')}_outreach_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const spamWords = ['guarantee', 'free', '100%', 'risk-free', 'buy now', 'urgent', 'winner', 'millionaire', '$$$'];
  const spam = spamWords.filter(w => `${subject} ${body}`.toLowerCase().includes(w));
  const words = body.split(/\s+/).filter(Boolean).length;
  const note = selected?.linkedinNote || '';

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-400 border border-purple-800">PHASE 5</span>
            <h2 className="text-base font-semibold text-white tracking-tight">Personalised outreach & follow-ups</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Every investor gets a LinkedIn note and a 4-email cadence written from their real thesis and portfolio. Send from your own Gmail (best deliverability),
            click <b>Mark as sent</b>, and the agent schedules the next follow-up. Mark <b>Replied</b> to stop the sequence.
          </p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-500 hover:bg-purple-400 text-zinc-950 text-xs font-semibold rounded-lg cursor-pointer shrink-0">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 max-h-[760px] overflow-y-auto space-y-2">
          <div className="grid grid-cols-4 gap-1 text-[10px] mb-2">
            {(
              [
                ['due', `Due ${counts.due}`],
                ['ready', `New ${counts.ready}`],
                ['contacted', `Sent ${counts.contacted}`],
                ['all', `All ${counts.all}`]
              ] as const
            ).map(([id, t]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-1.5 py-1.5 rounded border cursor-pointer ${filter === id ? 'bg-purple-950/60 border-purple-600 text-white' : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
          {list.length === 0 && (
            <div className="text-xs text-zinc-500 p-4 text-center">
              {filter === 'due' ? 'No follow-ups due today 🎉' : investors.length ? 'Nothing in this list.' : 'No investors yet — run the agent first.'}
            </div>
          )}
          {list.map(inv => (
            <div
              key={inv.id}
              onClick={() => setSelectedId(inv.id)}
              className={`p-3 rounded-lg border cursor-pointer text-xs ${
                selected?.id === inv.id ? 'bg-zinc-900 border-purple-500/80 text-white' : 'bg-zinc-900/30 border-zinc-800/80 hover:bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold truncate">{inv.name}</span>
                <span className={`text-[10px] font-mono font-bold ${inv.fitScore.status === 'hot' ? 'text-emerald-400' : inv.fitScore.status === 'warm' ? 'text-amber-400' : 'text-zinc-500'}`}>
                  {inv.fitScore.total}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{inv.firm}</div>
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className="px-1.5 rounded bg-zinc-800 text-purple-300 font-mono">{inv.outreach.status}</span>
                {inv.outreach.sentStepsCount > 0 && <span className="text-zinc-500">{inv.outreach.sentStepsCount}/{inv.outreach.sequences.length} sent</span>}
                {inv.outreach.nextFollowUpDate && !CLOSED.includes(inv.outreach.status) && (
                  <span className={isDue(inv) ? 'text-amber-300' : 'text-zinc-500'}>next {inv.outreach.nextFollowUpDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="p-8 text-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">Select an investor.</div>
          ) : (
            <>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">{selected.name}</h3>
                    <span className="text-xs text-zinc-400">{selected.firm}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5 font-mono truncate">
                    {selected.email || 'no public email found'} · {selected.contactRoute}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={markReplied} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 text-xs rounded cursor-pointer">
                    <MessageSquareReply className="w-3.5 h-3.5" /> They replied
                  </button>
                  <button
                    onClick={regenerate}
                    disabled={busy === 'regen'}
                    className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${busy === 'regen' ? 'animate-spin' : ''}`} /> Rewrite with AI
                  </button>
                </div>
              </div>

              {/* LinkedIn */}
              <div className="bg-sky-950/20 border border-sky-900/50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <Linkedin className="w-4 h-4" /> LinkedIn connection note
                    <span className={`font-mono text-[10px] ${note.length > 300 ? 'text-red-400' : 'text-zinc-500'}`}>{note.length}/300</span>
                  </span>
                  <div className="flex gap-2">
                    <a
                      href={selected.linkedin || linkedinSearchUrl(selected.name, selected.firm)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-800 hover:bg-sky-700 text-white"
                    >
                      {selected.linkedin ? 'Open profile' : 'Find on LinkedIn'} <ExternalLink className="w-3 h-3" />
                    </a>
                    <button onClick={() => copy(note, 'li')} disabled={!note} className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer disabled:opacity-40">
                      {copied === 'li' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy note
                    </button>
                    {selected.outreach.linkedinRequestSentAt ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> request sent
                      </span>
                    ) : (
                      <button onClick={markLinkedInSent} className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer">
                        Mark request sent
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-zinc-200 whitespace-pre-wrap">{note || 'No note yet — click "Rewrite with AI".'}</p>
                {selected.linkedinMessage && (
                  <details className="text-zinc-400">
                    <summary className="cursor-pointer text-[11px]">Message to send after they accept</summary>
                    <div className="mt-1 flex items-start gap-2">
                      <p className="text-zinc-300 whitespace-pre-wrap flex-1">{selected.linkedinMessage}</p>
                      <button onClick={() => copy(selected.linkedinMessage!, 'dm')} className="p-1 rounded hover:bg-zinc-800 cursor-pointer">
                        {copied === 'dm' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </details>
                )}
                <p className="text-[10px] text-zinc-500">LinkedIn doesn't allow automated sending, so you paste & send it yourself — about 10 seconds per investor.</p>
              </div>

              {/* Email cadence */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {sequences.map(s => (
                  <button
                    key={s.stepNumber}
                    onClick={() => setActiveStep(s.stepNumber)}
                    className={`p-3 rounded-lg border text-left cursor-pointer ${
                      activeStep === s.stepNumber ? 'bg-purple-950/40 border-purple-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase font-bold text-purple-400">Email {s.stepNumber}</span>
                      {s.sentAt ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> day {s.dayDelay}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-xs mt-1 truncate">{s.stepName}</div>
                  </button>
                ))}
              </div>

              {step ? (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3">
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Subject</div>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Body (editable)</div>
                    <textarea
                      rows={11}
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold mb-1">Why this works</span>
                      <p className="text-[11px] text-zinc-300 italic">{step.rationale || '—'}</p>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1 text-[11px]">
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Deliverability</span>
                      <div className={`flex items-center gap-1.5 ${words <= 170 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {words} words (ideal 75-150)
                      </div>
                      {spam.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> No spam trigger words
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" /> Contains "{spam.join(', ')}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-zinc-800">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => copy(`Subject: ${subject}\n\n${body}`, 'email')} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded cursor-pointer">
                        {copied === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Copy
                      </button>
                      {edited && (
                        <button onClick={saveEdits} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-200 text-xs rounded cursor-pointer">
                          Save edits
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={gmailComposeUrl(selected.email, subject, body)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-xs rounded"
                      >
                        <Mail className="w-3.5 h-3.5" /> Open in Gmail
                      </a>
                      <a href={mailtoUrl(selected.email, subject, body)} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded">
                        Mail app
                      </a>
                      {health?.email.configured && selected.email && (
                        <button
                          onClick={sendViaServer}
                          disabled={busy === 'send'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-zinc-950 font-semibold text-xs rounded cursor-pointer disabled:opacity-50"
                        >
                          {busy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send now
                        </button>
                      )}
                      <button
                        onClick={() => markSent('')}
                        disabled={!!step.sentAt}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-semibold text-xs rounded cursor-pointer disabled:opacity-40"
                      >
                        <CalendarClock className="w-3.5 h-3.5" /> {step.sentAt ? 'Sent' : 'Mark as sent'}
                      </button>
                    </div>
                  </div>
                  {!selected.email && (
                    <p className="text-[11px] text-amber-300/80">
                      No public email was found for this investor. Use the LinkedIn note above, their website contact form ({selected.website || 'unknown'}), or add an
                      email in the dossier if you find one.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 text-sm border border-zinc-800 rounded-xl">
                  No emails drafted yet. Click "Rewrite with AI".
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => onOpenInvestorDetail(selected)} className="text-xs text-zinc-400 hover:text-white cursor-pointer">
                  Open full dossier →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
