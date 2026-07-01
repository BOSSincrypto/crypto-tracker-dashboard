/**
 * Local-first persistence layer.
 *
 * All portfolio data lives in `localStorage` under versioned keys. Reads
 * are cached in memory (portfolios list) and fail gracefully — a corrupt
 * or full storage never crashes the UI; it surfaces through the
 * {@link onStorageError} listener as a toast.
 *
 * Key layout:
 *   crypto-tracker:portfolios              → Portfolio[]
 *   crypto-tracker:active-portfolio        → id or ALL_PORTFOLIOS_ID
 *   crypto-tracker:transactions:<pid>      → Transaction[]
 *   crypto-tracker:snapshots:<pid>         → PortfolioSnapshot[]  (last 365)
 *
 * Legacy single-portfolio keys (`crypto-tracker:transactions`,
 * `crypto-tracker:snapshots`) are migrated into a default "Main" portfolio
 * on first load, then deleted.
 */
import type { Portfolio, PortfolioSnapshot, Transaction } from "./types";

/** Sentinel id used to represent the "All portfolios" aggregated view. */
export const ALL_PORTFOLIOS_ID = "__all__";

const PORTFOLIOS_KEY = "crypto-tracker:portfolios";
const ACTIVE_KEY = "crypto-tracker:active-portfolio";
const TX_PREFIX = "crypto-tracker:transactions:";
const SNAP_PREFIX = "crypto-tracker:snapshots:";
// legacy (pre multi-portfolio)
const LEGACY_TX = "crypto-tracker:transactions";
const LEGACY_SNAP = "crypto-tracker:snapshots";

/** True when running in a browser with localStorage available. SSR-safe. */
function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Read a JSON-encoded array from localStorage. Returns `[]` on any
 * failure (missing key, invalid JSON, non-array payload) — callers never
 * have to handle nulls.
 */
function readArr<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Callback invoked when a localStorage write fails (quota / serialization). */
type StorageErrorListener = (err: unknown, key: string) => void;
let storageErrorListener: StorageErrorListener | null = null;
/**
 * Subscribe to storage-write failures. Pass `null` to unsubscribe. Only
 * one listener is active at a time — the app sets it once at the root.
 */
export function onStorageError(fn: StorageErrorListener | null) {
  storageErrorListener = fn;
}

// ---------- change notifications ----------
// A monotonic counter that bumps on every mutation. Consumers can
// subscribe to be notified of writes (add/remove/update transactions,
// portfolio CRUD, snapshot appends). Used by the All-view aggregate to
// refresh when any single portfolio changes.
let dataVersion = 0;
const changeListeners = new Set<() => void>();
/** Current mutation counter (opaque monotonic value). */
export function getStorageVersion() {
  return dataVersion;
}
/** Subscribe to any storage mutation. Returns an unsubscribe function. */
export function subscribeStorage(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
function notifyChange() {
  dataVersion += 1;
  for (const fn of changeListeners) {
    try {
      fn();
    } catch {
      // never let a listener crash a mutation
    }
  }
}

/**
 * Persist an array to localStorage. Never throws — quota / serialization
 * errors are swallowed and surfaced via {@link onStorageError} so the UI
 * stays responsive.
 *
 * @returns `true` on success, `false` if the write was rejected.
 */
function writeArr<T>(key: string, value: T[]): boolean {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    storageErrorListener?.(err, key);
    return false;
  }
}

// ---------- portfolios ----------
/**
 * One-time migration: if a legacy (pre multi-portfolio) transactions/
 * snapshots blob exists, wrap it inside a default "Main" portfolio.
 * No-op after the first successful run.
 */
function migrateLegacy() {
  if (!isBrowser()) return;
  if (localStorage.getItem(PORTFOLIOS_KEY)) return;
  const id = crypto.randomUUID();
  const p: Portfolio = { id, name: "Main", createdAt: new Date().toISOString() };
  writeArr(PORTFOLIOS_KEY, [p]);
  localStorage.setItem(ACTIVE_KEY, id);
  const legacyTx = localStorage.getItem(LEGACY_TX);
  if (legacyTx) {
    localStorage.setItem(TX_PREFIX + id, legacyTx);
    localStorage.removeItem(LEGACY_TX);
  }
  const legacySnap = localStorage.getItem(LEGACY_SNAP);
  if (legacySnap) {
    localStorage.setItem(SNAP_PREFIX + id, legacySnap);
    localStorage.removeItem(LEGACY_SNAP);
  }
}

// In-memory cache — the portfolios list is read on virtually every render
// (active id lookup, All-view aggregation). Avoid repeated JSON.parse.
let portfoliosCache: Portfolio[] | null = null;
/** Drop the memoized portfolios list; next read will hit localStorage. */
function invalidatePortfoliosCache() {
  portfoliosCache = null;
}
/**
 * Load the portfolios list, creating a default "Main" portfolio on first
 * run. Cached — safe to call from hot paths.
 */
export function loadPortfolios(): Portfolio[] {
  if (!isBrowser()) return [];
  if (portfoliosCache) return portfoliosCache;
  migrateLegacy();
  let list = readArr<Portfolio>(PORTFOLIOS_KEY);
  if (list.length === 0) {
    const p: Portfolio = { id: crypto.randomUUID(), name: "Main", createdAt: new Date().toISOString() };
    list = [p];
    writeArr(PORTFOLIOS_KEY, list);
    localStorage.setItem(ACTIVE_KEY, p.id);
  }
  portfoliosCache = list;
  return list;
}

