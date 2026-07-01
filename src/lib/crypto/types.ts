export type TransactionType = "buy" | "sell" | "deposit" | "withdraw" | "reward";

/** Canonical list of transaction types. Kept as a tuple so it can drive
 *  Zod enums, form pickers, and CSV validation from a single source. */
export const TX_TYPES = ["buy", "sell", "deposit", "withdraw", "reward"] as const;

export interface Transaction {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  type: TransactionType;
  amount: number;
  pricePerCoin: number;
  date: string;
  note?: string;
  /** Optional fee in USD (exchange/network). Reduces P&L / adds to cost. */
  fee?: number;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
}

export interface Holding {
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  invested: number;
  realizedPnL: number;
}

export interface HoldingWithPrice extends Holding {
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface CoinSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;
}

export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
}