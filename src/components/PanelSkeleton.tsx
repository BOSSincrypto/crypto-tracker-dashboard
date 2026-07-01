/**
 * Fixed-height loading placeholder for lazy-loaded panels. Matches the
 * card silhouette so the layout doesn't jump when the panel arrives.
 */
interface PanelSkeletonProps {
  height: number;
}

export function PanelSkeleton({ height }: PanelSkeletonProps) {
  return (
    <div
      className="animate-pulse rounded-lg border border-border/60 bg-muted/20"
      style={{ height }}
      aria-hidden="true"
    />
  );
}