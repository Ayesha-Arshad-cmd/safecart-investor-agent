import React, { useEffect, useState } from 'react';
import { X, Settings, Check, RefreshCw, Cpu, Search, Mail, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppSettings, HealthInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  health: HealthInfo | null;
  onSaveSettings: (settings: AppSettings) => void;
  onClearCrm: () => void;
  onRefreshHealth: () => void;
}

const Row = ({ ok, icon, title, detail, hint }: { ok: boolean; icon: React.ReactNode; title: string; detail: string; hint?: string }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
    <div className="mt-0.5">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 font-medium text-zinc-200">
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
        {title}
      </div>
      <div className="text-[11px] text-zinc-400 mt-0.5 break-words">{detail}</div>
      {hint && <div className="text-[11px] text-zinc-500 mt-1">{hint}</div>}
    </div>
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, health, onSaveSettings, onClearCrm, onRefreshHealth }) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  useEffect(() => setForm({ ...settings }), [settings, isOpen]);
  if (!isOpen) return null;

  const field = 'w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 text-zinc-200 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Settings & connections</h2>
              <p className="text-xs text-zinc-400">API keys live in Railway → Variables (never in this page).</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-900 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 my-5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-300">Server status</span>
            <button onClick={onRefreshHealth} className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer">
              <RefreshCw className="w-3 h-3" /> Re-check
            </button>
          </div>
          {!health ? (
            <div className="p-3 rounded bg-amber-950/40 border border-amber-900 text-amber-200">Server not reachable.</div>
          ) : (
            <>
              <Row
                ok={health.ai.configured}
                icon={<Cpu className="w-4 h-4 text-amber-400" />}
                title="AI"
                detail={health.ai.configured ? `Using: ${health.ai.providers.join(' → ')} (automatic fallback)` : 'No AI key yet'}
                hint={health.ai.configured ? undefined : 'Add GEMINI_API_KEY (aistudio.google.com/apikey) and/or GROQ_API_KEY (console.groq.com/keys). Both free, no card.'}
              />
              <Row
                ok={health.search.providers.some(p => p !== 'duckduckgo')}
                icon={<Search className="w-4 h-4 text-cyan-400" />}
                title="Search (web + public LinkedIn profiles)"
                detail={`Using: ${health.search.providers.join(' → ') || 'none'}`}
                hint={
                  health.search.providers.some(p => p !== 'duckduckgo')
                    ? undefined
                    : 'DuckDuckGo works without a key but often blocks cloud servers. Add TAVILY_API_KEY (tavily.com, 1,000 free/month) or SERPER_API_KEY (serper.dev, 2,500 free) for reliable results.'
                }
              />
              <Row
                ok={health.email.configured}
                icon={<Mail className="w-4 h-4 text-purple-400" />}
                title="Email sending (optional)"
                detail={health.email.configured ? `Send-now enabled via ${health.email.provider}` : 'Not configured — you send from your own Gmail with one click (recommended for investor emails).'}
                hint={health.email.configured ? undefined : 'Optional: BREVO_API_KEY + SENDER_EMAIL (brevo.com free plan) to send straight from the app.'}
              />
              <Row
                ok={health.storage.persistent}
                icon={<Database className="w-4 h-4 text-emerald-400" />}
                title="CRM storage"
                detail={health.storage.path}
                hint={
                  health.storage.persistent
                    ? undefined
                    : 'Attach a Railway Volume mounted at /data so the CRM survives redeploys. Your browser also keeps a copy, and you can export CSV anytime.'
                }
              />
              {!health.passwordRequired && (
                <div className="p-2.5 rounded bg-amber-950/30 border border-amber-900/60 text-amber-200 text-[11px]">
                  Tip: set APP_PASSWORD in Railway so strangers can't use your free AI quota.
                </div>
              )}
            </>
          )}
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            onSaveSettings(form);
            onClose();
          }}
          className="space-y-4 text-xs"
        >
          <div className="font-semibold text-zinc-300">Agent preferences</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 mb-1">Investors to research per run</label>
              <input
                type="number"
                min={1}
                max={30}
                className={field}
                value={form.leadsPerRun}
                onChange={e => setForm({ ...form, leadsPerRun: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Skip investors scoring below</label>
              <input
                type="number"
                min={0}
                max={100}
                className={field}
                value={form.minFitScoreToKeep}
                onChange={e => setForm({ ...form, minFitScoreToKeep: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-zinc-400 mb-1">Geography focus</label>
              <input className={field} value={form.geographyFocus} onChange={e => setForm({ ...form, geographyFocus: e.target.value })} />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Sign emails as</label>
              <input className={field} value={form.senderName} placeholder="Your name" onChange={e => setForm({ ...form, senderName: e.target.value })} />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Reply-to email</label>
              <input className={field} value={form.senderEmail} placeholder="you@safecartkids.com" onChange={e => setForm({ ...form, senderEmail: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={form.lookupLinkedInProfiles} onChange={e => setForm({ ...form, lookupLinkedInProfiles: e.target.checked })} />
            Look up each investor's public LinkedIn profile (uses 1 extra search per investor)
          </label>
          <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={form.includeLocalAngelGroups} onChange={e => setForm({ ...form, includeLocalAngelGroups: e.target.checked })} />
            Include local angel groups near the company's HQ
          </label>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClearCrm();
                onClose();
              }}
              className="px-3 py-1.5 rounded border border-red-900/50 text-red-400 hover:bg-red-950/40 cursor-pointer"
            >
              Clear all investors
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-900 cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="flex items-center gap-1 px-4 py-1.5 font-medium text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
