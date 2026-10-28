// Prompt-cache facts the UI shows, worked out from calls already made (no extra requests).
import type { CallRecord, Price } from "./schemas";

/** Dollars cached input saved on a call: those tokens at the input price minus the cached price. */
export const savedBy = (usage: CallRecord["usage"], price: Price | null) => (price ? Math.min(usage.cached, usage.input) * (price.input - price.cached) : null);

/** An unused prefix can be evicted within minutes (provider docs), so a hit older than this proves little. */
const WARM_WINDOW_MS = 5 * 60 * 1000;

type Warmth = { state: "warm" | "warming" | "cold"; lastAt: number | null; calls: number };

/**
 * warm: a recent call on this repo hit the cache, so the next one very likely will.
 * warming: recent calls, none hit yet (the cache fills per server; the first few calls on a repo often miss).
 * cold: nothing recent.
 */
export function warmthOf(ledger: CallRecord[], now = Date.now()): Warmth {
  const recent = ledger.filter((c) => now - c.at < WARM_WINDOW_MS);
  const last = ledger.reduce<number | null>((a, c) => (a === null || c.at > a ? c.at : a), null);
  if (recent.some((c) => c.usage.cached > 0)) return { state: "warm", lastAt: last, calls: recent.length };
  if (recent.length) return { state: "warming", lastAt: last, calls: recent.length };
  return { state: "cold", lastAt: last, calls: 0 };
}

/** What the calls would have cost with no cached input at all. */
export const uncachedCost = (ledger: CallRecord[], price: Price | null) =>
  price ? ledger.reduce((a, c) => a + c.usage.input * price.input + c.usage.output * price.output, 0) : null;
