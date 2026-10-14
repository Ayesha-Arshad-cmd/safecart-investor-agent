/**
 * Talks to the free Gmail helper script (google-apps-script/Code.gs) that runs in the founder's
 * own Google account. Railway's free plan blocks normal email (SMTP), but this goes over HTTPS
 * and the email is actually sent by Gmail itself — from your real address, $0.
 *
 *   GMAIL_SCRIPT_URL     the Web app URL from Apps Script (ends with /exec)
 *   GMAIL_SCRIPT_SECRET  the same SECRET you typed into the script
 */
const env = (k: string) => (process.env[k] || '').trim();

export function gmailConfigured(): boolean {
  return /^https:\/\/script\.google\.com\/.+\/exec$/.test(env('GMAIL_SCRIPT_URL')) && !!env('GMAIL_SCRIPT_SECRET');
}

async function call(payload: Record<string, unknown>, timeoutMs = 60000): Promise<any> {
  if (!gmailConfigured()) throw new Error('Gmail helper not set up (GMAIL_SCRIPT_URL / GMAIL_SCRIPT_SECRET).');
  const res = await fetch(env('GMAIL_SCRIPT_URL'), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, secret: env('GMAIL_SCRIPT_SECRET') }),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      /<html|<!doctype/i.test(text)
        ? 'Gmail helper returned a web page instead of data — redeploy it with "Who has access: Anyone".'
        : `Gmail helper error ${res.status}`
    );
  }
  if (!data.ok) throw new Error(`Gmail helper: ${data.error || 'failed'}`);
  return data;
}

export async function gmailSend(
  to: string,
  subject: string,
  body: string,
  opts: { replyTo?: string; fromName?: string } = {}
): Promise<{ ok: boolean; threadId?: string; remaining?: number; error?: string }> {
  try {
    const r = await call({ action: 'send', to, subject, body, replyTo: opts.replyTo, fromName: opts.fromName });
    return { ok: true, threadId: r.threadId, remaining: r.remaining };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function gmailCheck(emails: string[], days = 60): Promise<{
  replies: { email: string; date: string; subject: string; snippet: string }[];
  accepted: { name: string; date: string }[];
  remaining?: number;
}> {
  const r = await call({ action: 'check', emails, days }, 120000);
  return { replies: r.replies || [], accepted: r.accepted || [], remaining: r.remaining };
}

export async function gmailQuota(): Promise<number | undefined> {
  try {
    return (await call({ action: 'quota' }, 20000)).remaining;
  } catch {
    return undefined;
  }
}
