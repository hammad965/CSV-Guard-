import { AlertOctagon, AlertTriangle, FileSpreadsheet, ShieldCheck } from "lucide-react";
import type { AnalysisSummary } from "@/utils/csvAnalyzer";

export default function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const cards = [
    { label: "Total rows", value: summary.proposedRows, sub: `${summary.originalRows} in original`, icon: FileSpreadsheet, tone: "text-slate-700 bg-white" },
    { label: "Errors", value: summary.errors, sub: "Block import", icon: AlertOctagon, tone: "text-red-700 bg-red-50 border-red-200" },
    { label: "Warnings", value: summary.warnings, sub: "Review first", icon: AlertTriangle, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Safe rows", value: summary.safeRows, sub: "No issues found", icon: ShieldCheck, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon, tone }) => (
        <div key={label} className={`rounded-xl border p-4 shadow-sm ${tone}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{label}</p>
            <Icon className="h-5 w-5 opacity-70" />
          </div>
          <p className="mt-2 text-3xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs opacity-70">{sub}</p>
        </div>
      ))}
    </div>
  );
}
