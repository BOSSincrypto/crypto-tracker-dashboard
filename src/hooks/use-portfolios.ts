/**
 * Stateful accessor for the list of portfolios + the active selection.
 *
 * All mutations go through the storage layer and then refresh local state
 * — there's no diffing, we just re-read the (in-memory-cached) list.
 */
import { useCallback, useEffect, useState } from "react";
import {
  createPortfolio,
  deletePortfolio,
  getActivePortfolioId,
  loadPortfolios,
  renamePortfolio,
  setActivePortfolioId,
} from "../lib/crypto/storage";
import type { Portfolio } from "../lib/crypto/types";

/**
 * @returns `portfolios` list, `activeId` (may be {@link ALL_PORTFOLIOS_ID}),
 *          `hydrated` flag, and CRUD helpers (`select` / `create` /
 *          `rename` / `remove`).
 */
export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  /** Re-read portfolios list + active id from storage into local state. */
  const refresh = useCallback(() => {
    setPortfolios(loadPortfolios());
    setActiveId(getActivePortfolioId());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const select = useCallback((id: string) => {
    setActivePortfolioId(id);
    setActiveId(id);
  }, []);

  const create = useCallback(
    (name: string) => {
      const p = createPortfolio(name);
      refresh();
      return p;
    },
    [refresh],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      renamePortfolio(id, name);
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deletePortfolio(id);
      refresh();
    },
    [refresh],
  );

  return { portfolios, activeId, hydrated, select, create, rename, remove };
}