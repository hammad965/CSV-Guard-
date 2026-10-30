const PRO_KEY = "csv_guard_pro";

export const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL ?? "";
export const PRO_RETURN_TOKEN = process.env.NEXT_PUBLIC_PRO_RETURN_TOKEN ?? "";

/** True if this browser previously unlocked Pro. */
export function readIsPro(): boolean {
  try {
    const raw = window.localStorage.getItem(PRO_KEY);
    return !!raw && JSON.parse(raw)?.pro === true;
  } catch {
    return false;
  }
}

/** Persist Pro status across sessions. */
export function grantPro() {
  try {
    window.localStorage.setItem(
      PRO_KEY,
      JSON.stringify({ pro: true, at: new Date().toISOString() })
    );
  } catch {
    /* storage blocked (private mode etc.) */
  }
}

export function revokePro() {
  try {
    window.localStorage.removeItem(PRO_KEY);
  } catch {
    /* ignore */
  }
}
