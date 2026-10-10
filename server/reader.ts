/**
 * Website reader (replaces the fake "Firecrawl" simulation).
 * Fetches a public page and turns it into clean text the AI can read.
 * Falls back to the free Jina Reader (r.jina.ai, no key needed) for
 * JavaScript-heavy sites. LinkedIn pages are never fetched.
 */

export interface PageContent {
  url: string;
  title: string;
  description: string;
  text: string;
  emails: string[];
  links: { href: string; text: string }[];
  via: 'direct' | 'jina' | 'failed';
  error?: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const BLOCKED_HOSTS = /(^|\.)linkedin\.com$|(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/i;

export function canFetch(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    if (BLOCKED_HOSTS.test(u.hostname)) return false;
    // never let the server be pointed at private network addresses
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$)/i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JUNK_EMAIL = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|example\.com|sentry|wixpress|domain\.com|email\.com|yourname|@2x)/i;

export function extractEmails(text: string): string[] {
  const found = (text.match(EMAIL_RE) || []).map(e => e.toLowerCase().replace(/\.$/, ''));
  return [...new Set(found.filter(e => !JUNK_EMAIL.test(e)))].slice(0, 10);
}

export function htmlToContent(html: string, url: string): Omit<PageContent, 'via'> {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim());
  const description = decode(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ||
      ''
  );

  const links: { href: string; text: string }[] = [];
  const linkRe = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < 300) {
    try {
      const href = new URL(decode(m[1]), url).toString();
      const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      links.push({ href, text: text.slice(0, 80) });
    } catch {
      /* ignore bad hrefs */
    }
  }

  const mailtos = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map(x => decodeURIComponent(x[1]));

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<h(\d)[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');
  body = decode(body)
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return { url, title, description, text: body, emails: extractEmails(mailtos.join(' ') + ' ' + body), links };
}

async function viaJina(url: string): Promise<PageContent> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`jina ${res.status}`);
  const md = await res.text();
  const title = md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || '';
  const links = [...md.matchAll(/\[([^\]]{1,80})\]\((https?:\/\/[^)\s]+)\)/g)].slice(0, 300).map(x => ({ text: x[1], href: x[2] }));
  return { url, title, description: '', text: md, emails: extractEmails(md), links, via: 'jina' };
}

/** Fetch a page; never throws. */
export async function readPage(url: string, maxChars = 12000): Promise<PageContent> {
  if (!canFetch(url)) return { url, title: '', description: '', text: '', emails: [], links: [], via: 'failed', error: 'not fetchable' };
  let direct: PageContent | null = null;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    const type = res.headers.get('content-type') || '';
    if (res.ok && /html|text/i.test(type)) {
      const html = (await res.text()).slice(0, 1_500_000);
      direct = { ...htmlToContent(html, res.url || url), via: 'direct' };
    }
  } catch {
    /* try jina */
  }
  if (!direct || direct.text.length < 400) {
    try {
      const j = await viaJina(url);
      if (j.text.length > (direct?.text.length || 0)) direct = j;
    } catch (e: any) {
      if (!direct) return { url, title: '', description: '', text: '', emails: [], links: [], via: 'failed', error: e?.message };
    }
  }
  direct!.text = direct!.text.slice(0, maxChars);
  return direct!;
}

/** Pick the most useful sub-pages (portfolio / team / about / thesis / contact) on the same site. */
export function pickUsefulSubpages(page: PageContent, max = 2): string[] {
  let host = '';
  try {
    host = new URL(page.url).hostname.replace(/^www\./, '');
  } catch {
    return [];
  }
  const score = (l: { href: string; text: string }) => {
    const s = `${l.href} ${l.text}`.toLowerCase();
    if (/portfolio|companies|investments/.test(s)) return 5;
    if (/thesis|focus|approach|what-we-invest|philosophy/.test(s)) return 4;
    if (/team|people|partners|about/.test(s)) return 3;
    if (/contact|pitch|submit|apply/.test(s)) return 2;
    return 0;
  };
  const seen = new Set<string>([page.url.replace(/\/$/, '')]);
  return page.links
    .filter(l => {
      try {
        return new URL(l.href).hostname.replace(/^www\./, '') === host;
      } catch {
        return false;
      }
    })
    .map(l => ({ href: l.href.split('#')[0].replace(/\/$/, ''), s: score(l) }))
    .filter(l => l.s > 0 && !seen.has(l.href) && (seen.add(l.href), true))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map(l => l.href);
}
