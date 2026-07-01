import { memo, useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarClock, Flame, ShieldAlert, Sigma, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";
import { formatPercent, formatSignedUSD, formatUSD } from "@/lib/crypto/format";
import { computeRiskMetrics } from "@/lib/crypto/analytics";
import type { PortfolioSnapshot } from "@/lib/crypto/types";

interface Props {
  snapshots: PortfolioSnapshot[];
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function fmtDate(d?: string) {
  if (!d) return "—";
  return DATE_FMT.format(new Date(d));
}

function RiskMetricsPanelImpl({ snapshots }: Props) {
  const m = useMemo(() => computeRiskMetrics(snapshots), [snapshots]);
  const hasData = snapshots.length >= 2;
  const totalDays = m.positiveDays + m.negativeDays;
  const winPct = totalDays > 0 ? (m.positiveDays / totalDays) * 100 : 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Risk &amp; Volatility</CardTitle>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {hasData ? `${snapshots.length} snapshots` : "Awaiting data"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {!hasData ? (
          <div className="grid h-40 place-items-center text-sm text-muted-foreground">
            Refresh a few times to accumulate price snapshots.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric
              Icon={ShieldAlert}
              label="Max drawdown"
              value={formatPercent(m.maxDrawdown)}
              hint={
                m.maxDrawdownAbs !== 0
                  ? `${formatSignedUSD(m.maxDrawdownAbs)} · ${fmtDate(m.peakDate)} → ${fmtDate(m.troughDate)}`
                  : "No drawdown"
              }
              tone={m.maxDrawdown < 0 ? "negative" : "default"}
            />
            <Metric
              Icon={CalendarClock}
              label="From ATH"
              value={formatPercent(m.currentDrawdown)}
              hint={
                m.athValue > 0
                  ? `ATH ${formatUSD(m.athValue)} · ${m.daysSinceATH}d ago`
                  : "No history"
              }
              tone={m.currentDrawdown < -0.5 ? "negative" : m.currentDrawdown >= 0 ? "positive" : "default"}
            />
            <Metric
              Icon={Sigma}
              label="Daily volatility"
              value={`${m.volatility.toFixed(2)}%`}
              hint={`Avg daily ${formatPercent(m.avgDailyReturn)}`}
            />
            <Metric
              Icon={ArrowUpRight}
              label="Best day"
              value={m.bestDay ? formatPercent(m.bestDay.changePct) : "—"}
              hint={m.bestDay ? `${fmtDate(m.bestDay.date)} · ${formatSignedUSD(m.bestDay.changeAbs)}` : ""}
              tone={m.bestDay ? "positive" : "default"}
            />
            <Metric
              Icon={ArrowDownRight}
              label="Worst day"
              value={m.worstDay ? formatPercent(m.worstDay.changePct) : "—"}
              hint={m.worstDay ? `${fmtDate(m.worstDay.date)} · ${formatSignedUSD(m.worstDay.changeAbs)}` : ""}
              tone={m.worstDay ? "negative" : "default"}
            />
            <Metric
              Icon={m.streak.direction === "down" ? Activity : Flame}
              label="Current streak"
              value={
                m.streak.length > 0
                  ? `${m.streak.length}d ${m.streak.direction === "up" ? "▲" : m.streak.direction === "down" ? "▼" : "="}`
                  : "—"
              }
              hint={
                totalDays > 0
                  ? `Green ${m.positiveDays} · Red ${m.negativeDays} (${winPct.toFixed(0)}% up)`
                  : ""
              }
              tone={
                m.streak.direction === "up"
                  ? "positive"
                  : m.streak.direction === "down"
                    ? "negative"
                    : "default"
              }
            />
          </div>
        )}

        {hasData && totalDays > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" aria-hidden="true" /> Up / Down days
              </span>
              <span className="font-mono tabular-nums">
                {m.positiveDays} · {m.negativeDays}
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-positive"
                style={{ width: `${winPct}%` }}
                aria-label={`Positive days ${winPct.toFixed(0)}%`}
              />
              <div
                className="h-full bg-negative"
                style={{ width: `${100 - winPct}%` }}
                aria-label={`Negative days ${(100 - winPct).toFixed(0)}%`}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "default";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
            tone === "default" && "text-muted-foreground",
          )}
        />
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}
export const RiskMetricsPanel = memo(RiskMetricsPanelImpl);