/** Persist the portfolios list and refresh the in-memory cache. */
export function savePortfolios(list: Portfolio[]) {
  writeArr(PORTFOLIOS_KEY, list);
  portfoliosCache = list;
  notifyChange();
}

/**
 * Get the currently active portfolio id, falling back to the first
 * portfolio when the stored id is stale.
 *
 * @returns Portfolio id, {@link ALL_PORTFOLIOS_ID}, or `""` when running
 *          outside a browser.
 */
export function getActivePortfolioId(): string {
  if (!isBrowser()) return "";
  const list = loadPortfolios();
  const current = localStorage.getItem(ACTIVE_KEY);
  // Preserve the special "All Portfolios" pseudo-id across reloads.
  if (current === ALL_PORTFOLIOS_ID) return current;
  if (current && list.some((p) => p.id === current)) return current;
  const first = list[0]?.id ?? "";
  if (first) localStorage.setItem(ACTIVE_KEY, first);
  return first;
}

/** Persist the active portfolio selection (accepts {@link ALL_PORTFOLIOS_ID}). */
export function setActivePortfolioId(id: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_KEY, id);
  notifyChange();
}

/**
 * Create and select a new portfolio. Empty names default to `"Untitled"`.
 *
 * @returns The created portfolio (now the active one).
 */
export function createPortfolio(name: string): Portfolio {
  const list = loadPortfolios();
  const p: Portfolio = { id: crypto.randomUUID(), name: name.trim() || "Untitled", createdAt: new Date().toISOString() };
  savePortfolios([...list, p]);
  setActivePortfolioId(p.id);
  return p;
}

/** Rename a portfolio in place. Trimmed empty names are ignored. */
export function renamePortfolio(id: string, name: string) {
  const list = loadPortfolios().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
  savePortfolios(list);
}

/**
 * Remove a portfolio and its associated transactions + snapshots.
 *
 * Guarantees at least one portfolio exists afterward — deleting the last
 * portfolio auto-creates a fresh "Main". Reselects the first portfolio if
 * the deleted one was active.
 */
export function deletePortfolio(id: string) {
  if (!isBrowser()) return;
  const list = loadPortfolios().filter((p) => p.id !== id);
  const next = list.length > 0 ? list : [{ id: crypto.randomUUID(), name: "Main", createdAt: new Date().toISOString() }];
  savePortfolios(next);
  localStorage.removeItem(TX_PREFIX + id);
  localStorage.removeItem(SNAP_PREFIX + id);
  if (getActivePortfolioId() === id) setActivePortfolioId(next[0].id);
  notifyChange();
}

// ---------- aggregate helpers (All-portfolios view) ----------
/** Flatten every portfolio's transactions into a single list (All-view). */
export function loadAllTransactions(): Transaction[] {
  return loadPortfolios().flatMap((p) => loadTransactions(p.id));
}

/**
 * Sum daily snapshots across every portfolio for the All-view chart.
 * Missing days in any portfolio are treated as zero contribution.
 *
 * @returns Snapshots sorted ascending by date.
 */
export function loadMergedSnapshots(): PortfolioSnapshot[] {
  const byDate = new Map<string, number>();
  for (const p of loadPortfolios()) {
    for (const s of loadSnapshots(p.id)) {
      byDate.set(s.date, (byDate.get(s.date) ?? 0) + s.totalValue);
    }
  }
  return [...byDate.entries()]
    .map(([date, totalValue]) => ({ date, totalValue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- per-portfolio data ----------
/** Read a portfolio's transactions. Empty id → `[]`. */
export function loadTransactions(portfolioId: string): Transaction[] {
  if (!portfolioId) return [];
  return readArr<Transaction>(TX_PREFIX + portfolioId);
}

/** Persist a portfolio's transactions. Empty id is a no-op. */
export function saveTransactions(portfolioId: string, txs: Transaction[]) {
  if (!portfolioId) return;
  writeArr(TX_PREFIX + portfolioId, txs);
  notifyChange();
}

/** Read a portfolio's historical daily-value snapshots. */
export function loadSnapshots(portfolioId: string): PortfolioSnapshot[] {
  if (!portfolioId) return [];
  return readArr<PortfolioSnapshot>(SNAP_PREFIX + portfolioId);
}

/** Persist a portfolio's historical daily-value snapshots. */
export function saveSnapshots(portfolioId: string, snaps: PortfolioSnapshot[]) {
  if (!portfolioId) return;
  writeArr(SNAP_PREFIX + portfolioId, snaps);
}

/**
 * Append today's total value to the snapshot history, deduping and
 * trimming the history to the last 365 days.
 *
 * If today's snapshot already exists and the new value is within
 * $0.005 of the stored one, the write is skipped — avoids churn on
 * every 60s price poll and prevents pointless downstream invalidation.
 *
 * @returns `true` when the snapshot storage actually changed.
 */
export function appendSnapshot(portfolioId: string, totalValue: number): boolean {
  if (!isBrowser() || !portfolioId) return false;
  const snaps = loadSnapshots(portfolioId);
  const today = new Date().toISOString().slice(0, 10);
  const existingIdx = snaps.findIndex((s) => s.date === today);
  if (existingIdx >= 0) {
    // Skip write if value is essentially unchanged (avoid triggering re-renders
    // and localStorage churn on every 60s price refetch).
    const prev = snaps[existingIdx].totalValue;
    if (Math.abs(prev - totalValue) < 0.005) return false;
    snaps[existingIdx] = { date: today, totalValue };
  } else {
    snaps.push({ date: today, totalValue });
  }
  const trimmed = snaps.slice(-365);
  saveSnapshots(portfolioId, trimmed);
  notifyChange();
  return true;
}