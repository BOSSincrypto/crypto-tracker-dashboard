import { memo, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { formatSignedUSD, formatPercent, formatUSD } from "@/lib/crypto/format";
import type { PortfolioSnapshot, Transaction } from "@/lib/crypto/types";

type Range = "7d" | "30d" | "90d" | "all";

interface Props {
  snapshots: PortfolioSnapshot[];
  transactions: Transaction[];
  currentValue: number;
  invested: number;
}

function addDays(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

function PortfolioLineChartImpl({ snapshots, transactions, currentValue, invested }: Props) {
  const [range, setRange] = useState<Range>("30d");

  // Earliest transaction date drives a synthetic "start" point when the
  // snapshot history is too sparse to draw a line (e.g. the user just
  // imported data and only today's snapshot exists).
  const earliestTxDate = useMemo(() => {
    if (transactions.length === 0) return null;
    let min = transactions[0].date;
    for (const t of transactions) if (t.date < min) min = t.date;
    return min.slice(0, 10);
  }, [transactions]);

  const merged = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snapshots) map.set(s.date, s.totalValue);
    const today = new Date().toISOString().slice(0, 10);
    if (currentValue > 0 || map.size > 0) map.set(today, currentValue);
    // Seed a starting point at the first transaction date so the line has
    // a real slope even before daily snapshots accumulate. Cost basis is
    // a fair approximation for "value at buy time" for buy transactions.
    if (earliestTxDate && !map.has(earliestTxDate) && invested > 0) {
      map.set(earliestTxDate, invested);
    }
    return [...map.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots, currentValue, earliestTxDate, invested]);

  const filtered = useMemo(() => {
    if (merged.length === 0) return merged;
    if (range === "all") return merged;
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = addDays(new Date().toISOString().slice(0, 10), -days);
    const inRange = merged.filter((p) => p.date >= cutoff);
    // seed with last point before cutoff so the line starts on the left edge
    const before = merged.filter((p) => p.date < cutoff).pop();
    return before ? [{ ...before, date: cutoff }, ...inRange] : inRange;
  }, [merged, range]);

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const first = filtered[0].value;
    const last = filtered[filtered.length - 1].value;
    const change = last - first;
    const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    const values = filtered.map((p) => p.value);
    // Include the cost-basis reference line in the Y-domain so it's never
    // clipped outside the visible chart area.
    if (invested > 0) values.push(invested);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || max * 0.05 || 1;
    return { first, last, change, changePct, min: Math.max(0, min - pad), max: max + pad };
  }, [filtered, invested]);

  const positive = (stats?.change ?? 0) >= 0;
  const stroke = positive ? "#10B981" : "#EF4444";

  const spanDays = filtered.length > 1 ? daysBetween(filtered[0].date, filtered[filtered.length - 1].date) : 0;
  const xFormatter = (v: string) => {
    const d = new Date(v + "T00:00:00Z");
    return spanDays > 60
      ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Portfolio Value</CardTitle>
          {stats && (
            <div className="flex items-baseline gap-2 font-mono text-sm">
              <span className="text-lg font-semibold text-foreground">{formatUSD(stats.last)}</span>
              <span className={positive ? "text-emerald-500" : "text-red-500"}>
                {formatSignedUSD(stats.change)} ({formatPercent(stats.changePct)})
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d", "all"] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "secondary" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setRange(r)}
            >
              {r.toUpperCase()}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-72">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Add a transaction to start tracking value
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
                tickFormatter={xFormatter}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
                domain={stats ? [stats.min, stats.max] : ["auto", "auto"]}
                tickFormatter={(v) => formatUSD(v, { compact: true, maximumFractionDigits: 1 })}
                width={70}
              />
              <Tooltip
                formatter={(v: number) => [formatUSD(v), "Value"]}
                labelFormatter={(l) => new Date(l + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-foreground)",
                }}
                itemStyle={{ color: "var(--color-foreground)" }}
              />
              {invested > 0 && (
                <ReferenceLine
                  y={invested}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: "Cost basis", position: "insideTopRight", fontSize: 10, fill: "var(--color-muted-foreground)" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke={stroke}
                strokeWidth={2}
                fill="url(#fillValue)"
                isAnimationActive={false}
                dot={filtered.length <= 2 ? { r: 3, fill: stroke } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export const PortfolioLineChart = memo(PortfolioLineChartImpl);