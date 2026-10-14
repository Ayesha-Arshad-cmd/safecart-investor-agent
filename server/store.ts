/**
 * Tiny JSON-file database (the real "CRM" storage).
 * Set DATA_DIR to a Railway Volume mount path (e.g. /data) so data survives redeploys.
 * No database server, no install, $0.
 *
 * Both the browser AND the server (big runs, automatic emails) change investors,
 * so saves are merged per investor using `updatedAt` — nobody overwrites anybody.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface StoredState {
  startup: any | null;
  investors: any[];
  settings: any | null;
  /** The current / last big run (see campaign.ts). */
  campaign?: any | null;
  /** Search queries already used (query|page) so the next run finds NEW investors. */
  usedQueries?: string[];
  /** Automatic email + LinkedIn bookkeeping (see automation.ts). */
  automation?: {
    sentLog?: { at: string; investorId: string; step: number }[];
    lastRunAt?: string;
    lastCheckAt?: string;
    lastError?: string;
    recent?: { at: string; message: string; level: 'info' | 'success' | 'warn' | 'error' }[];
  };
  /** Ids the user deleted — stops background jobs from bringing them back. */
  deletedIds?: string[];
  updatedAt: string;
}

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'crm.json');

let cache: StoredState | null = null;
let writeTimer: NodeJS.Timeout | null = null;

export function storageInfo() {
  return {
    path: FILE,
    persistent: Boolean(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH) || !process.env.RAILWAY_ENVIRONMENT
  };
}

export function loadState(): StoredState {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    cache = { startup: null, investors: [], settings: null, updatedAt: '' };
  }
  if (!Array.isArray(cache!.investors)) cache!.investors = [];
  if (!Array.isArray(cache!.usedQueries)) cache!.usedQueries = [];
  if (!Array.isArray(cache!.deletedIds)) cache!.deletedIds = [];
  if (!cache!.automation) cache!.automation = {};
  return cache!;
}

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, FILE);
  } catch (e: any) {
    console.error('[store] write failed:', e?.message);
  }
}

function scheduleFlush() {
  cache!.updatedAt = new Date().toISOString();
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 300);
}

const time = (x: any) => Date.parse(x?.updatedAt || x?.createdAt || '') || 0;

/** Merge a list of investors into the database, keeping the newer copy of each one. */
export function mergeInvestors(incoming: any[], deletedIds: string[] = []): void {
  const st = loadState();
  if (deletedIds.length) {
    const del = new Set(deletedIds);
    st.investors = st.investors.filter(i => !del.has(i.id));
    st.deletedIds = [...new Set([...(st.deletedIds || []), ...deletedIds])].slice(-5000);
  }
  const deleted = new Set(st.deletedIds || []);
  const byId = new Map(st.investors.map(i => [i.id, i]));
  for (const inv of incoming || []) {
    if (!inv?.id || deleted.has(inv.id)) continue;
    const cur = byId.get(inv.id);
    if (!cur || time(inv) >= time(cur)) byId.set(inv.id, inv);
  }
  // keep newest first
  st.investors = [...byId.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  scheduleFlush();
}

/** Server-side change to one investor (automation / research). */
export function updateInvestor(id: string, fn: (inv: any) => any): any | null {
  const st = loadState();
  const idx = st.investors.findIndex(i => i.id === id);
  if (idx === -1) return null;
  const next = { ...fn(st.investors[idx]), updatedAt: new Date().toISOString() };
  st.investors[idx] = next;
  scheduleFlush();
  return next;
}

/** Remove everything (Clear CRM). */
export function clearInvestors(): void {
  const st = loadState();
  st.deletedIds = [...new Set([...(st.deletedIds || []), ...st.investors.map(i => i.id)])].slice(-5000);
  st.investors = [];
  scheduleFlush();
}

export function saveState(patch: Partial<StoredState>): StoredState {
  const cur = loadState();
  for (const k of Object.keys(patch) as (keyof StoredState)[]) {
    if (patch[k] !== undefined && k !== 'investors') (cur as any)[k] = patch[k];
  }
  if (patch.investors !== undefined) cur.investors = patch.investors;
  scheduleFlush();
  return cur;
}

export function flushNow() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (cache) flush();
}
