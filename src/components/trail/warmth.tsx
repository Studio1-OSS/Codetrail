"use client";

// Is this repo in the prompt cache right now? Worked out from calls already made, re-checked every 20s.
import { useEffect, useState } from "react";
import { warmthOf } from "@/lib/cache";
import { formatUsd } from "@/lib/format";
import type { CallRecord, RepoSummary } from "@/lib/schemas";

export function Ember({ ledger, summary }: { ledger: CallRecord[]; summary: RepoSummary }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  const w = warmthOf(ledger, now);
  const text =
    w.state === "warm"
      ? `in cache · next question ≈ ${formatUsd(summary.estimate.followUp)}`
      : w.state === "warming"
        ? `cache not hit yet · up to ${formatUsd(summary.estimate.followUpCold)}`
        : `cache cold · up to ${formatUsd(summary.estimate.followUpCold)}`;
  const title =
    w.state === "warm"
      ? "A call in the last 5 minutes hit the prompt cache, so the next one very likely will: cheaper and about 4× faster."
      : w.state === "warming"
        ? "Recent calls haven't hit the cache yet. Token Factory's cache is best-effort and per server: the first few calls on a repo often miss and cost close to a full read."
        : "Nothing recent. The next question may cost up to a full read of the repo.";
  return (
    <span title={title} className="inline-flex items-center gap-2 font-mono text-[11.5px] text-fg-2">
      <span
        className={`size-2 rounded-full ${w.state === "warm" ? "bg-trail shadow-[0_0_0_4px_rgb(255_176_32/0.2)]" : w.state === "warming" ? "border-[1.5px] border-trail" : "bg-fg-3"}`}
      />
      {text}
    </span>
  );
}
