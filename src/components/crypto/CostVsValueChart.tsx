import { memo, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatPercent, formatUSD } from "@/lib/crypto/format";
import { costBasisTimeline } from "@/lib/crypto/analytics";
import type { PortfolioSnapshot, Transaction } from "@/lib/crypto/types";

interface Props {
  snapshots: PortfolioSnapshot[];
  transactions: Transaction[];
}

const AXIS_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const FULL_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

function CostVsValueChartImpl({ snapshots, transactions }: Props) {
  const data = useMemo(() => {
    if (snapshots.length === 0) return [] as Array<{ date: string; value: number; cost: number; invested: number; pnl: number; pnlPct: number }>;
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    const timeline = costBasisTimeline(transactions, sorted.map((s) => s.date));
    const map = new Map(timeline.map((t) => [t.date, t]));
    return sorted.map((s) => {
      const t = map.get(s.date);
      const cost = t?.costBasis ?? 0;
      const invested = t?.netInvested ?? 0;
      const pnl = s.totalValue - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      return { date: s.date, value: s.totalValue, cost, invested, pnl, pnlPct };
    });
  }, [snapshots, transactions]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Cost Basis vs Value</CardTitle>
          <span className="text-xs text-muted-foreground">Break-even overlay</span>
        </div>
      </CardHeader>
      <CardContent className="h-72 pl-1">
        {data.length < 2 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Not enough snapshots yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-muted-foreground)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-muted-foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => AXIS_FMT.format(new Date(d))}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v) => formatUSD(v, { compact: true, maximumFractionDigits: 1 })}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as (typeof data)[number];
                  const positive = row.pnl >= 0;
                  return (
                    <div className="min-w-[180px] rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
                      <div className="font-medium">{FULL_FMT.format(new Date(label as string))}</div>
                      <Line3 label="Value" value={formatUSD(row.value)} accent="var(--color-primary)" />
                      <Line3 label="Cost basis" value={formatUSD(row.cost)} accent="var(--color-muted-foreground)" />
                      <Line3
                        label="P&L"
                        value={`${positive ? "+" : ""}${formatUSD(row.pnl)} · ${formatPercent(row.pnlPct)}`}
                        accent={positive ? "var(--color-positive)" : "var(--color-negative)"}
                      />
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                height={24}
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ fontSize: 11, color: "var(--color-muted-foreground)" }}
              />
              <Area
                name="Value"
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#valueFill)"
                isAnimationActive={false}
              />
              <Area
                name="Cost basis"
                type="monotone"
                dataKey="cost"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="url(#costFill)"
                isAnimationActive={false}
              />
              <Line
                name="Net deposited"
                type="monotone"
                dataKey="invested"
                stroke="oklch(0.72 0.14 55)"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function Line3({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />
        {label}
      </span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
export const CostVsValueChart = memo(CostVsValueChartImpl);
