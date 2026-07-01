import { memo } from "react";

interface Props {
  isFetching: boolean;
}

/**
 * Pulsing "Live / Refreshing" chip in the header. Purely presentational.
 */
function LiveStatusIndicatorImpl({ isFetching }: Props) {
  return (
    <div
      className="hidden items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground md:flex"
      aria-live="polite"
    >
      <span className="relative inline-flex h-2 w-2">
        <span className="live-dot h-2 w-2" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
      </span>
      {isFetching ? "Refreshing" : "Live"}
    </div>
  );
}

export const LiveStatusIndicator = memo(LiveStatusIndicatorImpl);