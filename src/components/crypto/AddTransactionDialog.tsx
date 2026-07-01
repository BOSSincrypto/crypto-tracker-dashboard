import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useCoinSearch } from "@/hooks/use-coin-search";
import { getCurrentPrice } from "@/lib/crypto/coingecko";
import type { CoinSearchResult, Transaction, TransactionType } from "@/lib/crypto/types";
import { TX_TYPES } from "@/lib/crypto/types";
import { toast } from "sonner";
import { CASH_COIN_ID } from "@/lib/crypto/calculations";
import { cn } from "@/lib/utils";

interface Props {
  onAdd?: (tx: Omit<Transaction, "id">) => void;
  /** When provided, dialog is in "edit" mode and calls onUpdate on submit. */
  initial?: Transaction | null;
  onUpdate?: (id: string, patch: Omit<Transaction, "id">) => void;
  /** Controlled open state — pass together with `onOpenChange` for edit mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPE_META: Record<TransactionType, { label: string; hint: string }> = {
  buy: { label: "Buy", hint: "Bought crypto" },
  sell: { label: "Sell", hint: "Sold crypto" },
  reward: { label: "Reward", hint: "Airdrop / staking / yield" },
  deposit: { label: "Deposit", hint: "Fiat in" },
  withdraw: { label: "Withdraw", hint: "Fiat out" },
};
// Display order differs from the canonical enum order.
const TYPES: TransactionType[] = ["buy", "sell", "reward", "deposit", "withdraw"];
// Sanity: catch a drifted TX_TYPES tuple at build time.
if (import.meta.env.DEV && TYPES.length !== TX_TYPES.length) {
  console.warn("AddTransactionDialog: TYPES length drift vs TX_TYPES");
}

export function AddTransactionDialog({ onAdd, initial, onUpdate, open: openProp, onOpenChange }: Props) {
  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = isControlled ? !!openProp : openState;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setOpenState(v);
  };
  const editMode = !!initial;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CoinSearchResult | null>(null);
  const [type, setType] = useState<TransactionType>("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const search = useCoinSearch(query);
  const isCash = type === "deposit" || type === "withdraw";
  const isReward = type === "reward";

  function reset() {
    setQuery("");
    setSelected(null);
    setType("buy");
    setAmount("");
    setPrice("");
    setFee("");
    setDate(new Date().toISOString().slice(0, 10));
    setNote("");
  }

  // Populate the form from `initial` whenever the dialog opens in edit mode.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type);
      setAmount(String(initial.amount));
      setPrice(String(initial.pricePerCoin));
      setFee(initial.fee ? String(initial.fee) : "");
      setDate(initial.date.slice(0, 10));
      setNote(initial.note ?? "");
      const isCashTx = initial.type === "deposit" || initial.type === "withdraw";
      if (isCashTx) {
        setSelected(null);
        setQuery("");
      } else {
        setSelected({ id: initial.coinId, symbol: initial.symbol, name: initial.name });
        setQuery(initial.name);
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  async function pickCoin(coin: CoinSearchResult) {
    setSelected(coin);
    setQuery(coin.name);
    if (!price) {
      try {
        const p = await getCurrentPrice(coin.id);
        if (p > 0) setPrice(String(p));
      } catch {
        // silent
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCash && !selected) {
      toast.error("Please select a coin from the search results.");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }
    if (amt > 1e15) {
      toast.error("Amount is unrealistically large. Please check your input.");
      return;
    }
    const prc = isCash ? 1 : Number(price || (isReward ? "0" : ""));
    if (!Number.isFinite(prc) || prc < 0) {
      toast.error("Price must be a non-negative number.");
      return;
    }
    // Date sanity: valid, not > 1 day in the future.
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please enter a valid date.");
      return;
    }
    if (parsedDate.getTime() - Date.now() > 24 * 60 * 60 * 1000) {
      toast.error("Date cannot be in the future.");
      return;
    }
    const feeNum = fee ? Number(fee) : undefined;
    if (feeNum !== undefined && (!Number.isFinite(feeNum) || feeNum < 0)) {
      toast.error("Fee must be a non-negative number.");
      return;
    }
    if (note && note.length > 500) {
      toast.error("Note must be under 500 characters.");
      return;
    }
    const payload: Omit<Transaction, "id"> = {
      coinId: isCash ? CASH_COIN_ID : selected!.id,
      symbol: isCash ? "USD" : selected!.symbol,
      name: isCash ? "Cash" : selected!.name,
      type,
      amount: amt,
      pricePerCoin: prc,
      date: parsedDate.toISOString(),
      note: note.trim() || undefined,
      fee: feeNum && feeNum > 0 ? feeNum : undefined,
    };
    try {
      if (editMode && initial && onUpdate) {
        onUpdate(initial.id, payload);
        toast.success("Transaction updated.");
      } else if (onAdd) {
        onAdd(payload);
        toast.success("Transaction added.");
      }
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Could not save transaction", {
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" aria-label="Add transaction">
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Add Transaction</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editMode ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div
              role="radiogroup"
              aria-label="Transaction type"
              className="grid grid-cols-5 gap-1 rounded-md border border-border/60 bg-muted/30 p-1"
            >
              {TYPES.map((value) => {
                const meta = TYPE_META[value];
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(value)}
                    className={cn(
                      "rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title={meta.hint}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{TYPE_META[type].hint}</p>
          </div>

          {!isCash && (
          <div className="space-y-2">
            <Label>Coin</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                placeholder="Search e.g. bitcoin"
                className="pl-8"
              />
            </div>
            {!selected && query.trim().length >= 2 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {search.isLoading && <div className="p-2 text-xs text-muted-foreground">Searching…</div>}
                {search.error && <div className="p-2 text-xs text-red-500">Search failed.</div>}
                {search.data?.map((coin) => (
                  <button
                    key={coin.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => pickCoin(coin)}
                  >
                    {coin.thumb && (
                      <img
                        src={coin.thumb}
                        alt=""
                        className="h-4 w-4"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="font-medium">{coin.name}</span>
                    <span className="text-xs uppercase text-muted-foreground">{coin.symbol}</span>
                  </button>
                ))}
                {search.data && search.data.length === 0 && !search.isLoading && (
                  <div className="p-2 text-xs text-muted-foreground">No results.</div>
                )}
              </div>
            )}
            {selected && (
              <div className="text-xs text-muted-foreground">Selected: {selected.name} ({selected.symbol.toUpperCase()})</div>
            )}
          </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">{isCash ? "Amount (USD)" : "Amount"}</Label>
              <Input id="amount" type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            {!isCash && (
              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (USD) {isReward && <span className="text-muted-foreground">— cost basis</span>}
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={isReward ? "0 for airdrop" : ""}
                  required={!isReward}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">Fee (USD) <span className="text-muted-foreground">— optional</span></Label>
              <Input id="fee" type="number" step="any" min="0" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">{editMode ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}