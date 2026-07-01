interface Props {
  error: unknown;
}

/**
 * Inline alert surfaced when the CoinGecko price query fails. Uses a role
 * of "alert" so screen readers announce recovery instructions.
 */
export function PricesErrorAlert({ error }: Props) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alert"
      className="rounded-lg border border-negative/40 bg-negative/10 p-3 text-sm text-negative"
    >
      {message}
    </div>
  );
}