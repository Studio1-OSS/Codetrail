"use client";

import { FileSearch, Image as ImageIcon, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTokens, formatUsd, perMillion } from "@/lib/format";
import { LOCAL_OWNER } from "@/lib/ref";
import type { RepoSummary } from "@/lib/schemas";
import { KIND_COLOR, SUPPORT } from "@/lib/palette";
import { GraphView, type GraphEdge, type GraphNode } from "./graph";
import { Treemap } from "./treemap";

const CONTEXT = 1_048_576;

/** Rough wall-clock for the first read (map + main tour), from our runs: ~15-25s at 250-450K tokens. */
const expectedSeconds = (tokens: number) => Math.round(12 + tokens / 25_000);

export function ReadCard({ summary, onRead, busy }: { summary: RepoSummary; onRead: () => void; busy: boolean }) {
  const [files, setFiles] = useState(false);
  const used = Math.max(1, Math.round((summary.tokens / CONTEXT) * 100));
  return (
    <div className="w-full max-w-[1240px]">
      <p className="font-mono text-[12px] text-fg-3">
        {summary.owner === LOCAL_OWNER ? "this machine" : summary.owner} / {summary.repo} · {summary.sha.slice(0, 7)} · {summary.ref}
      </p>
      <h1 className="mt-2 font-display text-[44px] leading-none font-light tracking-[-0.05em] [font-stretch:78%] sm:text-[60px]">
        Ready to <span className="font-extrabold text-trail [font-stretch:110%]">read</span>.
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
        Codetrail {summary.owner === LOCAL_OWNER ? "read this folder from disk" : "downloaded this commit"}, skipped what isn&apos;t code and mapped the imports, all on its own. Nothing has been sent to the model and nothing has been spent. Below is
        what one read would send.
      </p>

      <div className="mt-10 flex flex-wrap items-start gap-12">
        <div className="min-w-0 flex-[999_1_600px] space-y-11">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="font-medium">How much of {summary.modelLabel}&apos;s 1M-token context this repo will fill</h2>
              <span className="font-mono text-[12px] text-fg-3">
                one dot = 10K tokens ·{" "}
                <span className="text-trail">
                  ≈ {formatTokens(summary.tokens)} to send ({used}%)
                </span>
              </span>
            </div>
            <div
              role="img"
              aria-label={`The read will send about ${formatTokens(summary.tokens)} of 1,048,576 tokens, about ${used} of 100 dots. Nothing has been sent yet.`}
              className="mt-4 grid grid-cols-[repeat(25,minmax(0,1fr))] gap-[7px] sm:gap-[9px]"
            >
              {Array.from({ length: 100 }, (_, i) => (
                <span key={i} className={`aspect-square rounded-full ${i < used ? "bg-trail" : "bg-raised"}`} style={{ animation: `waypoint-pop .45s ${i * 6}ms both` }} />
              ))}
            </div>
            {summary.files.compressed > 0 && (
              <p className="mt-3 text-[13px] text-fg-2">
                {summary.files.compressed} lower-priority files won&apos;t fit whole, so they&apos;ll be sent as signatures only (imports and declarations, with their real line numbers).
              </p>
            )}
            {summary.files.overBudget > 0 && (
              <p className="mt-1.5 text-[13px] text-warn">
                {summary.files.overBudget} more files won&apos;t fit even as signatures, so they&apos;ll be left out (tests and examples go first).
              </p>
            )}
            {summary.files.secrets > 0 && (
              <p className="mt-1.5 text-[13px] text-fg-2">{summary.files.secrets} files that look like they hold credentials will be left out and never sent to the model.</p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
              <h2 className="font-medium">What will be sent</h2>
              <span className="font-mono text-[12px] text-fg-3">
                {summary.files.read} files to send · {summary.files.skipped} skipped
              </span>
            </div>
            <div className="mt-4">
              <Treemap summary={summary} />
            </div>
          </section>

          <section className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
            {[
              { v: `${summary.files.read}`, l: `files to read, of ${summary.files.total}` },
              { v: summary.lines.toLocaleString(), l: "lines, each numbered" },
              { v: formatTokens(summary.tokens), l: summary.tokensMeasured ? "tokens (measured)" : "tokens (estimated)" },
              { v: summary.graphEdges.toLocaleString(), l: "import links, from the code" },
            ].map((s) => (
              <div key={s.l} className="border-b border-line py-4 pr-2">
                <div className="font-display text-[26px] font-medium tracking-tight [font-stretch:80%]">{s.v}</div>
                <div className="mt-1 text-[12.5px] text-fg-3">{s.l}</div>
              </div>
            ))}
          </section>
        </div>

        <aside className="min-w-0 flex-[1_1_340px] space-y-6">
          <div className="rounded-card border border-line bg-panel p-6">
            <p className="text-[13px] text-fg-3">Map + main tour, one read, estimated</p>
            <p className="mt-1 font-display text-[44px] font-medium tracking-[-0.04em] [font-stretch:80%]">≈ {formatUsd(summary.estimate.firstRead)}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
              Then ≈ {formatUsd(summary.estimate.followUp)} per extra tour while the repo is in cache, up to ≈ {formatUsd(summary.estimate.followUpCold)}{" "}
              if it isn&apos;t yet. Saved tours replay free for everyone.
            </p>
            <button
              onClick={onRead}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[12px] bg-trail px-4 py-3.5 font-display text-[14px] font-bold tracking-wide text-[#16171a] transition hover:bg-trail-strong disabled:opacity-60 [font-stretch:90%]"
            >
              <Play className="size-4 fill-current" /> READ THE REPO · ~{expectedSeconds(summary.tokens)}s
            </button>
            <button onClick={() => setFiles(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-line px-4 py-2.5 text-[13px] text-fg-2 hover:border-outline hover:text-fg">
              <FileSearch className="size-4" /> See every file that will be read
            </button>
            {summary.price && (
              <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-fg-3">
                Live price · {perMillion(summary.price.input)} input · <span className="text-trail">{perMillion(summary.price.cached)} cached</span> · {perMillion(summary.price.output)} output
                per 1M tokens · Nebius Token Factory
              </p>
            )}
          </div>
          <div className="text-[13px] leading-relaxed text-fg-2">
            <p className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">How this read works</p>
            <p className="mt-2">
              Every file goes to {summary.modelLabel} in one prompt with line numbers, plus the import graph worked out from the code. One call returns the modules, how they
              connect, the questions worth asking and the first tour. Every step is then checked against the real file.
            </p>
          </div>
        </aside>
      </div>
      <FilesDrawer open={files} onClose={() => setFiles(false)} summary={summary} />
    </div>
  );
}

const REASON: Record<string, string> = {
  lockfile: "lockfile",
  generated: "generated or boilerplate",
  binary: "not text code",
  too_large: "over 200 KB",
  minified: "minified",
  secret: "looks like it holds credentials",
};

export function FilesDrawer({ open, onClose, summary }: { open: boolean; onClose: () => void; summary: RepoSummary }) {
  const [tab, setTab] = useState<"read" | "compressed" | "budget" | "skipped">("read");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const tabs = [
    { id: "read" as const, label: `Read (${summary.files.read})` },
    { id: "compressed" as const, label: `Signatures only (${summary.files.compressed})` },
    { id: "budget" as const, label: `Over budget (${summary.files.overBudget})` },
    { id: "skipped" as const, label: `Skipped (${summary.files.skipped})` },
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-night">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[20px] font-medium tracking-tight [font-stretch:85%]">What the model reads</h2>
            <p className="text-xs text-fg-3">README, manifests and entry points first, tests and examples last.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-fg-3 hover:bg-raised hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-1 border-b border-line px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs ${tab === t.id ? "bg-raised-2 text-fg" : "text-fg-3 hover:text-fg-2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {summary.files.images.length > 0 && tab === "read" && (
          <p className="flex items-center gap-1.5 border-b border-line px-5 py-2 text-xs text-fg-2">
            <ImageIcon className="size-3.5 text-verified" /> Images sent too: {summary.files.images.join(", ")}
          </p>
        )}
        <ul className="min-h-0 flex-1 overflow-y-auto px-5 py-3 font-mono text-xs">
          {tab === "read" && summary.read.map((p, i) => <Row key={p} n={i + 1} path={p} />)}
          {tab === "compressed" && (summary.compressed.length ? summary.compressed.map((p) => <Row key={p} path={p} note="signatures only" />) : <Empty />)}
          {tab === "budget" && (summary.overBudget.length ? summary.overBudget.map((p) => <Row key={p} path={p} />) : <Empty />)}
          {tab === "skipped" &&
            (summary.skippedSample.length ? summary.skippedSample.map((s) => <Row key={s.path} path={s.path} note={REASON[s.reason] ?? s.reason} />) : <Empty />)}
        </ul>
      </aside>
    </div>
  );
}

function Row({ path, n, note }: { path: string; n?: number; note?: string }) {
  return (
    <li className="flex items-baseline gap-3 py-1 text-fg-2">
      {n !== undefined && <span className="w-8 shrink-0 text-right text-fg-3">{n}</span>}
      <span className="min-w-0 flex-1 truncate" title={path}>
        {path}
      </span>
      {note && <span className="shrink-0 font-sans text-[11px] text-fg-3">{note}</span>}
    </li>
  );
}

const Empty = () => <li className="py-2 font-sans text-fg-3">Nothing here.</li>;

export type LiveRead = {
  thinkingChars: number;
  chars: number;
  summary: string | null;
  nodes: { id: string; label: string; kind: string }[];
  edges: { from: string; to: string; label: string }[];
  tours: string[];
  steps: { title: string; node: string | null }[];
};

/**
 * While the model reads: elapsed time, a "thinking" counter, then the map building itself live as modules,
 * links and tour steps stream in. Without a stream it still shows the files going by.
 */
export function Reading({ summary, label, live }: { summary: RepoSummary; label: string; live?: LiveRead | null }) {
  const [elapsed, setElapsed] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    const f = setInterval(() => setTick((x) => x + 1), 140);
    return () => {
      clearInterval(t);
      clearInterval(f);
    };
  }, []);
  const expected = expectedSeconds(summary.tokens);
  const files = summary.read;
  const nodes = live?.nodes ?? [];
  const graphNodes: GraphNode[] = nodes.map((n) => ({ id: n.id, label: n.label, color: KIND_COLOR[n.kind] ?? SUPPORT, weight: 1, kind: n.kind }));
  const ids = new Set(nodes.map((n) => n.id));
  const graphEdges: GraphEdge[] = (live?.edges ?? []).filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ source: e.from, target: e.to, label: e.label }));
  const stage = !live || (live.chars === 0 && live.thinkingChars === 0) ? "reading" : live.chars === 0 ? "thinking" : live.steps.length ? "tour" : nodes.length ? "mapping" : "writing";
  const STAGES = [
    { id: "reading", text: `Reading ${summary.files.read} files (${formatTokens(summary.tokens)} tokens)` },
    { id: "thinking", text: live?.thinkingChars ? `Thinking · ${Math.round(live.thinkingChars / 3.6).toLocaleString()} tokens` : "Thinking" },
    { id: "mapping", text: `Mapping modules · ${nodes.length}` },
    { id: "tour", text: `Tracing the main flow · ${live?.steps.length ?? 0} steps` },
  ];
  const order = ["reading", "thinking", "writing", "mapping", "tour"];
  const at = order.indexOf(stage);

  return (
    <div className="w-full max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-trail uppercase">{label}</p>
          <h1 className="mt-2 font-display text-[36px] leading-none font-light tracking-[-0.05em] [font-stretch:78%] sm:text-[48px]">
            {summary.modelLabel} <span className="font-extrabold [font-stretch:105%]">is reading.</span>
          </h1>
        </div>
        <p className="font-mono text-[12px] text-fg-3">
          {elapsed.toFixed(1)}s · usually ~{expected}s
        </p>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-trail transition-[width] duration-200" style={{ width: `${Math.min(96, (elapsed / expected) * 100)}%` }} />
      </div>

      <div className="mt-8 flex flex-wrap gap-8">
        <div className="relative h-[460px] min-w-0 flex-[999_1_560px] overflow-hidden rounded-card border border-line dot-grid">
          {graphNodes.length > 0 ? (
            <GraphView nodes={graphNodes} edges={graphEdges} active={null} previous={null} visited={new Map()} selected={null} onSelect={() => {}} edgeLabels="all" minRadius={22} maxRadius={22} />
          ) : (
            <div className="absolute inset-0 overflow-hidden p-5 font-mono text-[11.5px] leading-6 text-fg-3 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)]">
              {files.length > 0 &&
                Array.from({ length: 18 }, (_, k) => {
                  const path = files[(tick + k) % files.length];
                  return (
                    <div key={k} className={k === 9 ? "text-trail" : undefined}>
                      {k === 9 ? "› " : "  "}
                      {path}
                    </div>
                  );
                })}
            </div>
          )}
          <p className="absolute bottom-3 left-4 font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">
            {graphNodes.length ? "the map, as DeepSeek writes it" : "files going into one prompt"}
          </p>
        </div>

        <div className="min-w-0 flex-[1_1_320px] space-y-6">
          <ol className="space-y-3">
            {STAGES.map((s, i) => {
              const idx = order.indexOf(s.id);
              const done = at > idx;
              const now = at === idx || (s.id === "thinking" && stage === "writing");
              return (
                <li key={s.id} className={`flex items-center gap-3 font-mono text-[12.5px] ${done ? "text-fg-2" : now ? "text-fg" : "text-fg-3"}`}>
                  <span className={`size-2.5 rounded-full ${done ? "bg-trail" : now ? "animate-pulse bg-trail" : "border border-outline"}`} />
                  {s.text}
                  {i === 0 && done && <span className="text-ok">✓</span>}
                </li>
              );
            })}
          </ol>
          {live?.summary && <p className="text-[13.5px] leading-relaxed text-fg-2">{live.summary}</p>}
          {live && live.tours.length > 0 && (
            <div>
              <p className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">Questions worth asking</p>
              <ul className="mt-2 space-y-1 text-[13px] text-fg-2">
                {live.tours.map((t) => (
                  <li key={t} className="border-l-2 border-line pl-2.5">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {live && live.steps.length > 0 && (
            <div>
              <p className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">Main tour</p>
              <ol className="mt-2 space-y-1 font-mono text-[12px] text-fg-2">
                {live.steps.map((s, i) => (
                  <li key={i}>
                    <span className="text-trail">{String(i + 1).padStart(2, "0")}</span> {s.title}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
