"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DiffEntry } from "@/utils/csvAnalyzer";

type Filter = "all" | "errors" | "warnings" | "changes";
const PAGE_SIZE = 200;

const Blank = () => <span className="italic text-slate-400">(blank)</span>;

function Badge({ entry }: { entry: DiffEntry }) {
  const styles =
    entry.severity === "error"
      ? "bg-red-100 text-red-700"
      : entry.severity === "warning"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";
  const text = entry.severity ?? entry.kind;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles}`}>
      {text}
    </span>
  );
}

export default function DiffTable({ entries }: { entries: DiffEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(
    () => ({
      all: entries.length,
      errors: entries.filter((e) => e.severity === "error").length,
      warnings: entries.filter((e) => e.severity === "warning").length,
      changes: entries.filter((e) => e.kind === "changed" || e.kind === "added").length,
    }),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "errors" && e.severity !== "error") return false;
      if (filter === "warnings" && e.severity !== "warning") return false;
      if (filter === "changes" && e.kind !== "changed" && e.kind !== "added") return false;
      if (q && !`${e.handle} ${e.sku} ${e.field}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, query]);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "errors", label: "Errors" },
    { key: "warnings", label: "Warnings" },
    { key: "changes", label: "Changes" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setFilter(t.key);
                setLimit(PAGE_SIZE);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                filter === t.key ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label} <span className="ml-1 text-xs text-slate-400">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search handle, SKU, field…"
            className="w-64 rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Handle</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Original</th>
              <th className="px-4 py-3">Proposed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.slice(0, limit).map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-4 py-3"><Badge entry={e} /></td>
                <td className="px-4 py-3 font-mono text-xs">{e.handle}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.sku || <span className="text-slate-300">-</span>}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{e.field}</div>
                  {e.messages.map((m, i) => (
                    <p key={i} className={`mt-1 text-xs ${e.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
                      {m}
                    </p>
                  ))}
                </td>
                <td className="max-w-[16rem] px-4 py-3">
                  <div className="break-words rounded bg-red-50 px-2 py-1 text-red-800">
                    {e.oldValue || <Blank />}
                  </div>
                </td>
                <td className="max-w-[16rem] px-4 py-3">
                  <div className="break-words rounded bg-emerald-50 px-2 py-1 text-emerald-800">
                    {e.newValue || <Blank />}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Nothing to show for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <div className="border-t border-slate-200 p-3 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Show more ({filtered.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
