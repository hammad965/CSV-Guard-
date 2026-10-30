"use client";

import { Zap } from "lucide-react";
import { CHECKOUT_URL } from "@/lib/pro";

/** Redirects in the SAME tab so Lemon Squeezy sends the buyer back to this tab. */
export function goToCheckout() {
  if (!CHECKOUT_URL) {
    console.error("NEXT_PUBLIC_CHECKOUT_URL is not set");
    return;
  }
  window.location.href = CHECKOUT_URL;
}

export default function UpgradeButton({
  className = "",
  label = "Upgrade to Pro",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={goToCheckout}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 ${className}`}
    >
      <Zap className="h-4 w-4" /> {label}
    </button>
  );
}
