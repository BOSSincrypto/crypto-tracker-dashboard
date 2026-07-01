import { memo } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, Coins, Gift, PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedUSD, formatUSD } from "@/lib/crypto/format";
import type { PortfolioSummary } from "@/lib/crypto/calculations";

interface Props {
  summary: PortfolioSummary;
}

function KpiCardsImpl({ summary }: Props) {
  const pnlPositive = summary.unrealizedPnL >= 0;
  const realizedPositive = summary.realizedPnL >= 0;
  const totalReturnPositive = summary.totalReturn >= 0;

  const items = [
    {
      label: "Portfolio Value",
      value: formatUSD(summary.totalValue),
      hint: "Current market value",
      tone: "default" as const,
      Icon: Wallet,
    },
    {
      label: "Net Deposits",
      value: formatUSD(summary.netDeposits),
      hint:
        summary.totalDeposits === 0 && summary.totalWithdrawals === 0
          ? "Track cash in / out"
          : `In ${formatUSD(summary.totalDeposits)} · Out ${formatUSD(summary.totalWithdrawals)}`,
      tone: "default" as const,
      Icon: Banknote,
    },
    {
      label: "Total Invested",
      value: formatUSD(summary.totalInvested),
      hint: "Cost basis, open positions",
      tone: "default" as const,
      Icon: PiggyBank,
    },
    {
      label: "Unrealized P&L",
      value: formatSignedUSD(summary.unrealizedPnL),
      hint: formatPercent(summary.unrealizedPnLPercent),
      tone: pnlPositive ? ("positive" as const) : ("negative" as const),
      Icon: pnlPositive ? ArrowUpRight : ArrowDownRight,
      trend: pnlPositive ? ("up" as const) : ("down" as const),
    },
    {
      label: "Realized P&L",
      value: formatSignedUSD(summary.realizedPnL),
      hint: summary.realizedPnL === 0 ? "No closed sells yet" : "From closed sells",
      tone: summary.realizedPnL === 0 ? ("default" as const) : realizedPositive ? ("positive" as const) : ("negative" as const),
      Icon: summary.realizedPnL === 0 ? Coins : realizedPositive ? TrendingUp : ArrowDownRight,
      trend: summary.realizedPnL === 0 ? undefined : realizedPositive ? ("up" as const) : ("down" as const),
    },
    {
      label: "Total Return",
      value: formatSignedUSD(summary.totalReturn),
      hint:
        summary.netDeposits > 0
          ? formatPercent(summary.totalReturnPercent)
          : "Add a deposit to enable",
      tone:
        summary.netDeposits <= 0
          ? ("default" as const)
          : totalReturnPositive
            ? ("positive" as const)
            : ("negative" as const),
      Icon: totalReturnPositive ? Sparkles : ArrowDownRight,
      trend:
        summary.netDeposits <= 0
          ? undefined
          : totalReturnPositive
            ? ("up" as const)
            : ("down" as const),
    },
    {
      label: "Rewards Income",
      value: formatUSD(summary.rewardsIncome),
      hint: summary.totalFees > 0 ? `Fees ${formatUSD(summary.totalFees)}` : "Airdrops · staking · yield",
      tone: "default" as const,
      Icon: Gift,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(({ label, value, hint, tone, Icon, trend }) => (
        <Card
          key={label}
          className={cn(
            "relative overflow-hidden border-border/60 transition-colors",
            tone === "positive" && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-positive/60",
            tone === "negative" && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-negative/60",
          )}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {label}
              </div>
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  tone === "positive" && "text-positive",
                  tone === "negative" && "text-negative",
                  tone === "default" && "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            </div>
            <div
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${label}: ${value}`}
              className={cn(
                "mt-3 font-mono text-2xl font-semibold tabular-nums leading-none sm:text-[28px]",
                tone === "positive" && "text-positive",
                tone === "negative" && "text-negative",
              )}
            >
              {value}
            </div>
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs",
                tone === "positive" && "text-positive",
                tone === "negative" && "text-negative",
                tone === "default" && "text-muted-foreground",
              )}
            >
              {trend === "up" && <span aria-hidden="true">▲</span>}
              {trend === "down" && <span aria-hidden="true">▼</span>}
              <span className="font-mono tabular-nums">{hint}</span>
              {trend && (
                <span className="sr-only">{trend === "up" ? "up" : "down"}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export const KpiCards = memo(KpiCardsImpl);
