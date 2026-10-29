"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import FileDropzone from "@/components/FileDropzone";
import SummaryCards from "@/components/SummaryCards";
import DiffTable from "@/components/DiffTable";
import { analyzeCsvs, parseCsv, type AnalysisResult } from "@/utils/csvAnalyzer";

export default function Home() {
  const [original, setOriginal] = useState<File | null>(null);
  const [proposed, setProposed] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!original || !proposed) return;
    setLoading(true);
    setError(null);
    try {
      const [o, p] = await Promise.all([parseCsv(original), parseCsv(proposed)]);
      setResult(analyzeCsvs(o, p));
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
    setError(null);
  }

  const verdict = result
    ? result.summary.errors > 0
      ? { tone: "border-red-200 bg-red-50 text-red-800", icon: ShieldAlert, text: `Do not import yet. ${result.summary.errors} critical issue(s) could cause data loss.` }
      : result.summary.warnings > 0
      ? { tone: "border-amber-200 bg-amber-50 text-amber-800", icon: ShieldAlert, text: `No critical errors, but ${result.summary.warnings} warning(s) deserve a look.` }
      : { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2, text: "All clear. No data-loss risks detected." }
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Shopify CSV Guard</h1>
          <p className="text-sm text-slate-500">
            Diff your product CSV before importing. Files are processed in your browser and never uploaded.
          </p>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <FileDropzone
          label="1. Original Shopify export"
          hint="Products export straight from Shopify admin"
          file={original}
          onFile={(f) => { setOriginal(f); setResult(null); }}
        />
        <FileDropzone
          label="2. Proposed update CSV"
          hint="The file you plan to import"
          file={proposed}
          onFile={(f) => { setProposed(f); setResult(null); }}
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
        </section>
      )}
    </main>
  );
}
