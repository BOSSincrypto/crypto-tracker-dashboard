import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cn } from "@/lib/utils";
import { formatUSD, formatSignedUSD } from "@/lib/crypto/format";
import { monthlyStats } from "@/lib/crypto/calculations";
import type { Transaction } from "@/lib/crypto/types";

interface Props {
  transactions: Transaction[];
}

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function labelForMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return MONTH_FMT.format(new Date(y, (m || 1) - 1, 1));
}

function MonthlySummaryTableImpl({ transactions }: Props) {
  const rows = useMemo(() => monthlyStats(transactions), [transactions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Deposits</TableHead>
                <TableHead className="text-right">Withdrawals</TableHead>
                <TableHead className="text-right">Buys</TableHead>
                <TableHead className="text-right">Sells</TableHead>
                <TableHead className="text-right">Rewards</TableHead>
                <TableHead className="text-right">Realized P&amp;L</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                    No activity yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const pnlPos = r.realizedPnL > 0;
                const pnlNeg = r.realizedPnL < 0;
                return (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{labelForMonth(r.month)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sky-500">
                      {r.deposits > 0 ? formatUSD(r.deposits) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-amber-500">
                      {r.withdrawals > 0 ? formatUSD(r.withdrawals) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.buys > 0 ? formatUSD(r.buys) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.sells > 0 ? formatUSD(r.sells) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-primary">
                      {r.rewards > 0 ? formatUSD(r.rewards) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        pnlPos && "text-positive",
                        pnlNeg && "text-negative",
                        !pnlPos && !pnlNeg && "text-muted-foreground",
                      )}
                    >
                      {r.realizedPnL !== 0 ? formatSignedUSD(r.realizedPnL) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {r.fees > 0 ? formatUSD(r.fees) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {r.txCount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export const MonthlySummaryTable = memo(MonthlySummaryTableImpl);
