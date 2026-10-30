import Papa from "papaparse";
import type { Issue } from "./csvAnalyzer";

/** Prevent CSV/formula injection when the report is opened in Excel or Sheets. */
const safe = (v: string | undefined) => {
  const s = v ?? "";
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

export function buildAuditCsv(issues: Issue[]): string {
  const sorted = [...issues].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1
  );

  const rows = sorted.map((i) => ({
    Severity: i.severity.toUpperCase(),
    "Issue Code": i.code,
    Handle: safe(i.handle),
    SKU: safe(i.sku),
    Field: safe(i.field),
    "Original Value": safe(i.oldValue),
    "Proposed Value": safe(i.newValue),
    "CSV Line": i.rowIndex !== undefined ? String(i.rowIndex + 2) : "",
    Message: safe(i.message),
  }));

  return Papa.unparse(rows);
}

export function downloadAuditCsv(issues: Issue[]) {
  // BOM so Excel reads UTF-8 correctly
  const blob = new Blob(["\uFEFF" + buildAuditCsv(issues)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `csv-guard-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
