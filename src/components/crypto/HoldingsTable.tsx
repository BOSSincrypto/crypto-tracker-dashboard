import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatSignedUSD, formatUSD } from "@/lib/crypto/format";
import type { HoldingWithPrice } from "@/lib/crypto/types";

interface Props {
  holdings: HoldingWithPrice[];
  isLoading?: boolean;
}

function HoldingsTableImpl({ holdings, isLoading }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Holdings</CardTitle>
        {isLoading && <span className="text-xs text-muted-foreground">Refreshing prices…</span>}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Avg Buy</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No open positions. Add your first transaction to get started.
                  </TableCell>
                </TableRow>
              )}
              {holdings.map((h) => {
                const positive = h.unrealizedPnL >= 0;
                return (
                  <TableRow key={h.coinId}>
                    <TableCell>
                      <div className="font-medium">{h.symbol.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">{h.name}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNumber(h.amount)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUSD(h.avgBuyPrice)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUSD(h.currentPrice)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatUSD(h.currentValue)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono tabular-nums",
                        positive ? "text-emerald-500" : "text-red-500",
                      )}
                    >
                      <div>{formatSignedUSD(h.unrealizedPnL)}</div>
                      <div className="text-xs">{formatPercent(h.unrealizedPnLPercent)}</div>
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

export const HoldingsTable = memo(HoldingsTableImpl);