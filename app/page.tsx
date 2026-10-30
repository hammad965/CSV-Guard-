"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import FileDropzone from "@/components/FileDropzone";
import SummaryCards from "@/components/SummaryCards";
import DiffTable from "@/components/DiffTable";
import PaywallModal, { type PaywallReason } from "@/components/PaywallModal";
import { analyzeCsvs, parseCsv, type AnalysisResult } from "@/utils/csvAnalyzer";
import { downloadAuditCsv } from "@/utils/exportAudit";

/* ------------------------- Free-tier config ------------------------- */
const FREE_RUN_LIMIT = 3;
const FREE_ROW_LIMIT = 100;
const STORAGE_KEY = "csv-guard:runs-used";
const UPGRADE_URL = "https://your-checkout-link.example.com"; // TODO: your Stripe/Lemon Squeezy link
const ROW_LIMIT_MESSAGE =
  "Free tier is limited to 100 rows per file. Upgrade to Pro for unlimited rows.";

function readRunsUsed(): number {
  try {
    const n = parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0; // storage blocked (private mode etc.)
  }
}

function writeRunsUsed(n: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export default function Home() {
  const [original, setOriginal] = useState<File | null>(null);
  const [proposed, setProposed] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowAlert, setRowAlert] = useState<string | null>(null);

  // null until hydrated, so server and client markup match
  const [runsUsed, setRunsUsed] = useState<number | null>(null);
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);

  useEffect(() => {
    setRunsUsed(readRunsUsed());
  }, []);

  const runsLeft = runsUsed === null ? null : Math.max(0, FREE_RUN_LIMIT - runsUsed);

  function clearMessages() {
    setError(null);
    setRowAlert(null);
  }

  async function run() {
    if (!original || !proposed) return;

    // Re-read storage in case another tab used a run
    const used = readRunsUsed();
    setRunsUsed(used);
    if (used >= FREE_RUN_LIMIT) {
      setPaywall("runs");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const [o, p] = await Promise.all([parseCsv(original), parseCsv(proposed)]);

      // Row limit: block the check, and don't consume a run
      if (o.rows.length > FREE_ROW_LIMIT || p.rows.length > FREE_ROW_LIMIT) {
        setResult(null);
        setRowAlert(ROW_LIMIT_MESSAGE);
        setPaywall("rows");
        return;
      }

      setResult(analyzeCsvs(o, p));
      const next = used + 1;
      writeRunsUsed(next);
      setRunsUsed(next);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Could not parse the CSV files.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOriginal(null);
    setProposed(null);
    setResult(null);
    clearMessages();
  }

  const verdict = result
    ? result.summary.errors > 0
      ? { tone: "border-red-200 bg-red-50 text-red-800", icon: ShieldAlert, text: `Do not import yet. ${result.summary.errors} critical issue(s) could cause data loss.` }
      : result.summary.warnings > 0
      ? { tone: "border-amber-200 bg-amber-50 text-amber-800", icon: ShieldAlert, text: `No critical errors, but ${result.summary.warnings} warning(s) deserve a look.` }
      : { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2, text: "All clear. No data-loss risks detected." }
    : null;

  const badgeTone =
    runsLeft === 0
      ? "border-red-200 bg-red-50 text-red-700"
      : runsLeft === 1
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-white text-slate-600";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Shopify CSV Guard</h1>
            <p className="text-sm text-slate-500">
              Diff your product CSV before importing. Files are processed in your browser and never uploaded.
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${badgeTone}`}
          aria-live="polite"
        >
          Runs left: {runsLeft ?? "–"}/{FREE_RUN_LIMIT}
        </span>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <FileDropzone
          label="1. Original Shopify export"
          hint="Products export straight from Shopify admin"
          file={original}
          onFile={(f) => { setOriginal(f); setResult(null); setRowAlert(null); }}
        />
        <FileDropzone
          label="2. Proposed update CSV"
          hint="The file you plan to import"
          file={proposed}
          onFile={(f) => { setProposed(f); setResult(null); setRowAlert(null); }}
        />
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={run}
          disabled={!original || !proposed || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Analyzing…" : "Run safety check"}
        </button>
        {(original || proposed) && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      {rowAlert && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{rowAlert}</p>
          </div>
          <button
            onClick={() => setPaywall("rows")}
            className="shrink-0 font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
          >
            Upgrade
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {result && verdict && (
        <section className="mt-8 space-y-6">
          <div className={`flex items-center gap-3 rounded-xl border p-4 font-medium ${verdict.tone}`}>
            <verdict.icon className="h-5 w-5 shrink-0" />
            {verdict.text}
          </div>

          <SummaryCards summary={result.summary} />
          <DiffTable entries={result.entries} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {result.issues.length
                ? `${result.issues.length} issue(s) will be included in the report.`
                : "No errors or warnings to export."}
            </p>
            <button
              onClick={() => downloadAuditCsv(result.issues)}
              disabled={!result.issues.length}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Export Audit Report
            </button>
          </div>
        </section>
      )}

      <PaywallModal
        reason={paywall}
        runLimit={FREE_RUN_LIMIT}
        rowLimit={FREE_ROW_LIMIT}
        onClose={() => setPaywall(null)}
        onUpgrade={() => window.open(UPGRADE_URL, "_blank", "noopener,noreferrer")}
      />
    </main>
  );
}
