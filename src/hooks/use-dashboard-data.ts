/**
 * Consolidates every piece of state the dashboard needs into one hook.
 *
 * Owns:
 *   - portfolio selection (single vs aggregated "All" view)
 *   - transactions for the active portfolio (or the merged All-view list)
 *   - live CoinGecko prices for every held coin
 *   - the derived portfolio model (holdings + summary)
 *   - daily value snapshots (single or merged), bumped only when actually written
 *   - storage-error toast wiring
 *
 * Rendering components stay dumb — they just consume the returned view.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useCoinPrices } from "./use-coin-prices";
import { usePortfolios } from "./use-portfolios";
import { useTransactions } from "./use-transactions";
import { deriveCoinIds, usePortfolioModel } from "@/lib/crypto/model";
import {
  ALL_PORTFOLIOS_ID,
  appendSnapshot,
  getStorageVersion,
  loadAllTransactions,
  loadMergedSnapshots,
  loadSnapshots,
  onStorageError,
  subscribeStorage,
} from "@/lib/crypto/storage";

// Stable empty reference so `prices` identity is constant while the query
// is pending — prevents cascading useMemo invalidation downstream.
const EMPTY_PRICES: Record<string, number> = Object.freeze({});

export function useDashboardData() {
  const portfoliosApi = usePortfolios();
  const { activeId } = portfoliosApi;
  const isAll = activeId === ALL_PORTFOLIOS_ID;

  const singleTx = useTransactions(isAll ? "" : activeId);

  // Subscribe to any storage mutation so aggregate views refresh reliably.
  const storageVersion = useSyncExternalStore(
    subscribeStorage,
    getStorageVersion,
    () => 0,
  );

  // Surface storage-quota / serialization failures once per app lifetime.
  useEffect(() => {
    onStorageError((err) => {
      const msg = err instanceof Error ? err.message : "Failed to save to browser storage.";
      toast.error("Storage error", { description: msg });
    });
    return () => onStorageError(null);
  }, []);

  // All-view aggregate. Rebuilt on any storage mutation so edits to any
  // single portfolio propagate here.
  const allTransactions = useMemo(
    () => (isAll ? loadAllTransactions() : []),
    [isAll, storageVersion],
  );

  const transactions = isAll ? allTransactions : singleTx.transactions;

  const coinIds = useMemo(() => deriveCoinIds(transactions), [transactions]);
  const pricesQuery = useCoinPrices(coinIds);
  const prices = pricesQuery.data ?? EMPTY_PRICES;
  const model = usePortfolioModel(transactions, prices);

  // Snapshots are persisted per-portfolio; `appendSnapshot` bumps
  // `storageVersion` when it actually writes, so the memo below
  // re-runs automatically — no separate local trigger needed.
  useEffect(() => {
    if (pricesQuery.isSuccess && activeId && !isAll) {
      appendSnapshot(activeId, model.summary.totalValue);
    }
  }, [pricesQuery.isSuccess, model.summary.totalValue, activeId, isAll]);

  const snapshots = useMemo(
    () => (isAll ? loadMergedSnapshots() : activeId ? loadSnapshots(activeId) : []),
    [isAll, activeId, storageVersion],
  );

  // Memoize the mutation API — a fresh reference each render defeats
  // memoization on children keyed off `tx`.
  const tx = useMemo(
    () => ({
      add: singleTx.addTransaction,
      remove: singleTx.removeTransaction,
      update: singleTx.updateTransaction,
      replaceAll: singleTx.replaceAll,
      mergeAll: singleTx.mergeAll,
    }),
    [
      singleTx.addTransaction,
      singleTx.removeTransaction,
      singleTx.updateTransaction,
      singleTx.replaceAll,
      singleTx.mergeAll,
    ],
  );

  return {
    portfolios: portfoliosApi,
    isAll,
    transactions,
    priced: model.priced,
    summary: model.summary,
    snapshots,
    pricesQuery,
    tx,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;