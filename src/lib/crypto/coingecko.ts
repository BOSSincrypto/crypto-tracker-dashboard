/**
 * CoinGecko API client.
 *
 * Thin wrapper around `fetch` with:
 * - Abort/timeout so a slow endpoint never hangs a React tree.
 * - One retry on 429 / 5xx responses that honors `Retry-After`.
 * - Automatic chunking of price requests to avoid URL length limits.
 * - Typed error messages that are safe to surface to end users.
 *
 * All prices are quoted in USD.
 */
import type { CoinSearchResult } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
/** Per-request abort after this many ms. Covers slow networks + hung TCP. */
const DEFAULT_TIMEOUT_MS = 8_000;
/** Max retry attempts on transient failures (429 / 5xx / timeout). */
const MAX_RETRIES = 2;
/**
 * CoinGecko `simple/price` accepts many ids, but very long URLs (many
 * hundreds of ids) can 414. Chunk to stay well under any URL limit and to
 * spread rate-limit consumption.
 */
const PRICE_CHUNK = 100;

/** Promise-based `setTimeout`. */
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Fetch JSON with resiliency features baked in.
 *
 * @param url   Fully-qualified request URL.
 * @param label Short human-readable label prepended to any thrown error
 *              (e.g. `"Prices"`, `"Search"`) so users see context.
 * @throws     A friendly `Error` on rate-limit exhaustion, timeout, or
 *             non-retryable HTTP failure. Never leaks raw fetch objects.
 */
async function fetchJSON<T>(url: string, label: string): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 400 * 2 ** attempt;
        attempt += 1;
        await sleep(Math.min(wait, 4_000));
        continue;
      }
      if (res.status === 429) {
        throw new Error(`${label}: CoinGecko rate limit reached. Try again in a moment.`);
      }
      throw new Error(`${label} failed: ${res.status}`);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        if (attempt < MAX_RETRIES) {
          attempt += 1;
          continue;
        }
        throw new Error(`${label}: request timed out.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Search CoinGecko's coin index by name/symbol.
 *
 * @param query User-typed search string. Whitespace-only returns `[]`
 *              without hitting the network.
 * @returns Up to 15 best matches, sorted by CoinGecko's own relevance.
 */
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query.trim()) return [];
  const data = await fetchJSON<{
    coins?: { id: string; symbol: string; name: string; thumb?: string }[];
  }>(`${BASE}/search?query=${encodeURIComponent(query)}`, "Search");
  const coins = Array.isArray(data.coins) ? data.coins : [];
  return coins.slice(0, 15).map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    thumb: c.thumb,
  }));
}

/**
 * Fetch current USD prices for a batch of coin ids.
 *
 * Silently chunks the input into groups of {@link PRICE_CHUNK} so callers
 * don't need to worry about URL limits. Ids that the API doesn't return
 * (unknown / delisted) are simply *absent* from the result map — callers
 * treat them as "unknown price" rather than $0.
 *
 * @param coinIds CoinGecko coin ids (e.g. `["bitcoin", "ethereum"]`).
 * @returns Map of `coinId → USD price` for ids the API resolved.
 */
export async function getPrices(coinIds: string[]): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {};
  // Split into URL-safe chunks and fetch in parallel — a user with
  // hundreds of coins pays one round-trip instead of N.
  const chunks: string[][] = [];
  for (let i = 0; i < coinIds.length; i += PRICE_CHUNK) {
    chunks.push(coinIds.slice(i, i + PRICE_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((chunk) => {
      const url = `${BASE}/simple/price?ids=${encodeURIComponent(chunk.join(","))}&vs_currencies=usd`;
      return fetchJSON<Record<string, { usd?: number }>>(url, "Prices");
    }),
  );
  const out: Record<string, number> = {};
  results.forEach((data, i) => {
    for (const id of chunks[i]) {
      const v = data[id]?.usd;
      // Only include ids the API returned a real number for. Missing ids
      // stay absent so callers can treat them as "unknown" rather than 0
      // (which would render as a full unrealized loss).
      if (typeof v === "number" && Number.isFinite(v)) out[id] = v;
    }
  });
  return out;
}

/**
 * Convenience wrapper around {@link getPrices} for a single id.
 *
 * @returns Current USD price, or `0` if the id is unknown to CoinGecko.
 */
export async function getCurrentPrice(coinId: string): Promise<number> {
  const prices = await getPrices([coinId]);
  return prices[coinId] ?? 0;
}