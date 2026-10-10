/**
 * The investor agent.
 *
 *   Phase 1  analyzeProduct      → understand the app (reads its website)
 *   Phase 2  discoverCandidates  → web + public-LinkedIn search, AI extracts real investors
 *   Phase 3  researchCandidate   → reads the investor's site, finds LinkedIn, portfolio, contact route
 *   Phase 4  (inside research)   → AI fit score 0-100 for THIS app
 *   Phase 5  (inside research)   → personalised 4-step email cadence + LinkedIn note/DM
 *   runAgentJob                  → does all of it in one click, with a live log
 */
import { chatJson } from './ai';
import { webSearch, SearchResult, isLinkedInProfile, normalizeLinkedInUrl } from './search';
import { readPage, pickUsefulSubpages, canFetch, PageContent } from './reader';
import type {
  StartupProfile,
  AppSettings,
  Investor,
  InvestorFitScore,
  EmailSequenceStep,
  DiscoveryCandidate,
  AgentJob,
  PipelineExecutionLog,
  InvestorType,
  InvestmentStage
} from '../src/types';

// ---------------------------------------------------------------- helpers
const arr = (x: any, max = 20): string[] =>
  (Array.isArray(x) ? x : typeof x === 'string' && x ? [x] : [])
    .map((v: any) => (typeof v === 'string' ? v : v?.name || JSON.stringify(v)))
    .map((v: string) => v.trim())
    .filter(Boolean)
    .slice(0, max);
const str = (x: any, max = 2000): string => (typeof x === 'string' ? x.trim().slice(0, max) : x == null ? '' : String(x).slice(0, max));
const clamp = (n: any, lo = 0, hi = 100): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
};
const today = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const INVESTOR_TYPES: InvestorType[] = ['Angel', 'VC Fund', 'Micro-VC', 'Family Office', 'Angel Group', 'Accelerator', 'Corporate VC', 'Other'];
const STAGES: InvestmentStage[] = ['Pre-seed', 'Seed', 'Series A', 'Growth', 'All Stages', 'Unknown'];
const asType = (t: any): InvestorType => INVESTOR_TYPES.find(x => x.toLowerCase() === String(t || '').toLowerCase()) || 'Other';
const asStage = (s: any): InvestmentStage => {
  const v = String(s || '').toLowerCase();
  if (/pre.?seed/.test(v)) return 'Pre-seed';
  if (/^seed|seed/.test(v)) return 'Seed';
  if (/series a/.test(v)) return 'Series A';
  if (/growth|series [b-z]|late/.test(v)) return 'Growth';
  if (/all|multi|any/.test(v)) return 'All Stages';
  return STAGES.find(x => x.toLowerCase() === v) || 'Unknown';
};

const NON_FIRM_HOSTS = [
  'linkedin.com', 'crunchbase.com', 'pitchbook.com', 'facebook.com', 'twitter.com', 'x.com', 'wikipedia.org', 'bloomberg.com',
  'medium.com', 'youtube.com', 'instagram.com', 'wellfound.com', 'angel.co', 'signal.nfx.com', 'tracxn.com', 'cbinsights.com',
  'dealroom.co', 'forbes.com', 'techcrunch.com', 'businessinsider.com', 'reddit.com', 'quora.com', 'github.com', 'zoominfo.com',
  'rocketreach.co', 'apollo.io', 'openvc.app', 'f6s.com', 'eu-startups.com', 'google.com', 'substack.com', 'prnewswire.com',
  'businesswire.com', 'globenewswire.com', 'yahoo.com', 'axios.com', 'inc.com', 'entrepreneur.com', 'fastcompany.com'
];
function isNonFirmUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return NON_FIRM_HOSTS.some(d => h === d || h.endsWith('.' + d));
  } catch {
    return true;
  }
}

