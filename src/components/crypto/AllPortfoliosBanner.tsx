import { Layers } from "lucide-react";

interface Props {
  count: number;
}

/**
 * Info banner shown at the top of the aggregated "All portfolios" view
 * to explain the read-only behavior.
 */
export function AllPortfoliosBanner({ count }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Aggregated view across {count} portfolio{count === 1 ? "" : "s"} — read-only. Switch to a single portfolio to edit.
      </span>
    </div>
  );
}