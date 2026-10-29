import Papa from "papaparse";

/* ----------------------------- Types ----------------------------- */

export type Severity = "error" | "warning";
export type Row = Record<string, string>;

export type IssueCode =
  | "MISSING_HANDLE_COLUMN"
  | "MISSING_HANDLE"
  | "DELETED_HANDLE"
  | "VARIANT_REMOVED"
  | "BLANK_PRICE"
  | "INVALID_PRICE"
  | "ZERO_PRICE"
  | "PRICE_SWING"
  | "COMPARE_AT_BELOW_PRICE"
  | "BROKEN_VARIANT"
  | "DUPLICATE_VARIANT"
  | "MISSING_TITLE"
  | "MISSING_COLUMNS"
  | "INVENTORY_CLEARED"
  | "STATUS_DOWNGRADE";

export interface ParsedCsv {
  headers: string[];
  rows: Row[];
}

export interface Issue {
  id: string;
  severity: Severity;
  code: IssueCode;
  message: string;
  handle: string;
  sku: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  /** Index into proposed.rows (CSV line = rowIndex + 2) */
  rowIndex?: number;
}

export interface DiffEntry {
  id: string;
  kind: "changed" | "added" | "removed" | "issue";
  handle: string;
  sku: string;
  field: string;
  oldValue: string;
  newValue: string;
  severity: Severity | null;
  messages: string[];
}

export interface AnalysisSummary {
  originalRows: number;
  proposedRows: number;
  errors: number;
  warnings: number;
  safeRows: number;
  changedRows: number;
  addedRows: number;
  deletedHandles: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  issues: Issue[];
  entries: DiffEntry[];
}

/* ---------------------------- Constants --------------------------- */

const C = {
  handle: "Handle",
  title: "Title",
  status: "Status",
  sku: "Variant SKU",
  price: "Variant Price",
  compare: "Variant Compare At Price",
  inventory: "Variant Inventory Qty",
} as const;

const OPTION_COLS = ["Option1 Value", "Option2 Value", "Option3 Value"];
const VARIANT_COLS = [C.sku, C.price, C.compare, C.inventory, "Variant Barcode", ...OPTION_COLS];
const NUMERIC_COLS: string[] = [C.price, C.compare];

/* ----------------------------- Parsing ---------------------------- */

export function parseCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      transform: (v) => (typeof v === "string" ? v.trim() : v),
      complete: (res) => {
        if (!res.data.length) {
          reject(new Error(`"${file.name}" has no data rows.`));
          return;
        }
        resolve({ headers: res.meta.fields ?? [], rows: res.data });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

/* ----------------------------- Helpers ---------------------------- */

const val = (r: Row, k: string) => (r[k] ?? "").trim();
const isVariantRow = (r: Row) => VARIANT_COLS.some((k) => val(r, k) !== "");
const optionsOf = (r: Row) =>
  OPTION_COLS.map((k) => val(r, k).toLowerCase()).filter(Boolean).join("/");

/** null = blank, NaN = not a number */
function toNumber(v: string): number | null {
  if (v === "") return null;
  return Number(v.replace(/[$,\s]/g, ""));
}

function sameValue(col: string, a: string, b: string): boolean {
  if (a === b) return true;
  if (NUMERIC_COLS.includes(col)) {
    const x = toNumber(a);
    const y = toNumber(b);
    return x !== null && y !== null && !Number.isNaN(x) && x === y;
  }
  return false;
}

function topSeverity(issues: Issue[]): Severity | null {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.length) return "warning";
  return null;
}

function indexOriginal(rows: Row[]) {
  const bySku = new Map<string, number>();
  const byOpts = new Map<string, number>();
  rows.forEach((r, i) => {
    if (!isVariantRow(r)) return;
    const h = val(r, C.handle);
    const sku = val(r, C.sku);
    const o = optionsOf(r);
    if (sku) bySku.set(`${h}|${sku}`, i);
    if (o) byOpts.set(`${h}|${o}`, i);
  });
  return { bySku, byOpts };
}