export function startupBrief(s: StartupProfile): string {
  const lines = [
    `Name: ${s.name}`,
    s.website ? `Website: ${s.website}` : '',
    `One-liner: ${s.oneLiner}`,
    `Category: ${s.category}`,
    `Stage: ${s.stage}`,
    s.targetRaise ? `Raising: ${s.targetRaise}` : 'Raise amount: not specified (do NOT invent one)',
    s.checkSizeMin || s.checkSizeMax ? `Desired check size: ${s.checkSizeMin} - ${s.checkSizeMax}` : '',
    `Location: ${s.location}`,
    `Problem: ${s.problem}`,
    `Solution / edge: ${s.secretSauce}`,
    s.keyFeatures?.length ? `Key features: ${s.keyFeatures.join('; ')}` : '',
    s.tractionHighlights?.length ? `Facts / traction (ONLY these are true): ${s.tractionHighlights.join('; ')}` : 'Traction: none provided (do NOT invent any)',
    `Ideal investors: ${s.idealInvestorTraits}`,
    s.productDescription ? `AI product summary: ${s.productDescription}` : '',
    s.targetCustomers?.length ? `Buyers: ${s.targetCustomers.join('; ')}` : '',
    s.endUsers?.length ? `End users: ${s.endUsers.join('; ')}` : '',
    s.businessModel ? `Business model (analysis): ${s.businessModel}` : '',
    s.differentiation?.length ? `Differentiation: ${s.differentiation.join('; ')}` : '',
    s.competitors?.length ? `Comparable companies: ${s.competitors.join('; ')}` : '',
    s.investorKeywords?.length ? `Investor keywords: ${s.investorKeywords.join(', ')}` : '',
    s.extraContext ? `Extra context from founder: ${s.extraContext.slice(0, 2500)}` : ''
  ];
  return lines.filter(Boolean).join('\n');
}

const HONESTY_RULES = `Honesty rules (very important):
- Never invent traction, revenue, users, pilots, partnerships, quotes or metrics. Only use facts given to you.
- Never invent investors, people, emails, portfolio companies or URLs. If something is unknown, use "" or [].
- It is fine to give clearly-labelled analysis/opinion (e.g. likely business model), but not fake facts.`;

// ---------------------------------------------------------------- Phase 1
export async function analyzeProduct(s: StartupProfile, settings?: Partial<AppSettings>): Promise<Partial<StartupProfile>> {
  let siteText = '';
  if (s.website && canFetch(s.website)) {
    const home = await readPage(s.website, 8000);
    siteText = home.text ? `HOMEPAGE (${home.url}) title="${home.title}" desc="${home.description}"\n${home.text}` : '';
    for (const sub of pickUsefulSubpages(home, 2).filter(u => !/portfolio/.test(u))) {
      const p = await readPage(sub, 3000);
      if (p.text) siteText += `\n\nPAGE ${p.url}\n${p.text}`;
    }
  }
  const geo = settings?.geographyFocus || 'United States';
  const local = settings?.includeLocalAngelGroups !== false;

  const out = await chatJson<any>(
    `You are a senior venture analyst preparing a startup for an investor search. Today is ${today()}.\n${HONESTY_RULES}`,
    `Analyse this product so an AI agent can find the RIGHT investors for it.

STARTUP PROFILE (from the founder):
${startupBrief(s)}

${siteText ? `WEBSITE TEXT (scraped just now):\n${siteText.slice(0, 9000)}` : 'Website could not be read; rely on the profile.'}

Geography focus for investors: ${geo}. ${local ? `Also include searches for local angel groups / investors near ${s.location}.` : ''}

Return JSON:
{
  "productDescription": "3-4 sentence plain-English description",
  "targetCustomers": ["who pays"],
  "endUsers": ["who uses it"],
  "businessModel": "most likely model(s), labelled as analysis if not stated",
  "marketDescription": "market + why now, 2-3 sentences, no made-up numbers",
  "competitors": ["real comparable companies / adjacent players investors know (e.g. kids fintech, kid-safe platforms)"],
  "differentiation": ["..."],
  "fundingUse": ["likely uses of a pre-seed/seed round"],
  "risksInvestorsWillAsk": ["tough questions investors will ask"],
  "investorKeywords": ["10-15 short theme keywords investors use, e.g. family tech, kids fintech, edtech, child safety"],
  "investorTypesToTarget": ["e.g. Angel", "Micro-VC", "Angel Group", "Family Office", "Corporate VC"],
  "linkedinSearchQueries": ["6 Google queries that find PUBLIC LinkedIn profiles of relevant investors. Each MUST start with site:linkedin.com/in and use quoted phrases, e.g. site:linkedin.com/in \\"angel investor\\" \\"family tech\\""],
  "webSearchQueries": ["8 web queries that find specific relevant funds/angels/angel groups and lists of investors in comparable startups, e.g. \\"pre-seed venture fund\\" kids fintech portfolio, investors in Greenlight BusyKid early stage"],
  "confidence": 0-100
}`,
    3500
  );

  return {
    productDescription: str(out.productDescription),
    targetCustomers: arr(out.targetCustomers),
    endUsers: arr(out.endUsers),
    businessModel: str(out.businessModel),
    marketDescription: str(out.marketDescription),
    competitors: arr(out.competitors, 15),
    differentiation: arr(out.differentiation),
    fundingUse: arr(out.fundingUse),
    risksInvestorsWillAsk: arr(out.risksInvestorsWillAsk),
    investorKeywords: arr(out.investorKeywords, 20),
    investorTypesToTarget: arr(out.investorTypesToTarget),
    linkedinSearchQueries: arr(out.linkedinSearchQueries, 10).map(q => (/site:linkedin\.com/i.test(q) ? q : `site:linkedin.com/in ${q}`)),
    webSearchQueries: arr(out.webSearchQueries, 12),
    aiConfidence: clamp(out.confidence),
    aiGeneratedAt: new Date().toISOString()
  };
}

