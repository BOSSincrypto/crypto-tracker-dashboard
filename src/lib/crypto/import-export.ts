/**
 * CSV / JSON import / export for portfolio transactions.
 *
 * The export format is a versioned JSON envelope (`{ version, exportedAt,
 * transactions }`) with a strict Zod schema so we can evolve the shape
 * safely later. The importer also accepts a bare `Transaction[]` array
 * and a flat CSV with the columns listed in {@link CSV_COLUMNS}.
 *
 * All parse failures surface as {@link ImportError} with a user-readable
 * message — the UI shows it directly in a toast.
 */
import { z } from "zod";
import { TX_TYPES, type Transaction } from "./types";

/** Human-readable error thrown by import parsers. Safe to show in a toast. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

/** Reject import blobs larger than this to avoid hanging the tab.
 *  Exported so upload-side pre-checks share the same limit. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function assertSize(raw: string, kind: "JSON" | "CSV") {
  // Fast char-length check — good enough proxy for UTF-8 bytes.
  if (raw.length > MAX_IMPORT_BYTES) {
    throw new ImportError(`${kind} file is too large (max 5 MB).`);
  }
}

/**
 * Collapse a Zod validation error into a short, user-friendly sentence.
 * Only reports the first issue — batches of errors overwhelm a toast.
 */
function formatZodError(err: z.ZodError, rowLabel?: string): string {
  const first = err.issues[0];
  if (!first) return "Invalid transaction data.";
  const path = first.path.join(".") || "field";
  const where = rowLabel ? `${rowLabel}: ` : "";
  return `${where}${path} — ${first.message}`;
}

export const transactionSchema = z.object({
  id: z.string(),
  coinId: z.string().min(1),
  symbol: z.string(),
  name: z.string(),
  type: z.enum(TX_TYPES),
  amount: z.number().positive(),
  pricePerCoin: z.number().nonnegative(),
  date: z.string(),
  note: z.string().optional(),
  fee: z.number().nonnegative().optional(),
});

export const exportPayloadSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  transactions: z.array(transactionSchema),
});

export type ExportPayload = z.infer<typeof exportPayloadSchema>;

// ---- JSON ----
/** Serialize transactions to a pretty-printed JSON export envelope. */
export function toJSON(transactions: Transaction[]): string {
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Parse a JSON export produced by {@link toJSON}, or a bare
 * `Transaction[]` array.
 *
 * @throws {ImportError} On unparseable JSON or schema-invalid data.
 */
export function fromJSON(raw: string): Transaction[] {
  assertSize(raw, "JSON");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportError("File is not valid JSON.");
  }
  try {
    if (Array.isArray(parsed)) {
      return z.array(transactionSchema).parse(parsed);
    }
    if (parsed && typeof parsed === "object") {
      return exportPayloadSchema.parse(parsed).transactions;
    }
    throw new ImportError("JSON must be an array of transactions or an export payload.");
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if (err instanceof z.ZodError) throw new ImportError(formatZodError(err));
    throw new ImportError("Unrecognized JSON format.");
  }
}

// ---- CSV ----
const CSV_COLUMNS = [
  "id",
  "date",
  "type",
  "symbol",
  "coinId",
  "name",
  "amount",
  "pricePerCoin",
  "fee",
  "note",
] as const;

/** RFC-4180 escaping for a single CSV cell. */
function csvEscape(val: string | number | undefined): string {
  const s = val === undefined || val === null ? "" : String(val);
  // Neutralize spreadsheet formula injection (OWASP): prefix cells that
  // start with =, +, -, @, TAB or CR with a single quote so Excel /
  // LibreOffice treat them as text instead of formulas.
  const neutralized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

/** Serialize transactions to a flat CSV using {@link CSV_COLUMNS}. */
export function toCSV(transactions: Transaction[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = transactions.map((tx) =>
    CSV_COLUMNS.map((col) => csvEscape(tx[col as keyof Transaction] as string | number | undefined)).join(","),
  );
  return [header, ...rows].join("\n");
}

/**
 * Minimal RFC-4180 line parser: handles quoted fields containing commas,
 * newlines and escaped `""` sequences.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Parse a CSV file into validated transactions.
 *
 * Required columns: `coinId`, `symbol`, `type`, `amount`, `pricePerCoin`,
 * `date`. Missing columns fail fast with a clear message.
 *
 * @throws {ImportError} With row + field context on the first invalid row.
 */
export function fromCSV(raw: string): Transaction[] {
  assertSize(raw, "CSV");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const required = ["coinId", "symbol", "type", "amount", "pricePerCoin", "date"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    throw new ImportError(`CSV is missing required columns: ${missing.join(", ")}.`);
  }
  const txs: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    const amountN = Number(row.amount);
    const priceN = Number(row.pricePerCoin);
    if (!Number.isFinite(amountN) || !Number.isFinite(priceN)) {
      throw new ImportError(`Row ${i + 1}: amount and pricePerCoin must be numbers.`);
    }
    const rawType = row.type?.trim().toLowerCase() as Transaction["type"];
    if (!(TX_TYPES as readonly string[]).includes(rawType)) {
      throw new ImportError(
        `Row ${i + 1}: unknown type "${row.type}". Expected buy, sell, deposit, withdraw or reward.`,
      );
    }
    const tx: Transaction = {
      id: row.id || crypto.randomUUID(),
      coinId: row.coinId,
      symbol: row.symbol,
      name: row.name || row.symbol,
      type: rawType as Transaction["type"],
      amount: amountN,
      pricePerCoin: priceN,
      date: row.date,
      note: row.note || undefined,
      fee: row.fee ? Number(row.fee) : undefined,
    };
    try {
      txs.push(transactionSchema.parse(tx));
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new ImportError(formatZodError(err, `Row ${i + 1}`));
      }
      throw err;
    }
  }
  return txs;
}

/**
 * Trigger a browser download by creating a Blob, appending a temporary
 * `<a>` and clicking it. Object URL is revoked immediately after.
 */
export function downloadFile(filename: string, content: string, mime: string) {
  // Strip path separators and control chars from any user-derived name.
  const safeName = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 200) || "download";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}