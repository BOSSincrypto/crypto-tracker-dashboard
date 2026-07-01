/**
 * Higher-order portfolio analytics.
 *
 * These functions consume snapshots / transactions and produce metrics
 * that go beyond the simple "holdings + P&L" model — drawdown, volatility,
 * cash-flow waterfalls, cost-basis timelines. They're pure and side-effect
 * free, safe to call inside `useMemo`.
 */
import type { PortfolioSnapshot, Transaction } from "./types";

/** Risk & performance metrics derived from a snapshot time-series. */
export interface RiskMetrics {
  maxDrawdown: number; // percent, negative
  maxDrawdownAbs: number; // USD, negative
  peakValue: number;
  peakDate?: string;
  troughDate?: string;
  currentDrawdown: number; // percent from ATH
  bestDay: { date: string; changePct: number; changeAbs: number } | null;
  worstDay: { date: string; changePct: number; changeAbs: number } | null;
  avgDailyReturn: number; // percent
  volatility: number; // stdev of daily % returns
  positiveDays: number;
  negativeDays: number;
  streak: { direction: "up" | "down" | "flat"; length: number };
  daysSinceATH: number;
  athValue: number;
}

/**
 * Compute risk / performance metrics from a daily-value snapshot series.
 *
 * Definitions:
 * - **Max drawdown**: worst peak-to-trough percentage decline observed.
 * - **Current drawdown**: distance from the all-time high.
 * - **Volatility**: population stdev of daily percentage returns.
 * - **Streak**: consecutive up/down days ending on the most recent one
 *   (flat days terminate the streak; a leading flat span is skipped).
 *
 * @param snapshots Portfolio value snapshots (any order — sorted internally).
 *                  Fewer than 2 points → zeroed metrics (nothing to analyze).
 */
export function computeRiskMetrics(snapshots: PortfolioSnapshot[]): RiskMetrics {
  const empty: RiskMetrics = {
    maxDrawdown: 0,
    maxDrawdownAbs: 0,
    peakValue: 0,
    currentDrawdown: 0,
    bestDay: null,
    worstDay: null,
    avgDailyReturn: 0,
    volatility: 0,
    positiveDays: 0,
    negativeDays: 0,
    streak: { direction: "flat", length: 0 },
    daysSinceATH: 0,
    athValue: 0,
  };
  if (snapshots.length < 2) return empty;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  let peak = sorted[0].totalValue;
  let peakDate = sorted[0].date;
  let ddPct = 0;
  let ddAbs = 0;
  let ddPeakDate = peakDate;
  let ddTroughDate = peakDate;
  let ath = sorted[0].totalValue;
  let athDate = sorted[0].date;

  const returns: number[] = [];
  let best: RiskMetrics["bestDay"] = null;
  let worst: RiskMetrics["worstDay"] = null;
  let positive = 0;
  let negative = 0;

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur.totalValue > peak) {
      peak = cur.totalValue;
      peakDate = cur.date;
    }
    if (cur.totalValue > ath) {
      ath = cur.totalValue;
      athDate = cur.date;
    }
    const dd = peak > 0 ? (cur.totalValue - peak) / peak : 0;
    if (dd < ddPct) {
      ddPct = dd;
      ddAbs = cur.totalValue - peak;
      ddPeakDate = peakDate;
      ddTroughDate = cur.date;
    }
    if (i > 0) {
      const prev = sorted[i - 1].totalValue;
      if (prev > 0) {
        const changePct = ((cur.totalValue - prev) / prev) * 100;
        const changeAbs = cur.totalValue - prev;
        returns.push(changePct);
        if (changePct > 0) positive += 1;
        else if (changePct < 0) negative += 1;
        if (!best || changePct > best.changePct) best = { date: cur.date, changePct, changeAbs };
        if (!worst || changePct < worst.changePct) worst = { date: cur.date, changePct, changeAbs };
      }
    }
  }

  const avg = returns.length ? returns.reduce((s, v) => s + v, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / returns.length
    : 0;
  const volatility = Math.sqrt(variance);

  // current streak (from the end)
  let streakDir: "up" | "down" | "flat" = "flat";
  let streakLen = 0;
  for (let i = returns.length - 1; i >= 0; i--) {
    const r = returns[i];
    const dir = r > 0 ? "up" : r < 0 ? "down" : "flat";
    if (streakLen === 0) {
      // Skip trailing flat days — they don't form a directional streak.
      if (dir === "flat") continue;
      streakDir = dir;
      streakLen = 1;
    } else if (dir === streakDir) {
      streakLen += 1;
    } else break;
  }

  const last = sorted[sorted.length - 1];
  const currentDrawdown = ath > 0 ? ((last.totalValue - ath) / ath) * 100 : 0;
  const daysSinceATH = Math.max(
    0,
    Math.round((new Date(last.date).getTime() - new Date(athDate).getTime()) / 86400000),
  );

  return {
    maxDrawdown: ddPct * 100,
    maxDrawdownAbs: ddAbs,
    peakValue: peak,
    peakDate: ddPeakDate,
    troughDate: ddTroughDate,
    currentDrawdown,
    bestDay: best,
    worstDay: worst,
    avgDailyReturn: avg,
    volatility,
    positiveDays: positive,
    negativeDays: negative,
    streak: { direction: streakDir, length: streakLen },
    daysSinceATH,
    athValue: ath,
  };
}