export function defaultQueries(s: StartupProfile, settings?: Partial<AppSettings>): { linkedin: string[]; web: string[] } {
  const kw = (s.investorKeywords?.length ? s.investorKeywords : ['family tech', 'kids fintech', 'edtech', 'parenting', 'child safety']).slice(0, 6);
  const linkedin = s.linkedinSearchQueries?.length
    ? s.linkedinSearchQueries
    : kw.slice(0, 5).map(k => `site:linkedin.com/in "angel investor" "${k}"`);
  const web = s.webSearchQueries?.length ? [...s.webSearchQueries] : kw.slice(0, 5).map(k => `pre-seed investors ${k} startups`);
  if (settings?.includeLocalAngelGroups !== false && s.location) {
    const city = s.location.split(',').slice(0, 2).join(' ');
    web.push(`angel investor groups ${city} early stage startups`);
  }
  return { linkedin, web };
}

// ---------------------------------------------------------------- Phase 2
type Log = (phase: PipelineExecutionLog['phase'], message: string, level?: PipelineExecutionLog['level'], investorName?: string) => void;
const noLog: Log = () => {};

const looksLikeList = (r: SearchResult) =>
  !isLinkedInProfile(r.url) &&
  /(top \d+|\d+ (best|top)|list of|investors (in|for|who)|best .*investors|angel (groups|networks)|directory|vc firms)/i.test(`${r.title} ${r.snippet}`);

export async function runSearches(queries: string[], perQuery = 10, log: Log = noLog): Promise<SearchResult[]> {
  const seen = new Set<string>();
  const all: SearchResult[] = [];
  for (const q of queries) {
    const { results, engine, errors } = await webSearch(q, perQuery);
    if (!results.length) {
      log('search', `No results for: ${q}${errors.length ? ` (${errors.join('; ').slice(0, 160)})` : ''}`, 'warn');
      continue;
    }
    let added = 0;
    for (const r of results) {
      const key = r.url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
      added++;
    }
    log('search', `${engine}: ${results.length} results (${added} new) — ${q}`, 'info');
  }
  return all;
}

