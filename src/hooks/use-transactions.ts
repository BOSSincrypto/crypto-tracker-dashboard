/**
 * Stateful accessor for a single portfolio's transactions.
 *
 * Wraps the storage layer with React state so components re-render on
 * mutations, and surfaces read/write failures as toasts.
 *
 * @param portfolioId Active portfolio id. Empty string → hook is a no-op
 *                    (used for the aggregated "All-view" pseudo-portfolio).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadTransactions, saveTransactions } from "../lib/crypto/storage";
import type { Transaction } from "../lib/crypto/types";

export function useTransactions(portfolioId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Ref mirror so callbacks read the current list without becoming
  // reactive dependencies (keeps identities stable).
  const txRef = useRef<Transaction[]>([]);

  useEffect(() => {
    if (!portfolioId) return;
    try {
      const list = loadTransactions(portfolioId);
      setTransactions(list);
      txRef.current = list;
    } catch (err) {
      console.error("Failed to load transactions", err);
      toast.error("Could not load your transactions", {
        description: err instanceof Error ? err.message : "Storage read failed.",
      });
      setTransactions([]);
      txRef.current = [];
    } finally {
      setHydrated(true);
    }
  }, [portfolioId]);

  /** Set state + write-through to storage, catching quota errors. */
  const persist = useCallback(
    (next: Transaction[]) => {
      setTransactions(next);
      txRef.current = next;
      try {
        saveTransactions(portfolioId, next);
      } catch (err) {
        console.error("Failed to save transactions", err);
        toast.error("Could not save changes", {
          description: err instanceof Error ? err.message : "Storage write failed.",
        });
      }
    },
    [portfolioId],
  );

  /** Append a new transaction — id is generated with `crypto.randomUUID()`. */
  const addTransaction = useCallback(
    (tx: Omit<Transaction, "id">) => {
      const withId: Transaction = { ...tx, id: crypto.randomUUID() };
      persist([...txRef.current, withId]);
    },
    [persist],
  );

  /** Delete a transaction by id. Missing ids are a silent no-op. */
  const removeTransaction = useCallback(
    (id: string) => {
      persist(txRef.current.filter((t) => t.id !== id));
    },
    [persist],
  );

  /**
   * Update a transaction by id. Merges the patch over the existing record;
   * `id` in the patch is ignored. No-op when the id is missing.
   */
  const updateTransaction = useCallback(
    (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      const next = txRef.current.map((t) =>
        t.id === id ? { ...t, ...patch, id: t.id } : t,
      );
      persist(next);
    },
    [persist],
  );

  /** Replace the entire transaction list (used by "Import → Replace"). */
  const replaceAll = useCallback((txs: Transaction[]) => persist(txs), [persist]);

  /**
   * Merge new transactions into the existing list, skipping any whose
   * id is already present ("Import → Merge").
   */
  const mergeAll = useCallback(
    (txs: Transaction[]) => {
      const existing = txRef.current;
      const seen = new Set(existing.map((t) => t.id));
      persist([...existing, ...txs.filter((t) => !seen.has(t.id))]);
    },
    [persist],
  );

  return {
    transactions,
    hydrated,
    addTransaction,
    removeTransaction,
    updateTransaction,
    replaceAll,
    mergeAll,
  };
}