/**
 * Cumulative cost basis (and net USD invested) of open positions across a
 * date series, using the average-cost method.
 *
 * Efficient: transactions and dates are each sorted once, then a single
 * two-pointer walk assigns transactions to their days. O((n+m) log n).
 *
 * @param transactions Every transaction ever recorded.
 * @param dates        The dates to sample at (e.g. one per chart tick).
 * @returns One row per input date with running cost basis + net invested.
 */
export function costBasisTimeline(
  transactions: Transaction[],
  dates: string[],
): { date: string; costBasis: number; netInvested: number }[] {
  if (dates.length === 0) return [];
  const txs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const sortedDates = [...dates].sort();
  const state = new Map<string, { amount: number; cost: number }>();
  let netInvested = 0;
  let cursor = 0;
  // Running total across all coins — avoids an O(k) sum per day.
  let totalCost = 0;
  const out: { date: string; costBasis: number; netInvested: number }[] = [];
  for (const day of sortedDates) {
    while (cursor < txs.length && txs[cursor].date <= day) {
      const tx = txs[cursor++];
      const fee = tx.fee ?? 0;
      if (tx.type === "deposit") netInvested += tx.amount;
      else if (tx.type === "withdraw") netInvested -= tx.amount;
      else if (tx.type === "buy" || tx.type === "reward") {
        const st = state.get(tx.coinId) ?? { amount: 0, cost: 0 };
        const delta = tx.amount * tx.pricePerCoin + fee;
        st.cost += delta;
        st.amount += tx.amount;
        totalCost += delta;
        state.set(tx.coinId, st);
      } else if (tx.type === "sell") {
        const st = state.get(tx.coinId) ?? { amount: 0, cost: 0 };
        const avg = st.amount > 0 ? st.cost / st.amount : 0;
        const amt = Math.min(tx.amount, st.amount);
        const reduce = avg * amt;
        st.cost -= reduce;
        st.amount -= amt;
        totalCost -= reduce;
        if (st.cost < 0) {
          totalCost -= st.cost; // st.cost is negative — bump total up by same
          st.cost = 0;
        }
        if (st.amount < 0) st.amount = 0;
        state.set(tx.coinId, st);
      }
    }
    out.push({ date: day, costBasis: totalCost, netInvested });
  }
  return out;
}

/** One step in a P&L waterfall chart (deposits → rewards → PnL → total). */
export interface WaterfallStep {
  label: string;
  /** Signed contribution of this step (negative = outflow / loss). */
  value: number;
  /** Running total after applying `value`. */
  running: number;
  kind: "in" | "out" | "gain" | "loss" | "total";
}

/**
 * Build the sequence of steps for a cash-flow waterfall chart, from
 * deposits through rewards, realized/unrealized P&L and fees, to the
 * final current value.
 *
 * Zero-value steps are dropped for a cleaner visual.
 */
export function cashFlowWaterfall(input: {
  totalDeposits: number;
  totalWithdrawals: number;
  rewardsIncome: number;
  realizedPnL: number;
  totalFees: number;
  unrealizedPnL: number;
  totalValue: number;
}): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = 0;
  const push = (label: string, value: number, kind: WaterfallStep["kind"]) => {
    running += value;
    steps.push({ label, value, running, kind });
  };
  push("Deposits", input.totalDeposits, "in");
  if (input.totalWithdrawals > 0) push("Withdrawals", -input.totalWithdrawals, "out");
  if (input.rewardsIncome > 0) push("Rewards", input.rewardsIncome, "in");
  if (input.realizedPnL !== 0)
    push("Realized P&L", input.realizedPnL, input.realizedPnL >= 0 ? "gain" : "loss");
  if (input.totalFees > 0) push("Fees", -input.totalFees, "out");
  if (input.unrealizedPnL !== 0)
    push(
      "Unrealized P&L",
      input.unrealizedPnL,
      input.unrealizedPnL >= 0 ? "gain" : "loss",
    );
  steps.push({
    label: "Current Value",
    value: input.totalValue,
    running: input.totalValue,
    kind: "total",
  });
  return steps;
}