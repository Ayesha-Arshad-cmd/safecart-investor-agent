/**
 * SafeCart Kids Investor Agent — backend server.
 * Zero npm dependencies at runtime: plain Node.js (v20+) http + fetch.
 * Serves the built React app from /dist and the agent API under /api.
 */
import './env'; // must be first: loads .env for local runs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { aiConfigured, aiProviderNames } from './ai';
import { searchProviderNames, webSearch } from './search';
import { emailProvider, sendEmail } from './email';
import { loadState, saveState, storageInfo, flushNow, mergeInvestors, clearInvestors } from './store';
import { startCampaign, startUpgrade, getCampaign, pauseCampaign, resumeCampaign, resumeOnBoot } from './campaign';
import { startAutomation, runAutomationNow, automationStatus } from './automation';
import {
  analyzeProduct,
  discoverCandidates,
  researchCandidate,
  scoreInvestor,
  generateOutreach,
  findLinkedInProfile,
  startAgentJob,
  getJob,
  latestJob,
  cancelJob,
  defaultQueries
} from './agent';
import { investorToCandidate } from './agent';
import type { HealthInfo } from '../src/types';

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.resolve(process.env.STATIC_DIR || path.join(process.cwd(), 'dist'));
const PASSWORD = (process.env.APP_PASSWORD || '').trim();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readBody(req: http.IncomingMessage, limit = 8 * 1024 * 1024): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

function authorized(req: http.IncomingMessage): boolean {
  if (!PASSWORD) return true;
  const given = String(req.headers['x-app-password'] || '');
  const a = Buffer.from(crypto.createHash('sha256').update(given).digest('hex'));
  const b = Buffer.from(crypto.createHash('sha256').update(PASSWORD).digest('hex'));
  return crypto.timingSafeEqual(a, b);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Backend is running. Frontend not built yet — run `npm run build`.');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const cache = /\/assets\//.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(file).pipe(res);
}

type Handler = (body: any, params: Record<string, string>) => Promise<unknown> | unknown;
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];
function route(method: string, pathPattern: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp('^' + pathPattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, pattern, keys, handler });
}

const need = (cond: any, msg: string) => {
  if (!cond) throw Object.assign(new Error(msg), { status: 400 });
};

// ------------------------------------------------------------------ API
route('GET', '/api/health', (): HealthInfo => ({
  ok: true,
  ai: { configured: aiConfigured(), providers: aiProviderNames() },
  search: { providers: searchProviderNames() },
  email: { configured: emailProvider() !== 'none', provider: emailProvider() },
  storage: storageInfo(),
  passwordRequired: Boolean(PASSWORD)
}));

route('GET', '/api/state', () => {
  const s = loadState();
  return { startup: s.startup, investors: s.investors, settings: s.settings, updatedAt: s.updatedAt };
});
route('PUT', '/api/state', body => {
  need(body && typeof body === 'object', 'body required');
  // investors are MERGED (newest copy of each wins) so background jobs and the browser never overwrite each other
  if (body.clearAll) clearInvestors();
  if (Array.isArray(body.investors) || Array.isArray(body.deletedIds)) {
    mergeInvestors(Array.isArray(body.investors) ? body.investors : [], Array.isArray(body.deletedIds) ? body.deletedIds : []);
  }
  const s = saveState({ startup: body.startup, settings: body.settings });
  return { ok: true, updatedAt: s.updatedAt };
});

// ---- big runs (100-200+ investors, resumable)
route('GET', '/api/campaign', () => ({ campaign: getCampaign() }));
route('POST', '/api/campaign/start', body => {
  need(body.startup?.name, 'startup required');
  startCampaign(body.startup, body.settings || {}, { target: Number(body.target) || 100, mode: body.mode === 'quick' ? 'quick' : 'deep' });
  return { campaign: getCampaign() };
});
route('POST', '/api/campaign/upgrade', body => {
  need(body.startup?.name, 'startup required');
  const r = startUpgrade(body.startup, body.settings || {}, Number(body.count) || 20);
  return { campaign: r.campaign ? getCampaign() : null, available: r.available };
});
route('POST', '/api/campaign/pause', () => ({ ok: pauseCampaign(), campaign: getCampaign() }));
route('POST', '/api/campaign/resume', () => ({ ok: resumeCampaign(), campaign: getCampaign() }));

// ---- upgrade a quick-scanned investor to full research (keeps the same record)
route('POST', '/api/research-investor', async body => {
  need(body.startup?.name && body.investor?.id, 'startup and investor required');
  const inv = await researchCandidate(body.startup, investorToCandidate(body.investor), body.settings);
  inv.id = body.investor.id;
  inv.createdAt = body.investor.createdAt || inv.createdAt;
  inv.quickScore = body.investor.quickScore;
  inv.campaignId = body.investor.campaignId;
  const o = body.investor.outreach || {};
  const keep: any = {};
  for (const k of ['linkedinRequestSentAt', 'linkedinAcceptedAt', 'linkedinMessagedAt', 'autoPaused', 'responseNotes', 'replyDate']) if (o[k]) keep[k] = o[k];
  if (['contacted', 'replied', 'meeting', 'diligence', 'passed'].includes(o.status)) Object.assign(keep, { status: o.status });
  inv.outreach = { ...inv.outreach, ...keep };
  inv.updatedAt = new Date().toISOString();
  mergeInvestors([inv]);
  return { investor: inv };
});

