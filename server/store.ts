/**
 * Tiny JSON-file database (the real "CRM" storage — replaces browser-only localStorage).
 * Set DATA_DIR to a Railway Volume mount path (e.g. /data) so data survives redeploys.
 * No database server, no install, $0.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface StoredState {
  startup: any | null;
  investors: any[];
  settings: any | null;
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

export function saveState(patch: Partial<StoredState>): StoredState {
  const cur = loadState();
  cache = {
    startup: patch.startup !== undefined ? patch.startup : cur.startup,
    investors: patch.investors !== undefined ? patch.investors : cur.investors,
    settings: patch.settings !== undefined ? patch.settings : cur.settings,
    updatedAt: new Date().toISOString()
  };
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, 300);
  return cache;
}

export function flushNow() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (cache) flush();
}
