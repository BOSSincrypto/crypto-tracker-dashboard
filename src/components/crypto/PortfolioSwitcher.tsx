import { useState } from "react";
import { Check, ChevronDown, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import type { Portfolio } from "@/lib/crypto/types";
import { ALL_PORTFOLIOS_ID } from "@/lib/crypto/storage";

interface Props {
  portfolios: Portfolio[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PortfolioSwitcher({ portfolios, activeId, onSelect, onCreate, onRename, onDelete }: Props) {
  const [dialog, setDialog] = useState<null | { mode: "create" } | { mode: "rename"; id: string; initial: string }>(null);
  const [name, setName] = useState("");
  const isAll = activeId === ALL_PORTFOLIOS_ID;
  const active = portfolios.find((p) => p.id === activeId);
  const displayName = isAll ? "Total Portfolio" : active?.name ?? "Portfolio";

  function openCreate() {
    setName("");
    setDialog({ mode: "create" });
  }
  function openRename() {
    if (!active) return;
    setName(active.name);
    setDialog({ mode: "rename", id: active.id, initial: active.name });
  }
  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Portfolio name cannot be empty.");
      return;
    }
    if (trimmed.length > 40) {
      toast.error("Portfolio name must be under 40 characters.");
      return;
    }
    // Prevent duplicate names (case-insensitive) — silently allowing dupes
    // makes the switcher list ambiguous.
    const collision = portfolios.find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() &&
        !(dialog?.mode === "rename" && p.id === dialog.id),
    );
    if (collision) {
      toast.error("A portfolio with this name already exists.");
      return;
    }
    try {
      if (dialog?.mode === "create") {
        onCreate(trimmed);
        toast.success(`Created "${trimmed}"`);
      } else if (dialog?.mode === "rename") {
        onRename(dialog.id, trimmed);
        toast.success("Portfolio renamed");
      }
      setDialog(null);
    } catch (err) {
      toast.error("Action failed", {
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }
  function handleDelete() {
    if (!active) return;
    if (!confirm(`Delete portfolio "${active.name}"? Its transactions will be removed.`)) return;
    onDelete(active.id);
    toast.success("Portfolio deleted");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="min-w-0 max-w-[10rem] justify-between sm:min-w-[10rem]">
            <span className="truncate">{displayName}</span>
            <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Portfolios</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSelect(ALL_PORTFOLIOS_ID)}>
            <Check className={`mr-2 h-4 w-4 ${isAll ? "opacity-100" : "opacity-0"}`} />
            <Layers className="mr-2 h-4 w-4 opacity-70" />
            <span className="truncate font-medium">Total Portfolio</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {portfolios.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => onSelect(p.id)}>
              <Check className={`mr-2 h-4 w-4 ${p.id === activeId ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New portfolio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openRename} disabled={!active || isAll}>
            <Pencil className="mr-2 h-4 w-4" /> Rename current
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} disabled={!active || isAll} className="text-red-500 focus:text-red-500">
            <Trash2 className="mr-2 h-4 w-4" /> Delete current
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "create" ? "New portfolio" : "Rename portfolio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="portfolio-name">Name</Label>
            <Input
              id="portfolio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Long-term, Trading, DeFi"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={submit}>{dialog?.mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}