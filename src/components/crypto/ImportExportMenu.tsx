import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { downloadFile, fromCSV, fromJSON, ImportError, MAX_IMPORT_BYTES, toCSV, toJSON } from "@/lib/crypto/import-export";
import type { Transaction } from "@/lib/crypto/types";

interface Props {
  transactions: Transaction[];
  onReplace: (txs: Transaction[]) => void;
  onMerge: (txs: Transaction[]) => void;
}

export function ImportExportMenu({ transactions, onReplace, onMerge }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Transaction[] | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  function exportJSON() {
    try {
      downloadFile(
        `crypto-tracker-${new Date().toISOString().slice(0, 10)}.json`,
        toJSON(transactions),
        "application/json",
      );
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not create the JSON file.",
      });
    }
  }

  function exportCSV() {
    try {
      downloadFile(
        `crypto-tracker-${new Date().toISOString().slice(0, 10)}.csv`,
        toCSV(transactions),
        "text/csv",
      );
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not create the CSV file.",
      });
    }
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("File too large", {
        description: `Maximum import size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB.`,
      });
      return;
    }
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith(".csv");
    const isJson = name.endsWith(".json");
    if (!isCsv && !isJson) {
      toast.error("Unsupported file type", {
        description: "Please choose a .json or .csv file.",
      });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read file", { description: "The file may be corrupted or unreadable." });
      return;
    }
    try {
      const parsed = isCsv ? fromCSV(text) : fromJSON(text);
      if (parsed.length === 0) {
        toast.error("File contains no transactions.");
        return;
      }
      setPending(parsed);
    } catch (err) {
      const message =
        err instanceof ImportError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error while parsing.";
      toast.error("Import failed", { description: message });
    }
  }

  function confirmImport() {
    if (!pending) return;
    if (mode === "replace") onReplace(pending);
    else onMerge(pending);
    toast.success(`Imported ${pending.length} transactions.`);
    setPending(null);
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={handleFile} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" aria-label="Export">
            <Download className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportCSV}>Download CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={exportJSON}>Download JSON</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" onClick={triggerImport} aria-label="Import">
        <Upload className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Import</span>
      </Button>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import {pending?.length ?? 0} transactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Preview of first 3: {pending?.slice(0, 3).map((t) => `${t.type} ${t.amount} ${t.symbol.toUpperCase()}`).join(", ")}
            </p>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="merge" id="mode-merge" />
                <Label htmlFor="mode-merge">Merge (skip duplicates by ID)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="replace" id="mode-replace" />
                <Label htmlFor="mode-replace">Replace all existing transactions</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={confirmImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}