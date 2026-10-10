// Browser → your Railway backend. All AI keys stay on the server; the browser never sees them.
import {
  StartupProfile,
  Investor,
  AppSettings,
  DiscoveryCandidate,
  AgentJob,
  HealthInfo,
  InvestorFitScore,
  EmailSequenceStep
} from '../types';

const PW_KEY = 'safecart_agent_password';

export function getPassword(): string {
  try {
    return localStorage.getItem(PW_KEY) || '';
  } catch {
    return '';
  }
}
export function setPassword(pw: string) {
  try {
    localStorage.setItem(PW_KEY, pw);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-app-password': getPassword() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('safecart-auth-required'));
    throw new ApiError(data?.error || `Server error ${res.status}`, res.status);
  }
  return data as T;
}

const existingOf = (investors: Investor[]) => investors.map(i => ({ name: i.name, firm: i.firm }));

export const api = {
  health: () => call<HealthInfo>('GET', '/api/health'),

  loadState: () => call<{ startup: StartupProfile | null; investors: Investor[]; settings: AppSettings | null; updatedAt: string }>('GET', '/api/state'),
  saveState: (state: { startup?: StartupProfile; investors?: Investor[]; settings?: AppSettings }) => call<{ ok: boolean }>('PUT', '/api/state', state),

  analyzeProduct: (startup: StartupProfile, settings: AppSettings) =>
    call<{ intel: Partial<StartupProfile> }>('POST', '/api/product/analyze', { startup, settings }),

  discover: (startup: StartupProfile, settings: AppSettings, investors: Investor[], opts: { query?: string; mode?: 'linkedin' | 'web' | 'both'; queries?: string[] }) =>
    call<{ candidates: DiscoveryCandidate[]; resultsSearched: number; queries: string[]; logs: string[] }>('POST', '/api/discover', {
      startup,
      settings,
      existing: existingOf(investors),
      ...opts
    }),

  research: (startup: StartupProfile, candidate: DiscoveryCandidate, settings: AppSettings) =>
    call<{ investor: Investor }>('POST', '/api/research', { startup, candidate, settings }),

  score: (startup: StartupProfile, investor: Investor) =>
    call<{ fitScore: InvestorFitScore; researchNotes: string }>('POST', '/api/score', { startup, investor }),

  outreach: (startup: StartupProfile, investor: Investor, settings: AppSettings) =>
    call<{ sequences: EmailSequenceStep[]; linkedinNote: string; linkedinMessage: string }>('POST', '/api/outreach', { startup, investor, settings }),

  findLinkedIn: (name: string, firm: string) => call<{ linkedin: string }>('POST', '/api/linkedin/find', { name, firm }),

  sendEmail: (to: string, subject: string, body: string, replyTo?: string) =>
    call<{ ok: boolean; error?: string }>('POST', '/api/email/send', { to, subject, body, replyTo }),

  runAgent: (startup: StartupProfile, settings: AppSettings, investors: Investor[], refreshProduct = false) =>
    call<{ jobId: string }>('POST', '/api/agent/run', { startup, settings, existing: existingOf(investors), refreshProduct }),
  getJob: (id: string) => call<{ job: AgentJob }>('GET', `/api/agent/jobs/${encodeURIComponent(id)}`),
  latestJob: () => call<{ job: AgentJob | null }>('GET', '/api/agent/jobs/latest'),
  cancelJob: (id: string) => call<{ ok: boolean }>('POST', `/api/agent/jobs/${encodeURIComponent(id)}/cancel`)
};

// ---- helpers used by several screens
export const gmailComposeUrl = (to: string, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const linkedinSearchUrl = (name: string, firm: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${/independent/i.test(firm) ? '' : firm}`.trim())}`;

export const addDays = (iso: string | Date, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
