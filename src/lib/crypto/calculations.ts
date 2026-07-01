/**
 * Portfolio math kernel.
 *
 * Every derived metric in the UI (open positions, allocation pie, P&L, cost
 * basis timeline, monthly cash-flow table) ultimately comes from the pure
 * functions in this file. They take a `Transaction[]` and return plain data
 * — no React, no storage, no network — so they're trivial to memoize and to
 * unit-test.
 *
 * Accounting method: **average cost basis**. When a `sell` executes, cost
 * basis is reduced proportionally at the running average, and any difference
 * between sell price and average cost is booked as realized P&L. Fees are
 * added to cost basis on buys/rewards and deducted from realized P&L on
 * sells.
 *
 * Transaction types:
 * - `buy`      — adds coins at `pricePerCoin`, increases cost basis.
 * - `sell`     — removes coins, books realized P&L.
 * - `reward`   — adds coins at `pricePerCoin` (0 for airdrops), treated as
 *                cost-basis income equal to `amount * price`.
 * - `deposit`  — fiat in (USD). Does not affect crypto holdings, only cash-
 *                flow / net-invested metrics.
 * - `withdraw` — fiat out. Symmetric to `deposit`.
 */
import type { Holding, HoldingWithPrice, Transaction } from "./types";

/** Sentinel coinId used for `deposit` / `withdraw` fiat entries. */
export const CASH_COIN_ID = "__cash__";

// Reference-keyed caches. When a component memoizes its `transactions`
// slice (see useTransactions / model.ts), repeated calls with the same
// array skip the O(n log n) work entirely. Entries GC automatically once
// the transaction array is unreachable — no manual invalidation needed.
const HOLDINGS_CACHE = new WeakMap<Transaction[], Holding[]>();
const MONTHLY_CACHE = new WeakMap<Transaction[], MonthlyStat[]>();

/**
 * Collapse a transaction list into per-coin open positions using the
 * average-cost-basis method.
 *
 * @param transactions Raw transaction list (order is irrelevant — sorted
 *                     per-coin internally).
 * @returns One {@link Holding} per coin that either still has open amount
 *          or produced non-zero realized P&L, sorted by descending invested
 *          amount. Cash/fiat entries (`deposit`, `withdraw`) are skipped.
 */
export function aggregateHoldings(transactions: Transaction[]): Holding[] {
  const cached = HOLDINGS_CACHE.get(transactions);
  if (cached) return cached;
  const result = computeHoldings(transactions);
  HOLDINGS_CACHE.set(transactions, result);
  return result;
}

function computeHoldings(transactions: Transaction[]): Holding[] {
  const byCoin = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    // deposits / withdrawals are fiat cash flows — not asset positions
    if (tx.type === "deposit" || tx.type === "withdraw") continue;
    if (!byCoin.has(tx.coinId)) byCoin.set(tx.coinId, []);
    byCoin.get(tx.coinId)!.push(tx);
  }

  const holdings: Holding[] = [];
  for (const [coinId, txs] of byCoin.entries()) {
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    let amount = 0;
    let costBasis = 0; // total cost of currently-held amount
    let realizedPnL = 0;

    for (const tx of sorted) {
      const fee = tx.fee ?? 0;
      if (tx.type === "buy" || tx.type === "reward") {
        // rewards add coins; pricePerCoin is treated as cost basis (0 for airdrops)
        costBasis += tx.amount * tx.pricePerCoin + fee;
        amount += tx.amount;
      } else if (tx.type === "sell") {
        // sell: reduce proportionally using average cost method
        const avgCost = amount > 0 ? costBasis / amount : 0;
        const sellAmount = Math.min(tx.amount, amount);
        realizedPnL += (tx.pricePerCoin - avgCost) * sellAmount - fee;
        costBasis -= avgCost * sellAmount;
        amount -= sellAmount;
        if (amount < 0) amount = 0;
        if (costBasis < 0) costBasis = 0;
      }
    }

    const first = sorted[0];
    if (amount > 0 || realizedPnL !== 0) {
      holdings.push({
        coinId,
        symbol: first.symbol,
        name: first.name,
        amount,
        avgBuyPrice: amount > 0 ? costBasis / amount : 0,
        invested: costBasis,
        realizedPnL,
      });
    }
  }
  return holdings.sort((a, b) => b.invested - a.invested);
}

/**
 * Enrich {@link Holding}s with live prices to produce values, unrealized
 * P&L and %-return. Only open positions (`amount > 0`) survive.
 *
 * When a coin id is missing from `prices` (the CoinGecko response didn't
 * include it), current price defaults to `0` in the shape but the row's
 * current value falls back to invested cost — otherwise a missing price
 * would render as a full 100% loss.
 *
 * @param holdings Result of {@link aggregateHoldings}.
 * @param prices   Map of coinId → USD price.
 * @returns Priced holdings sorted by descending current value.
 */
export function withPrices(
  holdings: Holding[],
  prices: Record<string, number>,
): HoldingWithPrice[] {
  return holdings
    .filter((h) => h.amount > 0)
    .map((h) => {
      const known = Object.prototype.hasOwnProperty.call(prices, h.coinId);
      const currentPrice = known ? prices[h.coinId] : 0;
      // When the price is unknown (API hasn't returned this id), fall back to
      // cost basis so a missing price doesn't render as a total loss.
      const currentValue = known ? h.amount * currentPrice : h.invested;
      const unrealizedPnL = known ? currentValue - h.invested : 0;
      const unrealizedPnLPercent =
        known && h.invested > 0 ? (unrealizedPnL / h.invested) * 100 : 0;
      return {
        ...h,
        currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent,
      };
    })
    .sort((a, b) => b.currentValue - a.currentValue);
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL: number;
  /** Sum of fiat deposits into the portfolio */
  totalDeposits: number;
  /** Sum of fiat withdrawals out of the portfolio */
  totalWithdrawals: number;
  /** deposits - withdrawals: net cash the user actually funded */
  netDeposits: number;
  /** Value of reward transactions at their recorded price (income) */
  rewardsIncome: number;
  /** Overall return vs net deposits: (value + realized + rewards - netDeposits) / netDeposits */
  totalReturn: number;
  totalReturnPercent: number;
  totalFees: number;
}