export async function extractCandidates(
  s: StartupProfile,
  results: SearchResult[],
  existing: { name: string; firm: string }[],
  log: Log = noLog,
  maxListPages = 3
): Promise<DiscoveryCandidate[]> {
  // Read a few "list of investors" pages: they name many investors at once.
  const listPages: PageContent[] = [];
  for (const r of results.filter(looksLikeList).slice(0, maxListPages)) {
    const p = await readPage(r.url, 7000);
    if (p.text.length > 500) {
      listPages.push(p);
      log('extract', `Read investor list page: ${p.title || r.title}`, 'info');
    }
  }

  const evidenceBlocks: { id: string; url: string; text: string }[] = [
    ...results.map((r, i) => ({ id: `R${i + 1}`, url: r.url, text: `${r.title}\n${r.snippet}` })),
    ...listPages.map((p, i) => ({ id: `L${i + 1}`, url: p.url, text: `${p.title}\n${p.text}` }))
  ];
  const validUrls = new Set(evidenceBlocks.map(b => b.url));
  const linkedinByBlock = new Map(results.map((r, i) => [`R${i + 1}`, isLinkedInProfile(r.url) ? normalizeLinkedInUrl(r.url) : '']));

  const out: DiscoveryCandidate[] = [];
  const seen = new Set(existing.map(e => normKey(e.name) + '|' + normKey(e.firm)));
  const seenNames = new Set(existing.map(e => normKey(e.name)));

  // Batch so prompts stay small enough for free-tier models.
  const batches: (typeof evidenceBlocks)[] = [];
  let cur: typeof evidenceBlocks = [];
  let size = 0;
  for (const b of evidenceBlocks) {
    const len = Math.min(b.text.length, 7000);
    if (size + len > 14000 && cur.length) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push({ ...b, text: b.text.slice(0, 7000) });
    size += len;
  }
  if (cur.length) batches.push(cur);

  for (const batch of batches) {
    let parsed: any;
    try {
      parsed = await chatJson<any>(
        `You extract REAL, specific investors from search results for a startup's fundraising. ${HONESTY_RULES}
Only include an investor if the evidence text itself names them AND indicates they invest (angel, VC, partner, fund, angel group, family office, accelerator).
Skip journalists, founders who are not investors, recruiters, generic articles, and the startup itself.`,
        `STARTUP:\n${startupBrief(s).slice(0, 1800)}

EVIDENCE (id | url | text):
${batch.map(b => `[${b.id}] ${b.url}\n${b.text}`).join('\n\n---\n\n')}

Return JSON: {"investors":[{
 "name": "person name, or the firm name if no person is named",
 "firm": "fund / firm / angel group, or \\"Independent Angel\\"",
 "title": "e.g. Partner, Angel Investor, Managing Director",
 "investorType": "Angel | VC Fund | Micro-VC | Family Office | Angel Group | Accelerator | Corporate VC | Other",
 "location": "",
 "evidenceId": "the [id] where you saw them",
 "websiteUrl": "firm website ONLY if it appears in the evidence, else \\"\\"",
 "whyRelevant": "one sentence: why they may fit ${s.name}, based on the evidence"
}]}`,
        3500
      );
    } catch (e: any) {
      log('extract', `AI extraction failed for one batch: ${e?.message?.slice(0, 160)}`, 'warn');
      continue;
    }
    for (const c of Array.isArray(parsed?.investors) ? parsed.investors : []) {
      const name = str(c.name, 120);
      if (!name || name.length < 3) continue;
      const firm = str(c.firm, 120) || 'Independent Angel';
      const key = normKey(name) + '|' + normKey(firm);
      if (seen.has(key) || seenNames.has(normKey(name))) continue;
      const block = batch.find(b => b.id === str(c.evidenceId).replace(/[\[\]]/g, '')) || batch[0];
      let web = str(c.websiteUrl, 300);
      if (web && !(validUrls.has(web) || (/^https?:\/\//.test(web) && !isNonFirmUrl(web)))) web = '';
      const res = results.find(r => r.url === block.url);
      if (!web && res && !isLinkedInProfile(res.url) && !isNonFirmUrl(res.url) && !looksLikeList(res) && block.id.startsWith('R')) web = res.url;
      seen.add(key);
      seenNames.add(normKey(name));
      out.push({
        id: uid('cand'),
        name,
        firm,
        title: str(c.title, 120),
        investorType: asType(c.investorType),
        linkedinUrl: linkedinByBlock.get(block.id) || '',
        websiteUrl: web,
        sourceUrl: block.url,
        sourceTitle: block.text.split('\n')[0].slice(0, 160),
        snippet: block.text.split('\n').slice(1).join(' ').slice(0, 400),
        whyRelevant: str(c.whyRelevant, 400),
        location: str(c.location, 120)
      });
    }
  }
  log('extract', `AI identified ${out.length} new investor candidates`, out.length ? 'success' : 'warn');
  return out;
}

export async function discoverCandidates(
  s: StartupProfile,
  queries: string[],
  existing: { name: string; firm: string }[],
  log: Log = noLog
): Promise<{ candidates: DiscoveryCandidate[]; rawResults: SearchResult[] }> {
  const rawResults = await runSearches(queries, 10, log);
  if (!rawResults.length) return { candidates: [], rawResults };
  const candidates = await extractCandidates(s, rawResults, existing, log);
  return { candidates, rawResults };
}

// ---------------------------------------------------------------- Phase 3-5
export async function findLinkedInProfile(name: string, firm: string): Promise<string> {
  const q = `site:linkedin.com/in "${name}"${firm && !/independent/i.test(firm) ? ` ${firm}` : ''}`;
  const { results } = await webSearch(q, 6);
  const last = name.trim().split(/\s+/).pop()?.toLowerCase() || '';
  const hit = results.find(r => isLinkedInProfile(r.url) && (r.title.toLowerCase().includes(last) || r.url.toLowerCase().includes(last)));
  return hit ? normalizeLinkedInUrl(hit.url) : '';
}

async function findFirmWebsite(firm: string, name: string): Promise<{ url: string; snippets: SearchResult[] }> {
  const q = /independent|angel$/i.test(firm) ? `"${name}" angel investor portfolio` : `"${firm}" venture investor portfolio`;
  const { results } = await webSearch(q, 8);
  const token = normKey(firm.replace(/\b(the|capital|ventures?|partners|fund|vc|group|angels?|llc|inc)\b/gi, '')).slice(0, 6);
  const host = (u: string) => {
    try {
      return normKey(new URL(u).hostname);
    } catch {
      return '';
    }
  };
  const site = token.length >= 3 ? results.find(r => !isNonFirmUrl(r.url) && host(r.url).includes(token)) : undefined;
  return { url: site?.url || '', snippets: results };
}

function senderName(s: StartupProfile, settings?: Partial<AppSettings>) {
  return settings?.senderName || s.founderName || `${s.name} founding team`;
}

function fitStatus(total: number): 'hot' | 'warm' | 'cold' {
  return total >= 75 ? 'hot' : total >= 55 ? 'warm' : 'cold';
}

function normalizeFit(f: any): InvestorFitScore {
  const thesisMatch = clamp(f?.thesisMatch);
  const stageMatch = clamp(f?.stageMatch);
  const sectorMatch = clamp(f?.sectorMatch);
  const checkSizeMatch = clamp(f?.checkSizeMatch);
  const synergyMatch = clamp(f?.synergyMatch);
  const computed = Math.round(thesisMatch * 0.3 + stageMatch * 0.2 + sectorMatch * 0.25 + checkSizeMatch * 0.1 + synergyMatch * 0.15);
  const total = f?.total != null ? clamp(f.total) : computed;
  return {
    total,
    thesisMatch,
    stageMatch,
    sectorMatch,
    checkSizeMatch,
    synergyMatch,
    status: fitStatus(total),
    verdict: str(f?.verdict, 400),
    whyInvest: arr(f?.whyInvest, 5),
    hesitations: arr(f?.hesitations, 5),
    keyTalkingPoint: str(f?.keyTalkingPoint, 400)
  };
}

function normalizeSequence(seq: any): EmailSequenceStep[] {
  const delays = [0, 4, 10, 21];
  return (Array.isArray(seq) ? seq : []).slice(0, 4).map((x: any, i: number) => ({
    stepNumber: i + 1,
    dayDelay: Number.isFinite(Number(x?.dayDelay)) ? Number(x.dayDelay) : delays[i],
    stepName: str(x?.stepName, 80) || ['Intro', 'Follow-up', 'Value add', 'Close the loop'][i],
    subject: str(x?.subject, 160),
    body: str(x?.body, 3000),
    rationale: str(x?.rationale, 300)
  }));
}

const OUTREACH_SPEC = (s: StartupProfile, settings?: Partial<AppSettings>) => `"outreach": {
  "sequence": [4 emails: {"stepName","dayDelay" (0,4,10,21),"subject","body","rationale"}],
  "linkedinNote": "LinkedIn connection request note, MAX 280 characters, personal, no links",
  "linkedinMessage": "LinkedIn DM to send after they accept, 60-110 words"
}
Outreach rules: write as ${senderName(s, settings)} from ${s.name}. Email 1 is 80-130 words, opens with something SPECIFIC to this investor (their thesis or a portfolio company FROM THE EVIDENCE), one-line pitch, why them, a soft ask (15-min call or deck). Follow-ups are shorter and add new value. Final email politely closes the loop. Plain text, no placeholders like [Name] except [Calendly link] / [Deck link] if needed. Do not claim traction that was not given. Sign off with "${senderName(s, settings)}".`;

export async function researchCandidate(
  s: StartupProfile,
  c: DiscoveryCandidate,
  settings?: Partial<AppSettings>,
  log: Log = noLog
): Promise<Investor> {
  const who = c.name;
  const evidence: string[] = [];
  const sources = new Set<string>([c.sourceUrl].filter(Boolean));
  evidence.push(`DISCOVERY SOURCE (${c.sourceUrl}): ${c.sourceTitle}\n${c.snippet}`);

  // 1. LinkedIn (public profile URL via search engine — never scraped)
  let linkedin = c.linkedinUrl;
  if (!linkedin && settings?.lookupLinkedInProfiles !== false && c.investorType !== 'Angel Group' && c.name !== c.firm) {
    linkedin = await findLinkedInProfile(c.name, c.firm).catch(() => '');
    if (linkedin) log('research', `Found public LinkedIn profile`, 'info', who);
  }

  // 2. Website
  let website = c.websiteUrl;
  const look = await findFirmWebsite(c.firm, c.name).catch(() => ({ url: '', snippets: [] as SearchResult[] }));
  if (!website) website = look.url;
  for (const r of look.snippets.slice(0, 6)) {
    evidence.push(`SEARCH (${r.url}): ${r.title} — ${r.snippet}`);
  }

  const emails = new Set<string>();
  let crawl = { title: '', description: '', excerpt: '', url: website };
  if (website && canFetch(website)) {
    const home = await readPage(website, 6000);
    if (home.text) {
      sources.add(home.url);
      crawl = { title: home.title, description: home.description, excerpt: home.text.slice(0, 1500), url: home.url };
      home.emails.forEach(e => emails.add(e));
      evidence.push(`WEBSITE ${home.url} — ${home.title}\n${home.description}\n${home.text}`);
      for (const sub of pickUsefulSubpages(home, 2)) {
        const p = await readPage(sub, 4000);
        if (p.text) {
          sources.add(p.url);
          p.emails.forEach(e => emails.add(e));
          evidence.push(`PAGE ${p.url}\n${p.text}`);
        }
      }
      log('research', `Read ${website.replace(/^https?:\/\//, '').slice(0, 50)} (${home.via})`, 'info', who);
    } else {
      log('research', `Could not read ${website}`, 'warn', who);
    }
  }

  const evidenceText = evidence.join('\n\n---\n\n').slice(0, 16000);
  const emailList = [...emails];

  const out = await chatJson<any>(
    `You are a VC research analyst + fundraising copywriter for ${s.name}. Today is ${today()}. ${HONESTY_RULES}`,
    `STARTUP:
${startupBrief(s)}

INVESTOR CANDIDATE: ${c.name} — ${c.title || ''} @ ${c.firm} (${c.investorType})
Why discovered: ${c.whyRelevant}

EVIDENCE COLLECTED FROM THE PUBLIC WEB:
${evidenceText}

Emails found on their site: ${emailList.join(', ') || 'none'}

Return JSON:
{
 "profile": {
   "title": "", "firm": "", "investorType": "Angel | VC Fund | Micro-VC | Family Office | Angel Group | Accelerator | Corporate VC | Other",
   "location": "", "stage": "Pre-seed | Seed | Series A | Growth | All Stages | Unknown",
   "checkSizeFormatted": "e.g. $25k - $100k, or Unknown", "checkSizeMin": number or 0, "checkSizeMax": number or 0,
   "industries": ["focus areas FROM EVIDENCE"], "portfolio": ["portfolio companies named IN EVIDENCE"],
   "recentInvestments": [{"name":"","year":"","sector":"","note":""}],
   "thesis": "their stated thesis, from evidence", "contactRoute": "best legitimate route: e.g. 'Email partner', 'Website pitch form', 'LinkedIn connection', 'Warm intro preferred'",
   "email": "ONLY an email from the list above that belongs to this investor/firm, else \\"\\"",
   "twitter": "", "keyQuotes": ["short quotes copied from evidence"]
 },
 "isRealInvestor": true/false (false if evidence suggests this is not an active investor),
 "fit": {"thesisMatch":0-100,"stageMatch":0-100,"sectorMatch":0-100,"checkSizeMatch":0-100,"synergyMatch":0-100,"total":0-100,
         "verdict":"one sentence","whyInvest":["3 evidence-based reasons"],"hesitations":["2 honest concerns"],"keyTalkingPoint":"the single best hook for outreach"},
 "researchNotes": "4-6 sentences: who they are, what they invest in, what you could NOT verify",
 ${OUTREACH_SPEC(s, settings)}
}
Scoring guide: 80+ = clear thesis + stage match for a kids/family consumer app; 55-79 = adjacent (consumer, edtech, fintech generalist); <55 = weak/unclear. Be strict when evidence is thin.`,
    5000
  );

  const p = out?.profile || {};
  const fit = normalizeFit(out?.fit);
  if (out?.isRealInvestor === false) {
    fit.total = Math.min(fit.total, 30);
    fit.status = 'cold';
    fit.hesitations = ['Evidence suggests this may not be an active investor — verify before contacting.', ...fit.hesitations].slice(0, 5);
  }
  const email = str(p.email, 200).toLowerCase();
  // Only keep an email that was really published AND belongs to this investor's own site (or a personal mailbox).
  const siteRoot = (() => {
    try {
      return new URL(website).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
    } catch {
      return '';
    }
  })();
  const emailDomain = email.split('@')[1] || '';
  const domainOk = /^(gmail|googlemail|outlook|hotmail|icloud|yahoo|proton|protonmail)\./.test(emailDomain) || (!!siteRoot && emailDomain.endsWith(siteRoot));
  const verifiedEmail = email && emailList.includes(email) && domainOk ? email : '';
  const portfolio = arr(p.portfolio, 25);
  const now = new Date().toISOString();

  return {
    id: uid('inv'),
    name: c.name,
    title: str(p.title, 120) || c.title || 'Investor',
    firm: str(p.firm, 120) || c.firm,
    investorType: asType(p.investorType || c.investorType),
    website: website || '',
    email: verifiedEmail,
    linkedin: linkedin || '',
    twitter: str(p.twitter, 80),
    location: str(p.location, 120) || c.location || '',
    stage: asStage(p.stage),
    checkSizeFormatted: str(p.checkSizeFormatted, 60) || 'Unknown',
    checkSizeMin: Number(p.checkSizeMin) || 0,
    checkSizeMax: Number(p.checkSizeMax) || 0,
    industries: arr(p.industries, 12),
    portfolio,
    recentInvestments: (Array.isArray(p.recentInvestments) ? p.recentInvestments : []).slice(0, 6).map((r: any) => ({
      name: str(r?.name, 80),
      year: str(r?.year, 10),
      sector: str(r?.sector, 80),
      note: str(r?.note, 200)
    })).filter((r: any) => r.name),
    thesis: str(p.thesis, 800),
    contactRoute: str(p.contactRoute, 120) || (verifiedEmail ? 'Email' : linkedin ? 'LinkedIn connection' : 'Website'),
    activePartner: c.name,
    fitScore: fit,
    researchNotes: str(out?.researchNotes, 2000),
    extractedData: {
      rawUrl: crawl.url || c.sourceUrl,
      crawledAt: now,
      pageTitle: crawl.title || c.sourceTitle,
      metaDescription: crawl.description,
      extractedTextExcerpt: crawl.excerpt || c.snippet,
      keyQuotes: arr(p.keyQuotes, 5),
      portfolioFound: portfolio,
      detectedCheckSize: str(p.checkSizeFormatted, 60),
      detectedContactEmail: verifiedEmail
    },
    sourceUrls: [...sources].slice(0, 8),
    linkedinNote: str(out?.outreach?.linkedinNote, 300),
    linkedinMessage: str(out?.outreach?.linkedinMessage, 1500),
    outreach: {
      status: fit.status === 'hot' ? 'hot' : fit.status === 'warm' ? 'warm' : 'researched',
      sequenceGenerated: true,
      sequences: normalizeSequence(out?.outreach?.sequence),
      sentStepsCount: 0
    },
    tags: ['AI researched', c.investorType, linkedin ? 'LinkedIn found' : ''].filter(Boolean) as string[],
    createdAt: now,
    updatedAt: now
  };
}

function investorBrief(i: Investor): string {
  return [
    `Name: ${i.name} — ${i.title} @ ${i.firm} (${i.investorType || ''})`,
    `Location: ${i.location}`,
    `Stage: ${i.stage}; Check: ${i.checkSizeFormatted}`,
    `Industries: ${i.industries.join(', ')}`,
    `Portfolio: ${i.portfolio.join(', ')}`,
    `Thesis: ${i.thesis}`,
    `Research notes: ${i.researchNotes}`,
    i.extractedData?.extractedTextExcerpt ? `Website excerpt: ${i.extractedData.extractedTextExcerpt.slice(0, 1500)}` : ''
  ].join('\n');
}

export async function scoreInvestor(s: StartupProfile, i: Investor): Promise<{ fitScore: InvestorFitScore; researchNotes: string }> {
  const out = await chatJson<any>(
    `You are a VC analyst scoring investor fit for ${s.name}. ${HONESTY_RULES}`,
    `STARTUP:\n${startupBrief(s)}\n\nINVESTOR:\n${investorBrief(i)}\n\nReturn JSON: {"fit": {"thesisMatch":0-100,"stageMatch":0-100,"sectorMatch":0-100,"checkSizeMatch":0-100,"synergyMatch":0-100,"total":0-100,"verdict":"","whyInvest":["3"],"hesitations":["2"],"keyTalkingPoint":""}, "researchNotes": "updated 3-5 sentence notes"}
Be strict when information is thin.`,
    2000
  );
  return { fitScore: normalizeFit(out?.fit), researchNotes: str(out?.researchNotes, 2000) || i.researchNotes };
}

export async function generateOutreach(
  s: StartupProfile,
  i: Investor,
  settings?: Partial<AppSettings>
): Promise<{ sequences: EmailSequenceStep[]; linkedinNote: string; linkedinMessage: string }> {
  const out = await chatJson<any>(
    `You are an expert fundraising copywriter for ${s.name}. ${HONESTY_RULES}`,
    `STARTUP:\n${startupBrief(s)}\n\nINVESTOR:\n${investorBrief(i)}\nBest hook: ${i.fitScore?.keyTalkingPoint || ''}\n\nReturn JSON: {${OUTREACH_SPEC(s, settings)}}`,
    3000
  );
  return {
    sequences: normalizeSequence(out?.outreach?.sequence ?? out?.sequence),
    linkedinNote: str(out?.outreach?.linkedinNote ?? out?.linkedinNote, 300),
    linkedinMessage: str(out?.outreach?.linkedinMessage ?? out?.linkedinMessage, 1500)
  };
}

// ---------------------------------------------------------------- One-click autonomous run
const jobs = new Map<string, AgentJob & { cancel?: boolean }>();

export function getJob(id: string) {
  return jobs.get(id);
}
export function latestJob() {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}
export function cancelJob(id: string) {
  const j = jobs.get(id);
  if (j && j.status === 'running') j.cancel = true;
  return !!j;
}

export function startAgentJob(
  s: StartupProfile,
  settings: AppSettings,
  existing: { name: string; firm: string }[],
  opts: { refreshProduct?: boolean; extraQueries?: string[] } = {}
): AgentJob {
  // keep memory small
  for (const [id, j] of jobs) if (j.status !== 'running' && Date.now() - Date.parse(j.startedAt) > 6 * 3600_000) jobs.delete(id);
  const running = [...jobs.values()].find(j => j.status === 'running');
  if (running) return running;

  const job: AgentJob & { cancel?: boolean } = { id: uid('job'), status: 'running', startedAt: new Date().toISOString(), progress: 0, logs: [], investors: [] };
  jobs.set(job.id, job);
  const log: Log = (phase, message, level = 'info', investorName) => {
    job.logs.push({ id: uid('log'), timestamp: new Date().toISOString(), phase, message, level, investorName });
    if (job.logs.length > 600) job.logs.splice(0, job.logs.length - 600);
  };

  (async () => {
    let startup = { ...s };
    try {
      // Phase 1
      if (opts.refreshProduct || !startup.investorKeywords?.length || !startup.linkedinSearchQueries?.length) {
        log('product', `Phase 1 — analysing ${startup.name}${startup.website ? ` (reading ${startup.website})` : ''}…`);
        const intel = await analyzeProduct(startup, settings);
        startup = { ...startup, ...intel };
        job.startupUpdate = intel;
        log('product', `Product understood (confidence ${intel.aiConfidence}%). Investor themes: ${(intel.investorKeywords || []).slice(0, 6).join(', ')}`, 'success');
      } else {
        log('product', `Using saved product intelligence for ${startup.name}`, 'info');
      }
      job.progress = 10;
      if (job.cancel) throw new Error('cancelled');

      // Phase 2
      const q = defaultQueries(startup, settings);
      const queries = [...q.linkedin.slice(0, 5), ...q.web.slice(0, 6), ...(opts.extraQueries || [])];
      log('search', `Phase 2 — running ${queries.length} searches (public LinkedIn profiles + investor websites)…`);
      const { candidates } = await discoverCandidates(startup, queries, existing, (ph, m, l, n) => {
        log(ph, m, l, n);
        if (ph === 'search') job.progress = Math.min(30, job.progress + 2);
      });
      job.progress = 35;
      if (!candidates.length) {
        log('extract', 'No new investors found this run. Try again later, add search keys (Tavily/Serper), or edit search queries in the Brain tab.', 'warn');
      }

      // Phase 3-5
      const target = candidates.slice(0, Math.max(1, settings.leadsPerRun || 10));
      log('research', `Phase 3-5 — researching, scoring and writing outreach for ${target.length} investors…`);
      let kept = 0;
      for (let idx = 0; idx < target.length; idx++) {
        if (job.cancel) throw new Error('cancelled');
        const c = target[idx];
        log('research', `Researching ${c.name}${c.firm && c.firm !== c.name && !/independent/i.test(c.firm) ? ` (${c.firm})` : ''}…`, 'info', c.name);
        try {
          const inv = await researchCandidate(startup, c, settings, log);
          if (inv.fitScore.total < (settings.minFitScoreToKeep ?? 0)) {
            log('score', `Fit ${inv.fitScore.total}/100 — below your minimum (${settings.minFitScoreToKeep}), skipped`, 'warn', c.name);
          } else {
            job.investors.push(inv);
            kept++;
            log('score', `Fit ${inv.fitScore.total}/100 (${inv.fitScore.status.toUpperCase()}) — ${inv.fitScore.verdict}`, 'success', c.name);
            log('outreach', `Drafted 4-step email cadence + LinkedIn note${inv.email ? ` (email found: ${inv.email})` : ''}`, 'success', c.name);
          }
        } catch (e: any) {
          log('research', `Failed: ${String(e?.message || e).slice(0, 200)}`, 'error', c.name);
          if (/No AI key/i.test(String(e?.message))) throw e;
        }
        job.progress = Math.round(35 + ((idx + 1) / target.length) * 63);
      }
      job.progress = 100;
      job.status = 'done';
      log('crm', `Done — ${kept} investors added to your CRM.`, 'success');
    } catch (e: any) {
      const msg = String(e?.message || e);
      job.status = msg === 'cancelled' ? 'cancelled' : 'error';
      job.error = msg;
      log('system', msg === 'cancelled' ? `Stopped. ${job.investors.length} investors were saved before stopping.` : `Run failed: ${msg}`, msg === 'cancelled' ? 'warn' : 'error');
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  })();

  return job;
}
