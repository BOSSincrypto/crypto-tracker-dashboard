import { Activity } from "lucide-react";
import { AddTransactionDialog } from "./AddTransactionDialog";
import { ImportExportMenu } from "./ImportExportMenu";
import { LiveStatusIndicator } from "./LiveStatusIndicator";
import { PortfolioSwitcher } from "./PortfolioSwitcher";
import type { Portfolio, Transaction } from "@/lib/crypto/types";

interface Props {
  portfolios: Portfolio[];
  activeId: string;
  isAll: boolean;
  isFetching: boolean;
  transactions: Transaction[];
  editingTx: Transaction | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAddTx: (tx: Omit<Transaction, "id">) => void;
  onUpdateTx: (id: string, patch: Omit<Transaction, "id">) => void;
  onReplaceTxs: (txs: Transaction[]) => void;
  onMergeTxs: (txs: Transaction[]) => void;
  onCloseEdit: () => void;
}

/**
 * Sticky app header: branding, live-status chip, portfolio switcher, and
 * (single-portfolio mode only) import/export + add-transaction controls.
 * Also mounts the controlled edit-transaction dialog.
 */
export function AppHeader({
  portfolios,
  activeId,
  isAll,
  isFetching,
  transactions,
  editingTx,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onAddTx,
  onUpdateTx,
  onReplaceTxs,
  onMergeTxs,
  onCloseEdit,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"
            aria-hidden="true"
          >
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              Crypto Portfolio Tracker — Local-first P&amp;L Dashboard
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Local-first tracker · CoinGecko prices · CSV/JSON I/O
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <LiveStatusIndicator isFetching={isFetching} />
          <PortfolioSwitcher
            portfolios={portfolios}
            activeId={activeId}
            onSelect={onSelect}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
          />
          {!isAll && (
            <>
              <ImportExportMenu
                transactions={transactions}
                onReplace={onReplaceTxs}
                onMerge={onMergeTxs}
              />
              <AddTransactionDialog onAdd={onAddTx} />
              <AddTransactionDialog
                initial={editingTx}
                open={!!editingTx}
                onOpenChange={(o) => { if (!o) onCloseEdit(); }}
                onUpdate={onUpdateTx}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}