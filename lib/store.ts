import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { buildSeed } from "./seed";
import type { ActionRecord, HistoryEntry, Status } from "./types";

/**
 * Storage backends, picked from the environment:
 * - Upstash Redis (Vercel Marketplace sets KV_REST_API_* or UPSTASH_REDIS_REST_*): durable, shared.
 * - On Vercel without Redis: /tmp (the deploy folder is read-only). Works, but resets on cold starts.
 * - Locally: data/actions.json.
 */
const REDIS_KEY = "fieldproof:actions";
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const DATA_FILE = process.env.VERCEL
  ? path.join("/tmp", "fieldproof-actions.json")
  : path.join(process.cwd(), "data", "actions.json");

export function storageKind(): "redis" | "tmp" | "file" {
  return redis ? "redis" : process.env.VERCEL ? "tmp" : "file";
}

// Serialise all writes within this process so concurrent requests can't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function readAll(): Promise<ActionRecord[]> {
  if (redis) {
    const stored = await redis.get<ActionRecord[]>(REDIS_KEY);
    if (stored) return stored;
  } else {
    try {
      return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  const seed = buildSeed();
  await writeAll(seed);
  return seed;
}

async function writeAll(records: ActionRecord[]): Promise<void> {
  if (redis) {
    await redis.set(REDIS_KEY, records);
    return;
  }
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(records, null, 2));
  await fs.rename(tmp, DATA_FILE);
}

export async function resetToSeed(): Promise<void> {
  await writeAll(buildSeed());
}

export async function getAction(actionId: string): Promise<ActionRecord | undefined> {
  return (await readAll()).find((r) => r.actionId === actionId);
}

/** Read-modify-write one record under the lock. */
export function updateAction(
  actionId: string,
  fn: (r: ActionRecord) => void,
): Promise<ActionRecord> {
  return locked(async () => {
    const all = await readAll();
    const rec = all.find((r) => r.actionId === actionId);
    if (!rec) throw new Error(`Action ${actionId} not found`);
    fn(rec);
    await writeAll(all);
    return rec;
  });
}

export function insertAction(
  build: (nextId: string) => ActionRecord,
): Promise<ActionRecord> {
  return locked(async () => {
    const all = await readAll();
    const maxNum = all.reduce((m, r) => {
      const n = parseInt(r.actionId.split("-").pop() ?? "0", 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const rec = build(`FP-2026-${String(maxNum + 1).padStart(4, "0")}`);
    all.unshift(rec);
    await writeAll(all);
    return rec;
  });
}

export function pushHistory(r: ActionRecord, status: Status, extra: Partial<HistoryEntry> = {}) {
  r.status = status;
  r.history.push({ status, timestamp: new Date().toISOString(), ...extra });
}