/* ----------------------------- Analyzer --------------------------- */

export function analyzeCsvs(original: ParsedCsv, proposed: ParsedCsv): AnalysisResult {
  const issues: Issue[] = [];
  const add = (i: Omit<Issue, "id">) => issues.push({ ...i, id: `i${issues.length}` });
  const hasCol = (c: string) => proposed.headers.includes(c);

  const entries: DiffEntry[] = [];
  let changedRows = 0;
  let addedRows = 0;
  let deletedHandles = 0;

  const finish = (): AnalysisResult => {
    // Leftover issues (not attached to a changed/added row) become their own entries
    const used = new Set(entries.flatMap((e) => e.messages));
    issues.forEach((x) => {
      if (used.has(`${x.id}`)) return;
    });
    const rank = (s: Severity | null) => (s === "error" ? 0 : s === "warning" ? 1 : 2);
    entries.sort((a, b) => rank(a.severity) - rank(b.severity));

    const flaggedRows = new Set(
      issues.map((i) => i.rowIndex).filter((n): n is number => n !== undefined)
    );
    return {
      summary: {
        originalRows: original.rows.length,
        proposedRows: proposed.rows.length,
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
        safeRows: proposed.rows.length - flaggedRows.size,
        changedRows,
        addedRows,
        deletedHandles,
      },
      issues,
      entries,
    };
  };

  /* --- Structural checks --- */
  if (!hasCol(C.handle)) {
    add({
      severity: "error",
      code: "MISSING_HANDLE_COLUMN",
      message: "Proposed CSV has no 'Handle' column, so Shopify cannot match any product.",
      handle: "-",
      sku: "",
    });
    entries.push({
      id: "x0", kind: "issue", handle: "-", sku: "", field: C.handle,
      oldValue: "present", newValue: "(column missing)", severity: "error",
      messages: [issues[0].message],
    });
    return finish();
  }

  const missingCols = original.headers.filter((h) => !proposed.headers.includes(h));
  if (missingCols.length) {
    add({
      severity: "warning",
      code: "MISSING_COLUMNS",
      message: `Proposed CSV is missing ${missingCols.length} column(s) from the original: ${missingCols
        .slice(0, 8)
        .join(", ")}${missingCols.length > 8 ? "…" : ""}`,
      handle: "-",
      sku: "",
    });
  }

  /* --- Handle-level checks --- */
  const originalHandles = new Map<string, string>(); // handle -> title
  original.rows.forEach((r) => {
    const h = val(r, C.handle);
    if (h && !originalHandles.get(h)) originalHandles.set(h, val(r, C.title));
  });
  const proposedHandles = new Set(
    proposed.rows.map((r) => val(r, C.handle)).filter(Boolean)
  );

  originalHandles.forEach((title, h) => {
    if (!proposedHandles.has(h)) {
      deletedHandles++;
      add({
        severity: "error",
        code: "DELETED_HANDLE",
        message: `Product "${title || h}" exists in the original but is missing from the update.`,
        handle: h,
        sku: "",
        field: "(product)",
        oldValue: title || h,
        newValue: "",
      });
    }
  });

  /* --- Row-level checks --- */
  const { bySku, byOpts } = indexOriginal(original.rows);
  const matchedOriginal = new Set<number>();
  const matches: { i: number; oi?: number }[] = [];
  const seenHandles = new Set<string>();
  const seenVariants = new Set<string>();
  const optionStats = new Map<string, { with: number; without: number[] }>();

  proposed.rows.forEach((row, i) => {
    const handle = val(row, C.handle);
    const sku = val(row, C.sku);

    if (!handle) {
      add({
        severity: "error", code: "MISSING_HANDLE", rowIndex: i, handle: "(blank)", sku,
        field: C.handle, oldValue: "", newValue: "",
        message: `CSV line ${i + 2} has no Handle. Shopify will reject or mis-assign this row.`,
      });
      return;
    }
    const base = { handle, sku, rowIndex: i };

    if (!seenHandles.has(handle)) {
      seenHandles.add(handle);
      if (hasCol(C.title) && !val(row, C.title)) {
        add({
          ...base, severity: "warning", code: "MISSING_TITLE", field: C.title,
          oldValue: originalHandles.get(handle) ?? "", newValue: "",
          message: "First row of this product has no Title.",
        });
      }
    }

    if (!isVariantRow(row)) return; // image / extra rows

    const opts = optionsOf(row);

    const dupKey = `${handle}|${sku || opts}`;
    if (sku || opts) {
      if (seenVariants.has(dupKey)) {
        add({
          ...base, severity: "warning", code: "DUPLICATE_VARIANT", field: C.sku,
          oldValue: "", newValue: sku || opts,
          message: "Duplicate variant in the update. Later rows may overwrite earlier ones.",
        });
      }
      seenVariants.add(dupKey);
    }

    const stats = optionStats.get(handle) ?? { with: 0, without: [] };
    if (opts) stats.with++;
    else stats.without.push(i);
    optionStats.set(handle, stats);

    // Match to original: SKU first, then option combo
    let oi = sku ? bySku.get(`${handle}|${sku}`) : undefined;
    if (oi === undefined && opts) oi = byOpts.get(`${handle}|${opts}`);
    if (oi !== undefined) matchedOriginal.add(oi);
    matches.push({ i, oi });
    const old = oi !== undefined ? original.rows[oi] : undefined;

    /* Price checks */
    if (hasCol(C.price)) {
      const newP = val(row, C.price);
      const oldP = old ? val(old, C.price) : "";
      const np = toNumber(newP);
      const op = toNumber(oldP);
      const ctx = { ...base, field: C.price, oldValue: oldP, newValue: newP };
      const oldPositive = op !== null && op > 0;

      if (np === null) {
        add({
          ...ctx, severity: "error", code: "BLANK_PRICE",
          message: oldPositive
            ? `Price was ${oldP} and is now blank. This would wipe the price.`
            : "Variant has no price.",
        });
      } else if (Number.isNaN(np) || np < 0) {
        add({
          ...ctx, severity: "error", code: "INVALID_PRICE",
          message: `"${newP}" is not a valid price.`,
        });
      } else if (np === 0) {
        add({
          ...ctx, severity: oldPositive ? "error" : "warning", code: "ZERO_PRICE",
          message: oldPositive
            ? `Price drops from ${oldP} to 0. The item would become free.`
            : "Price is 0.",
        });
      } else if (oldPositive && (np < op! * 0.5 || np > op! * 3)) {
        add({
          ...ctx, severity: "warning", code: "PRICE_SWING",
          message: `Large price change (${oldP} → ${newP}). Double-check this is intentional.`,
        });
      }

      if (hasCol(C.compare)) {
        const cp = toNumber(val(row, C.compare));
        if (cp !== null && !Number.isNaN(cp) && np !== null && !Number.isNaN(np) && cp > 0 && cp < np) {
          add({
            ...base, severity: "warning", code: "COMPARE_AT_BELOW_PRICE", field: C.compare,
            oldValue: old ? val(old, C.compare) : "", newValue: val(row, C.compare),
            message: "Compare-at price is lower than the price, so no sale badge will show.",
          });
        }
      }
    }

    if (old) {
      if (optionsOf(old) && !opts) {
        add({
          ...base, severity: "error", code: "BROKEN_VARIANT", field: "Option1 Value",
          oldValue: val(old, "Option1 Value"), newValue: "",
          message: "Variant option values were removed. This breaks the variant.",
        });
      }
      if (hasCol(C.inventory) && val(old, C.inventory) !== "" && val(row, C.inventory) === "") {
        add({
          ...base, severity: "warning", code: "INVENTORY_CLEARED", field: C.inventory,
          oldValue: val(old, C.inventory), newValue: "",
          message: "Inventory quantity was cleared.",
        });
      }
      const os = val(old, C.status).toLowerCase();
      const ns = val(row, C.status).toLowerCase();
      if (hasCol(C.status) && os === "active" && ns && ns !== "active") {
        add({
          ...base, severity: "warning", code: "STATUS_DOWNGRADE", field: C.status,
          oldValue: os, newValue: ns,
          message: `Product status changes from active to ${ns}. It will disappear from the storefront.`,
        });
      }
    }
  });

  // Mixed variant rows (some with options, some without) within one product
  optionStats.forEach((s, handle) => {
    if (s.with > 0 && s.without.length > 0) {
      s.without.forEach((i) =>
        add({
          handle, sku: val(proposed.rows[i], C.sku), rowIndex: i, severity: "error",
          code: "BROKEN_VARIANT", field: "Option1 Value", oldValue: "", newValue: "",
          message: `CSV line ${i + 2}: variant row has no option values while sibling variants do.`,
        })
      );
    }
  });

  // Variants dropped from products that still exist
  original.rows.forEach((r, oi) => {
    if (!isVariantRow(r) || matchedOriginal.has(oi)) return;
    const h = val(r, C.handle);
    if (!proposedHandles.has(h)) return; // covered by DELETED_HANDLE
    add({
      severity: "warning", code: "VARIANT_REMOVED", handle: h, sku: val(r, C.sku),
      field: "(variant)", oldValue: val(r, C.sku) || optionsOf(r), newValue: "",
      message: "Variant exists in the original but not in the update.",
    });
  });

  /* --- Build diff entries --- */
  const byRow = new Map<number, Issue[]>();
  issues.forEach((x) => {
    if (x.rowIndex === undefined) return;
    byRow.set(x.rowIndex, [...(byRow.get(x.rowIndex) ?? []), x]);
  });
  const consumed = new Set<string>();

  matches.forEach(({ i, oi }) => {
    const row = proposed.rows[i];
    const handle = val(row, C.handle);
    const sku = val(row, C.sku);
    const rowIssues = byRow.get(i) ?? [];

    if (oi === undefined) {
      addedRows++;
      rowIssues.forEach((x) => consumed.add(x.id));
      entries.push({
        id: `a${i}`, kind: "added", handle, sku, field: "(new variant)",
        oldValue: "", newValue: sku || optionsOf(row) || "new row",
        severity: topSeverity(rowIssues), messages: rowIssues.map((x) => x.message),
      });
      return;
    }

    const old = original.rows[oi];
    let changed = false;
    proposed.headers
      .filter((c) => c !== C.handle && original.headers.includes(c))
      .forEach((col) => {
        const o = val(old, col);
        const n = val(row, col);
        if (sameValue(col, o, n)) return;
        changed = true;
        const fieldIssues = rowIssues.filter((x) => x.field === col);
        fieldIssues.forEach((x) => consumed.add(x.id));
        entries.push({
          id: `c${i}-${col}`, kind: "changed", handle, sku, field: col,
          oldValue: o, newValue: n,
          severity: topSeverity(fieldIssues), messages: fieldIssues.map((x) => x.message),
        });
      });
    if (changed) changedRows++;
  });

  issues.forEach((x) => {
    if (consumed.has(x.id)) return;
    entries.push({
      id: `x${x.id}`,
      kind: x.code === "DELETED_HANDLE" || x.code === "VARIANT_REMOVED" ? "removed" : "issue",
      handle: x.handle, sku: x.sku, field: x.field ?? "-",
      oldValue: x.oldValue ?? "", newValue: x.newValue ?? "",
      severity: x.severity, messages: [x.message],
    });
  });

  return finish();
}
