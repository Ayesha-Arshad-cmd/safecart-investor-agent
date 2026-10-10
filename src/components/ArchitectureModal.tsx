import React from 'react';
import { X, ArrowDown, ShieldCheck } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  ['1 · Understand the app', 'Reads your website + the facts you entered, then writes an investor-ready profile and its own search plan.'],
  ['2 · Search', 'Runs Google-style searches for PUBLIC LinkedIn profiles (site:linkedin.com/in …) and for funds, angel groups and investor lists.'],
  ['3 · Pick real investors', 'AI reads every result and keeps only real, named investors that plausibly fit — with the source link saved as evidence.'],
  ['4 · Research', "Opens each investor's website (portfolio, thesis, team, contact pages), finds their public LinkedIn and any public email."],
  ['5 · Score', '0-100 fit score for this specific app, with reasons, concerns and the best opening hook.'],
  ['6 · Write outreach', 'A LinkedIn connection note + DM, and a 4-email cadence (day 0, 4, 10, 21) based on their real portfolio.'],
  ['7 · Track', 'CRM pipeline + follow-up reminders. You send from your own Gmail / LinkedIn; mark replied to stop the cadence.']
];

const STACK = [
  ['AI', 'Google Gemini free tier → Groq free tier → OpenRouter free models (automatic fallback). No card.'],
  ['Search', 'Tavily (1,000/mo free) → Serper (2,500 free) → DuckDuckGo (no key).'],
  ['Website reader', 'Built-in reader + Jina Reader fallback (free, no key).'],
  ['Database', 'JSON file on your Railway service (+ a copy in your browser).'],
  ['Hosting', 'GitHub → Railway free plan. Nothing installed on your computer.']
];

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-3xl w-full p-6 text-zinc-200 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">How the agent works</h2>
            <p className="text-xs text-zinc-400">Everything runs on free tiers — no installs, no credit card.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-900 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-5 space-y-1.5">
          {STEPS.map(([t, d], i) => (
            <React.Fragment key={t}>
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div className="text-xs font-semibold text-white">{t}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{d}</div>
              </div>
              {i < STEPS.length - 1 && <ArrowDown className="w-3.5 h-3.5 mx-auto text-zinc-600" />}
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {STACK.map(([k, v]) => (
            <div key={k} className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800">
              <div className="font-semibold text-emerald-300">{k}</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-sky-950/30 border border-sky-900/50 text-[11px] text-sky-100 flex gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            LinkedIn: the agent only finds <b>public</b> profiles through search engines and never logs in or automates your account (LinkedIn bans accounts
            for that). It writes the note; you send it in one click. Emails are only ever ones published on an investor's own website.
          </span>
        </div>
      </div>
    </div>
  );
};
