import { memo, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { formatNumber, formatUSD } from "@/lib/crypto/format";
import type { Transaction, TransactionType } from "@/lib/crypto/types";
import { cn } from "@/lib/utils";

interface Props {
  transactions: Transaction[];
  onRemove?: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
}

const TYPE_STYLE: Record<TransactionType, string> = {
  buy: "bg-positive/15 text-positive hover:bg-positive/20",
  sell: "bg-negative/15 text-negative hover:bg-negative/20",
  reward: "bg-primary/15 text-primary hover:bg-primary/20",
  deposit: "bg-sky-500/15 text-sky-500 hover:bg-sky-500/20",
  withdraw: "bg-amber-500/15 text-amber-500 hover:bg-amber-500/20",
};

function TransactionsTableImpl({ transactions, onRemove, onEdit }: Props) {
  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((tx) => {
                const isCash = tx.type === "deposit" || tx.type === "withdraw";
                const total = isCash ? tx.amount : tx.amount * tx.pricePerCoin;
                return (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">{tx.date.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(TYPE_STYLE[tx.type])}>
                      {tx.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{tx.symbol.toUpperCase()}</div>
                    <div className="text-xs text-muted-foreground">{tx.name}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{isCash ? formatUSD(tx.amount) : formatNumber(tx.amount)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{isCash ? "—" : formatUSD(tx.pricePerCoin)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatUSD(total)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {tx.fee ? formatUSD(tx.fee) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <Button variant="ghost" size="icon" onClick={() => onEdit(tx)} aria-label="Edit transaction">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onRemove && (
                        <Button variant="ghost" size="icon" onClick={() => onRemove(tx.id)} aria-label="Delete transaction">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

export const TransactionsTable = memo(TransactionsTableImpl);