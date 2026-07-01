/**
 * Number-formatting helpers used by every table cell, KPI card, chart tick
 * and tooltip in the app. All formatters are locale-fixed to `en-US` (this
 * is a USD-denominated tracker — mixing locales would produce ambiguous
 * "1,000.00" vs "1.000,00" output between axes and totals).
 *
 * `Intl.NumberFormat` instantiation costs a few hundred microseconds; a
 * table with dozens of rows and multiple columns would spend measurable
 * time in the constructor without this cache.
 */
const usdCache = new Map<string, Intl.NumberFormat>();
/** Get (or lazily create) a memoized USD Intl.NumberFormat. */
function usdFormatter(compact: boolean, maxFrac: number) {
  const key = `${compact ? "c" : "s"}-${maxFrac}`;
  let fmt = usdCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: maxFrac,
    });
    usdCache.set(key, fmt);
  }
  return fmt;
}

const numberCache = new Map<number, Intl.NumberFormat>();
/** Get (or lazily create) a memoized decimal Intl.NumberFormat. */
function numberFormatter(maxFrac: number) {
  let fmt = numberCache.get(maxFrac);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: maxFrac });
    numberCache.set(maxFrac, fmt);
  }
  return fmt;
}

/**
 * Format a number as USD currency.
 * - Non-finite inputs (`NaN`, `Infinity`) render as `$0.00` instead of
 *   propagating garbage into the UI.
 * - `compact` only kicks in for |value| ≥ 1000 — sub-thousand values
 *   stay in standard notation so tooltips remain precise.
 * - Fractional digits default to 6 for micro-prices (|value| < 1) and 2
 *   otherwise, matching typical crypto-price display conventions.
 *
 * @param value  The numeric amount to format.
 * @param opts.compact               When true, uses compact notation for
 *                                   large values (`$1.2M`).
 * @param opts.maximumFractionDigits Overrides the smart default.
 * @returns A localized USD string (e.g. `$1,234.56`).
 */
export function formatUSD(value: number, opts?: { compact?: boolean; maximumFractionDigits?: number }) {
  if (!Number.isFinite(value)) return "$0.00";
  const compact = !!(opts?.compact && Math.abs(value) >= 1000);
  const maxFrac = opts?.maximumFractionDigits ?? (Math.abs(value) < 1 ? 6 : 2);
  return usdFormatter(compact, maxFrac).format(value);
}

/**
 * Format a decimal number with grouping separators. Non-finite input
 * renders as `"0"`.
 *
 * @param value   Number to format.
 * @param maxFrac Maximum fractional digits (default 8 — matches typical
 *                crypto amount precision).
 * @returns The formatted string (e.g. `"1,234.5678"`).
 */
export function formatNumber(value: number, maxFrac = 8) {
  if (!Number.isFinite(value)) return "0";
  return numberFormatter(maxFrac).format(value);
}

/**
 * Format a number as a signed percentage. Positive values receive an
 * explicit `+` prefix so gains and losses read symmetrically in tables.
 *
 * @param value    Already-scaled percentage (pass `12.5`, not `0.125`).
 * @param decimals Fixed decimals to render (default 2).
 * @returns A string like `+12.50%`, `-3.10%`, or `0.00%`.
 */
export function formatPercent(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return "0.00%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Like {@link formatUSD} but always prefixed with an explicit `+` or `-`
 * sign — used for P&L cells where the sign is meaningful even when the
 * value is small.
 */
export function formatSignedUSD(value: number) {
  const abs = formatUSD(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}