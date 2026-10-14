/**
 * SafeCart Kids Investor Agent — Gmail helper (free, runs inside YOUR Google account)
 *
 * What it does for the agent:
 *   • sends investor emails FROM your own Gmail (they appear in your Sent folder)
 *   • finds investor replies in your inbox (so follow-ups stop automatically)
 *   • finds LinkedIn "… accepted your invitation" emails (so the app knows who accepted)
 *
 * Setup (5 minutes) — see README "Automatic email (Gmail script)":
 *   1. Go to https://script.google.com → New project → paste this whole file.
 *   2. Change SECRET below to a long random password (same value as GMAIL_SCRIPT_SECRET on Railway).
 *   3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 *   4. Allow the Gmail permissions, copy the Web app URL into Railway as GMAIL_SCRIPT_URL.
 *
 * Limits (set by Google): about 100 emails/day on a normal Gmail, 1,500/day on Google Workspace.
 */

const SECRET = 'CHANGE-ME-to-a-long-random-password';

function doGet() {
  return json_({ ok: true, service: 'SafeCart Kids Gmail helper', remaining: MailApp.getRemainingDailyQuota() });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!SECRET || SECRET.indexOf('CHANGE-ME') === 0) return json_({ ok: false, error: 'Set SECRET in the script first.' });
    if (req.secret !== SECRET) return json_({ ok: false, error: 'Wrong secret' });
    if (req.action === 'send') return json_(send_(req));
    if (req.action === 'check') return json_(check_(req));
    if (req.action === 'quota') return json_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function send_(req) {
  if (!req.to || !req.subject || !req.body) return { ok: false, error: 'to, subject and body are required' };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, error: 'Gmail daily sending limit reached' };
  const opts = {};
  if (req.fromName) opts.name = req.fromName;
  if (req.replyTo) opts.replyTo = req.replyTo;
  const message = GmailApp.createDraft(req.to, req.subject, req.body, opts).send();
  return {
    ok: true,
    messageId: message.getId(),
    threadId: message.getThread().getId(),
    remaining: MailApp.getRemainingDailyQuota()
  };
}

function check_(req) {
  const days = Math.max(1, Math.min(180, Number(req.days) || 60));
  const emails = (req.emails || []).map(function (x) { return String(x).toLowerCase().trim(); }).filter(String);
  const replies = [];
  for (let i = 0; i < emails.length; i += 20) {
    const chunk = emails.slice(i, i + 20);
    const q = 'in:inbox newer_than:' + days + 'd from:(' + chunk.join(' OR ') + ')';
    GmailApp.search(q, 0, 100).forEach(function (thread) {
      thread.getMessages().forEach(function (m) {
        const raw = m.getFrom();
        const match = raw.match(/<([^>]+)>/);
        const from = (match ? match[1] : raw).toLowerCase().trim();
        if (chunk.indexOf(from) !== -1) {
          replies.push({ email: from, date: m.getDate().toISOString(), subject: m.getSubject(), snippet: m.getPlainBody().slice(0, 300) });
        }
      });
    });
  }
  const accepted = [];
  GmailApp.search('newer_than:' + days + 'd subject:"accepted your invitation"', 0, 200).forEach(function (thread) {
    const m = thread.getMessages()[0];
    const s = m.getSubject();
    const found = s.match(/(?:^|,\s*)([^,]+?)\s+(?:has\s+)?accepted your invitation/i);
    if (found) accepted.push({ name: found[1].trim(), date: m.getDate().toISOString() });
  });
  return { ok: true, replies: replies, accepted: accepted, remaining: MailApp.getRemainingDailyQuota() };
}
