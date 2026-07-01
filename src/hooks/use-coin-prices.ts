/**
 * Live-price hook backed by TanStack Query + CoinGecko.
 *
 * Guarantees:
 * - Query key is deduped + sorted so different orderings share a cache entry.
 * - Polling pauses while the tab is hidden (rate-limit + battery friendly).
 * - Returned `data` object is *reference-stable* across ticks where every
 *   price rounds to the same 4 decimals — downstream memoized components
 *   don't re-render on sub-tick noise.
 */
import { useEffect, useMemo, useRef } from "react";
import { focusManager, useQuery } from "@tanstack/react-query";
import { getPrices } from "../lib/crypto/coingecko";

// Pause refetches while the tab is hidden — TanStack Query already respects
// `focusManager`, but the default focus signal doesn't include Page
// Visibility on all browsers. Wiring it explicitly avoids background polling
// on inactive tabs (saves CoinGecko rate-limit budget + client CPU).
/**
 * Wire the Page Visibility API into TanStack Query's focus manager once
 * per session. Idempotent and SSR-safe.
 */
let visibilityWired = false;
function wireVisibility() {
  if (visibilityWired || typeof document === "undefined") return;
  visibilityWired = true;
  focusManager.setEventListener((handleFocus) => {
    const onVis = () => handleFocus(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", () => handleFocus(true));
    return () => document.removeEventListener("visibilitychange", onVis);
  });
}

/**
 * Subscribe to live USD prices for a list of coin ids.
 *
 * @param coinIds CoinGecko coin ids. Order and duplicates don't matter —
 *                the internal query key is normalized.
 * @returns TanStack Query result with a reference-stable `data` map
 *          `{ [coinId]: usdPrice }`. Refetches every 60s while the tab
 *          is focused; paused when hidden.
 */
export function useCoinPrices(coinIds: string[]) {
  useEffect(() => wireVisibility(), []);
  // Dedupe + sort once per input change so the query key stays stable.
  const sorted = useMemo(() => {
    const uniq = Array.from(new Set(coinIds.filter(Boolean)));
    uniq.sort();
    return uniq;
  }, [coinIds]);
  const key = sorted.join(",");
  const query = useQuery({
    queryKey: ["coin-prices", key],
    queryFn: () => getPrices(sorted),
    enabled: sorted.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // Stabilize the returned `data` reference: a 60s refetch that returns the
  // same prices (to 4 decimals) should NOT invalidate downstream useMemo
  // chains (holdings valuation, analytics, charts).
  const stableRef = useRef<Record<string, number> | undefined>(undefined);
  const data = query.data;
  const stable = useMemo(() => {
    if (!data) return undefined;
    const prev = stableRef.current;
    if (prev && sameRoundedPrices(prev, data)) return prev;
    stableRef.current = data;
    return data;
  }, [data]);

  return { ...query, data: stable };
}

/**
 * Compare two price maps to 4 fractional digits. Used to decide whether
 * a poll returned "meaningfully" different data — sub-tick noise doesn't
 * change USD valuations rendered to 2–6 decimals.
 */
function sameRoundedPrices(a: Record<string, number>, b: Record<string, number>) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = a[k];
    const vb = b[k];
    if (vb === undefined) return false;
    // Compare to 6 significant figures — coarse enough to ignore sub-tick
    // noise, fine enough to detect real moves in micro-cap coins (SHIB etc.).
    if (va.toPrecision(6) !== vb.toPrecision(6)) return false;
  }
  return true;
}