// ---- automatic outreach
route('GET', '/api/automation/status', async () => await automationStatus());
route('POST', '/api/automation/run', async () => await runAutomationNow());

route('POST', '/api/product/analyze', async body => {
  need(body.startup?.name, 'startup required');
  return { intel: await analyzeProduct(body.startup, body.settings) };
});

route('POST', '/api/discover', async body => {
  need(body.startup?.name, 'startup required');
  let queries: string[] = Array.isArray(body.queries) ? body.queries.filter((q: any) => typeof q === 'string' && q.trim()) : [];
  if (body.query) {
    const q = String(body.query).trim();
    queries = body.mode === 'linkedin' && !/site:/i.test(q) ? [`site:linkedin.com/in ${q}`] : [q];
  }
  if (!queries.length) {
    const d = defaultQueries(body.startup, body.settings);
    queries = body.mode === 'linkedin' ? d.linkedin : body.mode === 'web' ? d.web : [...d.linkedin.slice(0, 3), ...d.web.slice(0, 3)];
  }
  const logs: string[] = [];
  const { candidates, rawResults } = await discoverCandidates(body.startup, queries.slice(0, 10), body.existing || [], (_p, m) => logs.push(m));
  return { candidates, resultsSearched: rawResults.length, queries, logs };
});

route('POST', '/api/research', async body => {
  need(body.startup?.name && body.candidate?.name, 'startup and candidate required');
  return { investor: await researchCandidate(body.startup, body.candidate, body.settings) };
});

route('POST', '/api/score', async body => {
  need(body.startup?.name && body.investor?.name, 'startup and investor required');
  return await scoreInvestor(body.startup, body.investor);
});

route('POST', '/api/outreach', async body => {
  need(body.startup?.name && body.investor?.name, 'startup and investor required');
  return await generateOutreach(body.startup, body.investor, body.settings);
});

route('POST', '/api/linkedin/find', async body => {
  need(body.name, 'name required');
  return { linkedin: await findLinkedInProfile(String(body.name), String(body.firm || '')) };
});

route('POST', '/api/search/raw', async body => {
  need(body.query, 'query required');
  return await webSearch(String(body.query), Math.min(Number(body.max) || 10, 20));
});

route('POST', '/api/email/send', async body => {
  need(body.to && body.subject && body.body, 'to, subject and body required');
  return await sendEmail(String(body.to), String(body.subject), String(body.body), body.replyTo, body.fromName);
});

route('POST', '/api/agent/run', body => {
  need(body.startup?.name, 'startup required');
  const job = startAgentJob(body.startup, body.settings || {}, body.existing || [], {
    refreshProduct: Boolean(body.refreshProduct),
    extraQueries: Array.isArray(body.extraQueries) ? body.extraQueries : []
  });
  return { jobId: job.id };
});
route('GET', '/api/agent/jobs/latest', () => ({ job: latestJob() || null }));
route('GET', '/api/agent/jobs/:id', (_b, p) => {
  const job = getJob(p.id);
  if (!job) throw Object.assign(new Error('job not found (server may have restarted)'), { status: 404 });
  return { job };
});
route('POST', '/api/agent/jobs/:id/cancel', (_b, p) => ({ ok: cancelJob(p.id) }));

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (!url.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    serveStatic(req, res);
    return;
  }
  if (url !== '/api/health' && !authorized(req)) {
    send(res, 401, { error: 'Password required' });
    return;
  }
  const r = routes.find(x => x.method === req.method && x.pattern.test(url));
  if (!r) {
    send(res, 404, { error: 'Not found' });
    return;
  }
  try {
    const m = url.match(r.pattern)!;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const body = req.method === 'GET' ? {} : await readBody(req);
    const out = await r.handler(body, params);
    send(res, 200, out);
  } catch (e: any) {
    const status = e?.status || 500;
    if (status >= 500) console.error(`[api] ${req.method} ${url}:`, e?.message);
    send(res, status, { error: String(e?.message || e) });
  }
});

server.requestTimeout = 0; // research calls can take a while
server.headersTimeout = 65000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SafeCart Kids Investor Agent on :${PORT}`);
  startAutomation();
  resumeOnBoot();
  console.log(`  AI providers:     ${aiProviderNames().join(', ') || 'NONE — set GEMINI_API_KEY or GROQ_API_KEY'}`);
  console.log(`  Search providers: ${searchProviderNames().join(', ')}`);
  console.log(`  Email:            ${emailProvider()}`);
  console.log(`  Storage:          ${storageInfo().path}`);
  if (!PASSWORD) console.log('  WARNING: APP_PASSWORD not set — anyone with the URL can use your free AI quota.');
});

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    flushNow();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
