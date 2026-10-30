"use client";

import { useEffect } from "react";
import { Check, X, Zap } from "lucide-react";
import UpgradeButton from "./UpgradeButton";

export type PaywallReason = "runs" | "rows";

interface Props {
  reason: PaywallReason | null;
  runLimit: number;
  rowLimit: number;
  onClose: () => void;
}

export default function PaywallModal({ reason, runLimit, rowLimit, onClose }: Props) {
  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [reason, onClose]);

  if (!reason) return null;

  const title =
    reason === "runs" ? "You've used all your free runs" : "This file is over the free limit";
  const body =
    reason === "runs"
      ? `The free tier includes ${runLimit} safety checks. Upgrade to Pro to keep protecting your imports.`
      : `Free tier is limited to ${rowLimit} rows per file. Upgrade to Pro for unlimited rows.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Zap className="h-6 w-6" />
        </div>
        <h2 id="paywall-title" className="text-xl font-bold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{body}</p>

        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {["Unlimited safety checks", "Unlimited rows per file", "Priority support"].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" /> {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-3">
          <UpgradeButton className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
