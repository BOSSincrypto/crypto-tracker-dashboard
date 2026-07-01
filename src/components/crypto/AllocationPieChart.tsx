import { memo, useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { formatUSD } from "@/lib/crypto/format";
import type { HoldingWithPrice } from "@/lib/crypto/types";

const COLORS = [
  "oklch(0.74 0.17 155)",
  "oklch(0.7 0.15 220)",
  "oklch(0.78 0.16 80)",
  "oklch(0.72 0.19 305)",
  "oklch(0.7 0.21 25)",
  "oklch(0.75 0.15 195)",
  "oklch(0.72 0.18 340)",
  "oklch(0.8 0.16 60)",
  "oklch(0.68 0.15 260)",
  "oklch(0.76 0.16 130)",
];

interface Props {
  holdings: HoldingWithPrice[];
}

function AllocationPieChartImpl({ holdings }: Props) {
  const { data, total } = useMemo(() => {
    const filtered = holdings.filter((h) => h.currentValue > 0);
    const total = filtered.reduce((s, h) => s + h.currentValue, 0);
    const data = filtered
      .map((h) => ({ name: h.symbol.toUpperCase(), value: h.currentValue }))
      .sort((a, b) => b.value - a.value);
    return { data, total };
  }, [holdings]);

  return (
    <Card className="h-full border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Allocation</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
            <span>No open positions</span>
            <span className="text-xs">Add a Buy to see allocation</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                stroke="var(--color-background)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [
                  `${formatUSD(v)} · ${((v / total) * 100).toFixed(1)}%`,
                  "Value",
                ]}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-foreground)",
                }}
                itemStyle={{ color: "var(--color-foreground)" }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export const AllocationPieChart = memo(AllocationPieChartImpl);