// Which tour steps you've seen, kept in this browser per repo commit (like CodeTour's checkmarks). Private to the
// visitor and best effort: without storage (a private window), everything still works, just unticked.
type Seen = Record<string, number[]>;
const keyOf = (repo: string) => `codetrail:seen:${repo}`;

export function readSeen(repo: string): Seen {
  try {
    const raw = localStorage.getItem(keyOf(repo));
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Seen) : {};
  } catch {
    return {};
  }
}

/** Marks one step seen; returns the updated record (the same object when nothing changed). */
export function markSeen(repo: string, seen: Seen, tourId: string, step: number): Seen {
  if (seen[tourId]?.includes(step)) return seen;
  const next = { ...seen, [tourId]: [...(seen[tourId] ?? []), step].sort((a, b) => a - b) };
  try {
    localStorage.setItem(keyOf(repo), JSON.stringify(next));
  } catch {
    // No storage: the ticks last until the page closes.
  }
  return next;
}

/** "✓ seen", "3/9 seen", or nothing yet. */
export function seenLabel(seen: number[] | undefined, steps: number): string | null {
  const n = new Set(seen ?? []).size;
  if (!n) return null;
  return n >= steps ? "✓ seen" : `${n}/${steps} seen`;
}
