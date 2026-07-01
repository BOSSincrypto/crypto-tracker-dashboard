import { memo, useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatSignedUSD, formatUSD } from "@/lib/crypto/format";
import { cashFlowWaterfall, type WaterfallStep } from "@/lib/crypto/analytics";
import type { PortfolioSummary } from "@/lib/crypto/calculations";

interface Props {
  summary: PortfolioSummary;
}

interface Row {
  label: string;
  base: number;
  delta: number;
  step: WaterfallStep;
}

function colorFor(kind: WaterfallStep["kind"]) {
  switch (kind) {
    case "in":
      return "oklch(0.7 0.15 220)"; // sky
    case "out":
      return "oklch(0.72 0.14 55)"; // amber
    case "gain":
      return "var(--color-positive)";
    case "loss":
      return "var(--color-negative)";
    case "total":
      return "var(--color-primary)";
  }
}

function CashFlowWaterfallImpl({ summary }: Props) {
  const rows = useMemo<Row[]>(() => {
    const steps = cashFlowWaterfall({
      totalDeposits: summary.totalDeposits,
      totalWithdrawals: summary.totalWithdrawals,
      rewardsIncome: summary.rewardsIncome,
      realizedPnL: summary.realizedPnL,
      totalFees: summary.totalFees,
      unrealizedPnL: summary.unrealizedPnL,
      totalValue: summary.totalValue,
    });
    return steps.map((step, i) => {
      if (step.kind === "total") return { label: step.label, base: 0, delta: step.value, step };
      const prev = i === 0 ? 0 : steps[i - 1].running;
      // Base is the lower of {prev, prev+value}; works when `prev` is
      // negative (net-loss portfolios) and never clips into the axis.
      const base = Math.min(prev, prev + step.value);
      const delta = Math.abs(step.value);
      return { label: step.label, base, delta, step };
    });
  }, [summary]);

  const empty = summary.totalDeposits === 0 && summary.totalValue === 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Value Attribution</CardTitle>
          <span className="text-xs text-muted-foreground">Where your value comes from</span>
        </div>
      </CardHeader>
      <CardContent className="h-80 pl-1">
        {empty ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Add a deposit and a buy to visualize attribution.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 24, right: 16, left: 8, bottom: 24 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
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
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as Row;
                  return (
                    <div className="rounded-lg border border-border bg-popover p-2.5 text-xs shadow-md">
                      <div className="font-medium">{row.label}</div>
                      <div className="mt-1 font-mono tabular-nums text-muted-foreground">
                        {row.step.kind === "total"
                          ? formatUSD(row.step.value)
                          : formatSignedUSD(row.step.value)}
                      </div>
                      {row.step.kind !== "total" && (
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          Running · {formatUSD(row.step.running)}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="delta" stackId="w" radius={[4, 4, 4, 4]} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={colorFor(r.step.kind)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
export const CashFlowWaterfall = memo(CashFlowWaterfallImpl);
