import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/crypto/AppHeader";
import { Dashboard } from "@/components/crypto/Dashboard";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { Transaction } from "@/lib/crypto/types";
import { indexHead } from "./index.head";

export const Route = createFileRoute("/")({
  component: Index,
  head: indexHead,
});

/**
 * Route composition root. Owns only view-level state (which transaction
 * is being edited) and wires the dashboard data hook to the two top-level
 * presentational components: AppHeader (controls) and Dashboard (panels).
 */
function Index() {
  const data = useDashboardData();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const { portfolios: portfoliosApi, isAll, tx } = data;

  // Close the edit dialog when the user switches portfolios — the
  // dialog's transaction no longer belongs to the visible list.
  useEffect(() => {
    setEditingTx(null);
  }, [portfoliosApi.activeId]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Toaster />
      <AppHeader
        portfolios={portfoliosApi.portfolios}
        activeId={portfoliosApi.activeId}
        isAll={isAll}
        isFetching={data.pricesQuery.isFetching}
        transactions={data.transactions}
        editingTx={editingTx}
        onSelect={portfoliosApi.select}
        onCreate={portfoliosApi.create}
        onRename={portfoliosApi.rename}
        onDelete={portfoliosApi.remove}
        onAddTx={tx.add}
        onUpdateTx={tx.update}
        onReplaceTxs={tx.replaceAll}
        onMergeTxs={tx.mergeAll}
        onCloseEdit={() => setEditingTx(null)}
      />
      <Dashboard
        isAll={isAll}
        portfolioCount={portfoliosApi.portfolios.length}
        transactions={data.transactions}
        priced={data.priced}
        summary={data.summary}
        snapshots={data.snapshots}
        isFetching={data.pricesQuery.isFetching}
        pricesError={data.pricesQuery.error}
        onRemoveTx={isAll ? undefined : tx.remove}
        onEditTx={isAll ? undefined : setEditingTx}
      />
    </div>
  );
}
