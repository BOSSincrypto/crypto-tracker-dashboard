import { Suspense, lazy } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PanelSkeleton } from "@/components/PanelSkeleton";
import { AllPortfoliosBanner } from "./AllPortfoliosBanner";
import { AllocationPieChart } from "./AllocationPieChart";
import { HoldingsTable } from "./HoldingsTable";
import { KpiCards } from "./KpiCards";
import { MonthlySummaryTable } from "./MonthlySummaryTable";
import { PortfolioLineChart } from "./PortfolioLineChart";
import { PricesErrorAlert } from "./PricesErrorAlert";
import { TransactionsTable } from "./TransactionsTable";
import type { HoldingWithPrice, Transaction, PortfolioSnapshot } from "@/lib/crypto/types";
import type { PortfolioSummary } from "@/lib/crypto/calculations";

// Heavy Recharts-based panels are lazy-loaded — they add ~150KB of Recharts
// primitives that don't need to be in the initial bundle. They render below
// the fold and can arrive after first paint.
const AnalyticsPanel = lazy(() =>
  import("./AnalyticsPanel").then((m) => ({ default: m.AnalyticsPanel })),
);
const RiskMetricsPanel = lazy(() =>
  import("./RiskMetricsPanel").then((m) => ({ default: m.RiskMetricsPanel })),
);
const CashFlowWaterfall = lazy(() =>
  import("./CashFlowWaterfall").then((m) => ({ default: m.CashFlowWaterfall })),
);
const CostVsValueChart = lazy(() =>
  import("./CostVsValueChart").then((m) => ({ default: m.CostVsValueChart })),
);

interface Props {
  isAll: boolean;
  portfolioCount: number;
  transactions: Transaction[];
  priced: HoldingWithPrice[];
  summary: PortfolioSummary;
  snapshots: PortfolioSnapshot[];
  isFetching: boolean;
  pricesError: unknown;
  onRemoveTx?: (id: string) => void;
  onEditTx?: (tx: Transaction) => void;
}

/**
 * Main dashboard grid. Purely presentational — every panel is wrapped in
 * its own ErrorBoundary so one failure never takes down the whole view.
 */
export function Dashboard({
  isAll,
  portfolioCount,
  transactions,
  priced,
  summary,
  snapshots,
  isFetching,
  pricesError,
  onRemoveTx,
  onEditTx,
}: Props) {
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-8">
      {isAll && <AllPortfoliosBanner count={portfolioCount} />}

      <ErrorBoundary label="Summary" height={120}>
        <KpiCards summary={summary} />
      </ErrorBoundary>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ErrorBoundary label="Portfolio chart" height={320}>
            <PortfolioLineChart
              snapshots={snapshots}
              transactions={transactions}
              currentValue={summary.totalValue}
              invested={summary.totalInvested}
            />
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <ErrorBoundary label="Allocation" height={320}>
            <AllocationPieChart holdings={priced} />
          </ErrorBoundary>
        </div>
      </div>

      <ErrorBoundary label="Holdings" height={200}>
        <HoldingsTable holdings={priced} isLoading={isFetching} />
      </ErrorBoundary>
      <ErrorBoundary label="Analytics" height={360}>
        <Suspense fallback={<PanelSkeleton height={360} />}>
          <AnalyticsPanel holdings={priced} transactions={transactions} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary label="Risk metrics" height={220}>
        <Suspense fallback={<PanelSkeleton height={220} />}>
          <RiskMetricsPanel snapshots={snapshots} />
        </Suspense>
      </ErrorBoundary>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ErrorBoundary label="Cost vs value" height={320}>
            <Suspense fallback={<PanelSkeleton height={320} />}>
              <CostVsValueChart snapshots={snapshots} transactions={transactions} />
            </Suspense>
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-2">
          <ErrorBoundary label="Cash flow" height={320}>
            <Suspense fallback={<PanelSkeleton height={320} />}>
              <CashFlowWaterfall summary={summary} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
      <ErrorBoundary label="Monthly summary" height={200}>
        <MonthlySummaryTable transactions={transactions} />
      </ErrorBoundary>
      <ErrorBoundary label="Transactions" height={200}>
        <TransactionsTable
          transactions={transactions}
          onRemove={onRemoveTx}
          onEdit={onEditTx}
        />
      </ErrorBoundary>

      <PricesErrorAlert error={pricesError} />
    </main>
  );
}