/**
 * Aggregate a portfolio-wide summary from priced holdings + raw
 * transactions. All monetary values are USD.
 *
 * Formulas:
 * - `totalReturn        = totalValue + realizedPnL − netDeposits`
 * - `totalReturnPercent = totalReturn / netDeposits × 100`  (0 when the
 *   user has never deposited)
 *
 * `unrealizedPnLPercent` is computed against invested cost basis, so it
 * represents "how much has this basket appreciated since I bought it",
 * not overall portfolio return.
 */
export function calculateSummary(
  holdings: Holding[],
  priced: HoldingWithPrice[],
  transactions: Transaction[] = [],
): PortfolioSummary {
  const totalValue = priced.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = priced.reduce((s, h) => s + h.invested, 0);
  const unrealizedPnL = totalValue - totalInvested;
  const realizedPnL = holdings.reduce((s, h) => s + h.realizedPnL, 0);

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let rewardsIncome = 0;
  let totalFees = 0;
  for (const tx of transactions) {
    totalFees += tx.fee ?? 0;
    if (tx.type === "deposit") totalDeposits += tx.amount;
    else if (tx.type === "withdraw") totalWithdrawals += tx.amount;
    else if (tx.type === "reward") rewardsIncome += tx.amount * tx.pricePerCoin;
  }
  const netDeposits = totalDeposits - totalWithdrawals;
  const totalReturn = totalValue + realizedPnL - netDeposits;
  const totalReturnPercent = netDeposits > 0 ? (totalReturn / netDeposits) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    unrealizedPnL,
    unrealizedPnLPercent: totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0,
    realizedPnL,
    totalDeposits,
    totalWithdrawals,
    netDeposits,
    rewardsIncome,
    totalReturn,
    totalReturnPercent,
    totalFees,
  };
}

// ---------- Monthly summary ----------
export interface MonthlyStat {
  month: string; // YYYY-MM
  deposits: number;
  withdrawals: number;
  buys: number;
  sells: number;
  realizedPnL: number;
  rewards: number;
  fees: number;
  netFlow: number;
  txCount: number;
}

/**
 * Bucket transactions by calendar month (`YYYY-MM`) and roll up cash flow +
 * realized P&L. Uses the same average-cost method as
 * {@link aggregateHoldings}, but tracks state as it iterates so the returned
 * `realizedPnL` for each month reflects sells made in that month only.
 *
 * @returns Rows sorted newest month first (`Dec` before `Nov`).
 */
export function monthlyStats(transactions: Transaction[]): MonthlyStat[] {
  const cached = MONTHLY_CACHE.get(transactions);
  if (cached) return cached;
  const result = computeMonthlyStats(transactions);
  MONTHLY_CACHE.set(transactions, result);
  return result;
}

function computeMonthlyStats(transactions: Transaction[]): MonthlyStat[] {
  const map = new Map<string, MonthlyStat>();
  // rolling avg cost per coin for realized P&L on sells within month
  const state = new Map<string, { amount: number; cost: number }>();
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const month = tx.date.slice(0, 7);
    if (!map.has(month)) {
      map.set(month, {
        month,
        deposits: 0,
        withdrawals: 0,
        buys: 0,
        sells: 0,
        realizedPnL: 0,
        rewards: 0,
        fees: 0,
        netFlow: 0,
        txCount: 0,
      });
    }
    const row = map.get(month)!;
    row.txCount += 1;
    row.fees += tx.fee ?? 0;
    if (tx.type === "deposit") {
      row.deposits += tx.amount;
      row.netFlow += tx.amount;
    } else if (tx.type === "withdraw") {
      row.withdrawals += tx.amount;
      row.netFlow -= tx.amount;
    } else if (tx.type === "reward") {
      row.rewards += tx.amount * tx.pricePerCoin;
      const st = state.get(tx.coinId) ?? { amount: 0, cost: 0 };
      st.amount += tx.amount;
      st.cost += tx.amount * tx.pricePerCoin + (tx.fee ?? 0);
      state.set(tx.coinId, st);
    } else if (tx.type === "buy") {
      row.buys += tx.amount * tx.pricePerCoin + (tx.fee ?? 0);
      const st = state.get(tx.coinId) ?? { amount: 0, cost: 0 };
      st.amount += tx.amount;
      st.cost += tx.amount * tx.pricePerCoin + (tx.fee ?? 0);
      state.set(tx.coinId, st);
    } else if (tx.type === "sell") {
      const gross = tx.amount * tx.pricePerCoin;
      row.sells += gross;
      const st = state.get(tx.coinId) ?? { amount: 0, cost: 0 };
      const avg = st.amount > 0 ? st.cost / st.amount : 0;
      const sellAmt = Math.min(tx.amount, st.amount);
      row.realizedPnL += (tx.pricePerCoin - avg) * sellAmt - (tx.fee ?? 0);
      st.cost -= avg * sellAmt;
      st.amount -= sellAmt;
      if (st.amount < 0) st.amount = 0;
      if (st.cost < 0) st.cost = 0;
      state.set(tx.coinId, st);
    }
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}