import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Gauge, Scale, Target, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedUSD, formatUSD } from "@/lib/crypto/format";
import { monthlyStats } from "@/lib/crypto/calculations";
import type { HoldingWithPrice, Transaction } from "@/lib/crypto/types";

interface Props {
  holdings: HoldingWithPrice[];
  transactions: Transaction[];
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });
function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return MONTH_FMT.format(new Date(y, (m || 1) - 1, 1));
}

function AnalyticsPanelImpl({ holdings, transactions }: Props) {
  const {
    contributions,
    best,
    worst,
    biggestLoser,
    biggestWinner,
    totalValue,
    top1Share,
    top3Share,
    hhi,
    diversification,
    firstDate,
    daysTracked,
    winRate,
    avgWin,
    avgLoss,
  } = useMemo(() => {
    const open = holdings.filter((h) => h.amount > 0);
    const totalValue = open.reduce((s, h) => s + h.currentValue, 0);

    const contributions = [...open]
      .map((h) => ({
        symbol: h.symbol.toUpperCase(),
        pnl: h.unrealizedPnL,
        pct: h.unrealizedPnLPercent,
        value: h.currentValue,
      }))
      .sort((a, b) => b.pnl - a.pnl);

    const byPct = [...open].sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent);
    const best = byPct[0];
    const worst = byPct[byPct.length - 1];
    const byPnl = [...open].sort((a, b) => b.unrealizedPnL - a.unrealizedPnL);
    const biggestWinner = byPnl[0];
    const biggestLoser = byPnl[byPnl.length - 1];

    const sortedByVal = [...open].sort((a, b) => b.currentValue - a.currentValue);
    const top1Share = totalValue > 0 && sortedByVal[0] ? (sortedByVal[0].currentValue / totalValue) * 100 : 0;
    const top3Share =
      totalValue > 0
        ? (sortedByVal.slice(0, 3).reduce((s, h) => s + h.currentValue, 0) / totalValue) * 100
        : 0;
    // Herfindahl-Hirschman Index (0..1). Higher = more concentrated.
    const hhi =
      totalValue > 0
        ? sortedByVal.reduce((s, h) => s + Math.pow(h.currentValue / totalValue, 2), 0)
        : 0;
    // 0 assets → 0; 1 asset → 0; scales towards ~100 as breadth grows.
    const diversification = hhi > 0 ? Math.max(0, Math.min(100, (1 - hhi) * 100)) : 0;

    // win-rate: share of open positions in profit
    const winners = open.filter((h) => h.unrealizedPnL > 0);
    const losers = open.filter((h) => h.unrealizedPnL < 0);
    const winRate = open.length > 0 ? (winners.length / open.length) * 100 : 0;
    const avgWin = winners.length > 0 ? winners.reduce((s, h) => s + h.unrealizedPnLPercent, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, h) => s + h.unrealizedPnLPercent, 0) / losers.length : 0;

    // days tracked from earliest tx
    const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = sortedTx[0]?.date;
    const daysTracked = firstDate
      ? Math.max(1, Math.round((Date.now() - new Date(firstDate).getTime()) / 86400000))
      : 0;

    return {
      contributions,
      best,
      worst,
      biggestWinner,
      biggestLoser,
      totalValue,
      top1Share,
      top3Share,
      hhi,
      diversification,
      firstDate,
      daysTracked,
      winRate,
      avgWin,
      avgLoss,
    };
  }, [holdings, transactions]);

  const monthly = useMemo(() => {
    const rows = monthlyStats(transactions).slice(0, 12).reverse();
    return rows.map((r) => ({
      month: monthLabel(r.month),
      buys: r.buys,
      sells: r.sells,
      net: r.buys - r.sells,
      realized: r.realizedPnL,
    }));
  }, [transactions]);

  const openCount = holdings.filter((h) => h.amount > 0).length;
  const concentrationTone =
    top1Share >= 60 ? "negative" : top1Share >= 40 ? "warning" : "positive";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Contribution to P&L */}
      <Card className="lg:col-span-2 border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">P&amp;L Contribution</CardTitle>
            <span className="text-xs text-muted-foreground">Unrealized, per asset</span>
          </div>
        </CardHeader>
        <CardContent className="h-72 pl-1">
          {contributions.length === 0 ? (
            <EmptyBlock label="No open positions" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributions}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatUSD(v, { compact: true, maximumFractionDigits: 1 })}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  width={56}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
                  formatter={(v: number, _n, p) => [
                    `${formatSignedUSD(v)} · ${formatPercent((p?.payload as { pct: number }).pct)}`,
                    "P&L",
                  ]}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="pnl" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                  {contributions.map((c, i) => (
                    <Cell
                      key={i}
                      fill={c.pnl >= 0 ? "var(--color-positive)" : "var(--color-negative)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Concentration & health */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Portfolio Health</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <StatRow
            icon={<Scale className="h-3.5 w-3.5" />}
            label="Diversification"
            value={`${diversification.toFixed(0)} / 100`}
            hint={`${openCount} asset${openCount === 1 ? "" : "s"} · HHI ${hhi.toFixed(2)}`}
          >
            <Progress value={diversification} className="h-1.5" />
          </StatRow>

          <StatRow
            icon={<Target className="h-3.5 w-3.5" />}
            label="Top-holding weight"
            value={`${top1Share.toFixed(1)}%`}
            hint={`Top 3 · ${top3Share.toFixed(1)}%`}
            tone={concentrationTone}
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  concentrationTone === "positive" && "bg-positive",
                  concentrationTone === "warning" && "bg-amber-500",
                  concentrationTone === "negative" && "bg-negative",
                )}
                style={{ width: `${Math.min(100, top1Share)}%` }}
              />
            </div>
          </StatRow>

          <StatRow
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Win rate"
            value={`${winRate.toFixed(0)}%`}
            hint={
              openCount > 0
                ? `Avg win ${formatPercent(avgWin)} · loss ${formatPercent(avgLoss)}`
                : "No open positions"
            }
          >
            <Progress value={winRate} className="h-1.5" />
          </StatRow>

          <StatRow
            icon={<Timer className="h-3.5 w-3.5" />}
            label="Tracking since"
            value={firstDate ? new Date(firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            hint={daysTracked > 0 ? `${daysTracked} day${daysTracked === 1 ? "" : "s"}` : "Add a transaction"}
          />
        </CardContent>
      </Card>

      {/* Top movers */}
      <Card className="border-border/60 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Movers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <MoverRow
            tone="positive"
            label="Best %"
            symbol={best?.symbol}
            primary={best ? formatPercent(best.unrealizedPnLPercent) : "—"}
            secondary={best ? formatSignedUSD(best.unrealizedPnL) : ""}
          />
          <MoverRow
            tone="negative"
            label="Worst %"
            symbol={worst && worst !== best ? worst.symbol : undefined}
            primary={worst && worst !== best ? formatPercent(worst.unrealizedPnLPercent) : "—"}
            secondary={worst && worst !== best ? formatSignedUSD(worst.unrealizedPnL) : ""}
          />
          <MoverRow
            tone="positive"
            label="Biggest $"
            symbol={biggestWinner?.symbol}
            primary={biggestWinner ? formatSignedUSD(biggestWinner.unrealizedPnL) : "—"}
            secondary={biggestWinner ? formatPercent(biggestWinner.unrealizedPnLPercent) : ""}
          />
          <MoverRow
            tone="negative"
            label="Biggest drag"
            symbol={biggestLoser && biggestLoser !== biggestWinner ? biggestLoser.symbol : undefined}
            primary={biggestLoser && biggestLoser !== biggestWinner ? formatSignedUSD(biggestLoser.unrealizedPnL) : "—"}
            secondary={biggestLoser && biggestLoser !== biggestWinner ? formatPercent(biggestLoser.unrealizedPnLPercent) : ""}
          />
        </CardContent>
      </Card>

      {/* Monthly cash flow */}
      <Card className="border-border/60 lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Buy vs Sell Flow</CardTitle>
            <span className="text-xs text-muted-foreground">Last {monthly.length} month{monthly.length === 1 ? "" : "s"}</span>
          </div>
        </CardHeader>
        <CardContent className="h-64 pl-1">
          {monthly.length === 0 ? (
            <EmptyBlock label="No activity yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v) => formatUSD(v, { compact: true, maximumFractionDigits: 1 })}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklab, var(--color-foreground) 6%, transparent)" }}
                  formatter={(v: number, name: string) => [formatUSD(v), name === "buys" ? "Buys" : "Sells"]}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--color-foreground)",
                  }}
                />
                <Bar dataKey="buys" stackId="a" fill="var(--color-positive)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="sells" stackId="a" fill="var(--color-negative)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const AnalyticsPanel = memo(AnalyticsPanelImpl);

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
  hint,
  tone,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "warning" | "default";
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground/80">{icon}</span>
          {label}
        </div>
        <div
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
            tone === "warning" && "text-amber-500",
          )}
        >
          {value}
        </div>
      </div>
      {children && <div className="mt-2">{children}</div>}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MoverRow({
  tone,
  label,
  symbol,
  primary,
  secondary,
}: {
  tone: "positive" | "negative";
  label: string;
  symbol?: string;
  primary: string;
  secondary?: string;
}) {
  const Icon = tone === "positive" ? ArrowUpRight : ArrowDownRight;
  const TrendIcon = tone === "positive" ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 p-2.5">
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md",
          tone === "positive" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative",
        )}
        aria-hidden="true"
      >
        <TrendIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
          <Icon className="h-3 w-3" aria-hidden="true" />
        </div>
        <div className="truncate text-sm font-semibold">
          {symbol ? symbol.toUpperCase() : "—"}
        </div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            tone === "positive" ? "text-positive" : "text-negative",
          )}
        >
          {primary}
        </div>
        {secondary && (
          <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
}