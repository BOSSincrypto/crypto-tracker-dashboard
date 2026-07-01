/**
 * Unified portfolio model.
 *
 * Wraps the pure calculation kernel (`calculations.ts`) into a single
 * reference-stable object so the whole dashboard subscribes to one source
 * of truth. Every table/chart takes the same `priced` / `summary`
 * references, so memoized components skip re-render when inputs
 * (transactions, prices) haven't actually changed.
 */
import { useMemo, useRef } from "react";
import { aggregateHoldings, calculateSummary, withPrices, type PortfolioSummary } from "./calculations";
import type { HoldingWithPrice, Holding, Transaction } from "./types";

/**
 * Extract the unique tradeable coin ids from a transaction list.
 *
 * O(n) single-pass Set scan — used to fire the CoinGecko price query
 * *before* the full model is built, so the query key stays decoupled
 * from price data. Cash/fiat rows (`deposit`, `withdraw`) are excluded.
 *
 * @param transactions Raw transaction list.
 * @returns Sorted unique coin ids (sort keeps the query key stable).
 */
export function deriveCoinIds(transactions: Transaction[]): string[] {
  const seen = new Set<string>();
  for (const tx of transactions) {
    if (tx.type === "deposit" || tx.type === "withdraw") continue;
    if (tx.coinId) seen.add(tx.coinId);
  }
  // Sorted for stable query keys — matches the sort done in useCoinPrices.
  return Array.from(seen).sort();
}

/** Full model bundle derived from `(transactions, prices)`. */
export interface PortfolioModel {
  /** Open + closed positions (with realized P&L). */
  holdings: Holding[];
  /** Open positions only, enriched with live prices. */
  priced: HoldingWithPrice[];
  /** Portfolio-wide totals: value, invested, P&L, fees, deposits, etc. */
  summary: PortfolioSummary;
  /** Unique coin ids currently open — the set to fetch prices for. */
  coinIds: string[];
}

/**
 * Build the full portfolio model in a single pass.
 *
 * Pure (no React, no I/O) — the hook wrapper below adds caching. Kept
 * exported so tests and future non-hook consumers can call it directly.
 *
 * @param transactions Raw transaction list.
 * @param prices       Map of `coinId → USD price`. Missing ids are
 *                     tolerated by {@link withPrices} (cost-basis fallback).
 */
export function buildPortfolioModel(
  transactions: Transaction[],
  prices: Record<string, number>,
): PortfolioModel {
  const holdings = aggregateHoldings(transactions);
  const priced = withPrices(holdings, prices);
  const summary = calculateSummary(holdings, priced, transactions);
  const coinIds = holdings.filter((h) => h.amount > 0).map((h) => h.coinId);
  return { holdings, priced, summary, coinIds };
}

/**
 * React hook wrapper around {@link buildPortfolioModel} that returns a
 * reference-stable {@link PortfolioModel}.
 *
 * Cache key is the *identity* of `transactions` and `prices`. `useCoinPrices`
 * already dedupes prices that round to the same 4 decimals, so a 60s poll
 * returning unchanged prices doesn't invalidate this cache — memoized
 * tables and charts skip render entirely.
 *
 * @param transactions Portfolio transactions.
 * @param prices       Coin id → USD price map (may be empty during load).
 * @returns A model whose `priced`, `summary`, `holdings` and `coinIds`
 *          references are stable across calls with identical inputs.
 */
export function usePortfolioModel(
  transactions: Transaction[],
  prices: Record<string, number>,
): PortfolioModel {
  const cacheRef = useRef<{
    tx: Transaction[];
    prices: Record<string, number>;
    model: PortfolioModel;
  } | null>(null);

  return useMemo(() => {
    const cached = cacheRef.current;
    if (cached && cached.tx === transactions && cached.prices === prices) {
      return cached.model;
    }
    const model = buildPortfolioModel(transactions, prices);
    cacheRef.current = { tx: transactions, prices, model };
    return model;
  }, [transactions, prices]);
}