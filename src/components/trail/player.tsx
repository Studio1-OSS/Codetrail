"use client";

import { Check, ChevronLeft, ChevronRight, CornerUpRight, Download, FileText, Link2, Pause, Play, Share2, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { Rich } from "@/components/rich";
import { tourToSequence } from "@/lib/export-map";
import { KIND_COLOR, SUPPORT } from "@/lib/palette";
import type { Atlas, Tour } from "@/lib/schemas";
import { CallLine } from "./cost";

export const sameText = (a: string, b: string) => a.trim().toLowerCase().replace(/[?.!\s]+$/, "") === b.trim().toLowerCase().replace(/[?.!\s]+$/, "");

type Props = {
  tour: Tour;
  atlas: Atlas;
  step: number;
  playing: boolean;
  speed: number;
  fromCache: boolean;
  onStep: (i: number) => void;
  onToggle: () => void;
  onSpeed: () => void;
  onShare: () => void;
  onExport: () => void;
  onTranscript: () => void;
};

export function Narration({ tour, atlas, step, fromCache, onShare, onExport, onTranscript }: Pick<Props, "tour" | "atlas" | "step" | "fromCache" | "onShare" | "onExport" | "onTranscript">) {
  const s = tour.steps[step];
  const node = atlas.nodes.find((n) => n.id === s.node);
  const [copied, setCopied] = useState<"link" | "sequence" | null>(null);
  const copy = (what: "link" | "sequence", text: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    });
  return (
    <div>
      <div className="flex items-center justify-between gap-3 font-mono text-[11.5px] text-fg-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-trail">
            {String(step + 1).padStart(2, "0")} / {String(tour.steps.length).padStart(2, "0")}
          </span>
          {node && (
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              · <span className="size-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[node.kind] ?? SUPPORT }} />
              <span className="truncate">{node.label}</span>
            </span>
          )}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 tracking-[0.1em] uppercase ${s.corrected ? "text-warn" : "text-ok"}`}
          title={s.corrected ? "The model's line numbers were off; Codetrail moved the range to the line it quoted." : "The line the model quoted is inside this range in the real file."}
        >
          {s.corrected ? <CornerUpRight className="size-3" /> : <Check className="size-3" />}
          {s.corrected ? "range corrected" : "lines checked"}
        </span>
      </div>
      <h2 className="mt-2.5 font-display text-[24px] leading-[1.08] font-medium tracking-[-0.03em] [font-stretch:82%] sm:text-[26px]">
        <Rich text={s.title} />
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">
        <Rich text={s.narration} />
      </p>
      {step === 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-[13.5px] leading-relaxed text-fg-2">
            <span className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">In short · </span>
            <Rich text={tour.summary} />
          </p>
          <div className="mt-2">
            {fromCache ? (
              <span className="font-mono text-[11px] text-fg-3">Replayed from storage · $0 · traced earlier for everyone</span>
            ) : tour.calls[0]?.kind === "atlas" ? (
              <span className="font-mono text-[11px] text-fg-3">Traced in the same read as the map · see the receipt</span>
            ) : (
              tour.calls[0] && <CallLine call={tour.calls[0]} />
            )}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SmallButton
          onClick={() => copy("link", window.location.href)}
          label={copied === "link" ? "Copied" : "Link to this step"}
          icon={copied === "link" ? <Check className="size-3 text-ok" /> : <Link2 className="size-3" />}
        />
        <SmallButton onClick={onTranscript} label="Read as text · T" icon={<FileText className="size-3" />} />
        <SmallButton onClick={onShare} label="Trail card" icon={<Share2 className="size-3" />} />
        <SmallButton
          onClick={() => copy("sequence", tourToSequence(tour, atlas))}
          label={copied === "sequence" ? "Mermaid copied" : "Copy as sequence diagram"}
          icon={copied === "sequence" ? <Check className="size-3 text-ok" /> : <Workflow className="size-3" />}
        />
        <SmallButton onClick={onExport} label="Export for VS Code CodeTour" icon={<Download className="size-3" />} />
      </div>
    </div>
  );
}

function SmallButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2 py-1 font-mono text-[10.5px] tracking-[0.06em] text-fg-3 hover:border-outline hover:text-fg">
      {icon}
      {label}
    </button>
  );
}

export function PlayerBar({ tour, step, playing, speed, dwellMs, onStep, onToggle, onSpeed }: Omit<Props, "atlas" | "fromCache" | "onShare" | "onExport" | "onTranscript"> & { dwellMs: number }) {
  const last = tour.steps.length - 1;
  // A countdown to the next step while the tour plays, so autoplay is visibly doing something.
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!playing || step >= last) return;
    const end = Date.now() + dwellMs;
    setLeft(Math.ceil(dwellMs / 1000));
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    return () => clearInterval(t);
  }, [playing, step, dwellMs, last]);
  const status = playing ? (step >= last ? "Last step" : `Next step in ${left}s`) : step >= last ? "Replay tour" : "Play tour";
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={() => onStep(Math.max(0, step - 1))}
        disabled={step === 0}
        aria-label="Previous step (←)"
        title="Previous step (←)"
        className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line text-fg-2 hover:border-outline hover:text-fg disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={onToggle}
        aria-label={playing ? "Pause the tour (space)" : "Play the tour: steps advance on their own (space)"}
        title={playing ? "Pause the tour (space)" : "Play the tour: steps advance on their own (space)"}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-trail text-[#16171a] transition hover:bg-trail-strong"
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
      </button>
      <button
        onClick={() => onStep(Math.min(last, step + 1))}
        disabled={step === last}
        aria-label="Next step (→)"
        title="Next step (→)"
        className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line text-fg-2 hover:border-outline hover:text-fg disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="w-[118px] shrink-0 font-mono text-[11px] whitespace-nowrap text-fg-3">{status}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {tour.steps.map((s, i) => (
          <button key={i} onClick={() => onStep(i)} title={`${i + 1}. ${s.title}`} aria-label={`Step ${i + 1}: ${s.title}`} className="group flex h-7 flex-1 items-center">
            {i === step && playing && step < last ? (
              // The current step fills up while it waits, then the tour moves on.
              <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-trail/30">
                <span key={step} className="absolute inset-y-0 left-0 rounded-full bg-trail" style={{ animation: `step-fill ${dwellMs}ms linear forwards` }} />
              </span>
            ) : (
              <span className={`h-1 w-full rounded-full transition ${i === step ? "h-1.5 bg-trail" : i < step ? "bg-trail/45" : "bg-line group-hover:bg-outline"}`} />
            )}
          </button>
        ))}
      </div>
      <button onClick={onSpeed} className="shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-fg-3 hover:text-fg" title="Playback speed">
        {speed}×
      </button>

    </div>
  );
}
