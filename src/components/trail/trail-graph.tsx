"use client";

// The map in two views: Modules (the model's map, relationships labelled) and Files (the real import graph
// worked out from the code, grouped by module). Both use the same graph-database style view.
import { useMemo, useRef, useState } from "react";
import { atlasToMermaid, svgFile } from "@/lib/export-map";
import { KIND_COLOR, SUPPORT } from "@/lib/palette";
import type { Atlas, RepoSummary, Tour } from "@/lib/schemas";
import { nodeForFile } from "@/server/trail/ground";
import { GraphView, type GraphEdge, type GraphNode } from "./graph";

const FILE_CAP = 120;

const shortLabel = (label: string) => {
  const l = label.replace(/\s+/g, " ").trim();
  return l.length > 22 ? `${l.slice(0, 21)}…` : l;
};

type Props = {
  atlas: Atlas;
  summary: RepoSummary;
  tour: Tour | null;
  step: number;
  selected: string | null;
  onSelect: (id: string | null, kind: "module" | "file") => void;
};

export function TrailGraph({ atlas, summary, tour, step, selected, onSelect }: Props) {
  const [view, setView] = useState<"modules" | "files">("modules");
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  function downloadSvg() {
    const svg = box.current?.querySelector<SVGSVGElement>("svg[role=group]");
    if (!svg) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svgFile(svg)], { type: "image/svg+xml" }));
    a.download = `${summary.repo}-${view}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const moduleOf = useMemo(() => {
    const nodes = atlas.nodes.map((n) => ({ id: n.id, files: n.files }));
    const cache = new Map<string, string>();
    return (path: string) => {
      if (!cache.has(path)) cache.set(path, nodeForFile(path, nodes) ?? "");
      return cache.get(path)!;
    };
  }, [atlas]);
  const kindOf = useMemo(() => new Map(atlas.nodes.map((n) => [n.id, n.kind])), [atlas]);
  const labelOf = useMemo(() => new Map(atlas.nodes.map((n) => [n.id, n.label])), [atlas]);

  const modules = useMemo(() => {
    const lines = new Map<string, number>();
    for (const [path, l] of summary.fileSizes) {
      const m = moduleOf(path);
      lines.set(m, (lines.get(m) ?? 0) + l);
    }
    const nodes: GraphNode[] = atlas.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: KIND_COLOR[n.kind] ?? SUPPORT,
      weight: Math.max(1, lines.get(n.id) ?? n.files.length * 50),
      kind: `${n.kind} · ${n.files.length} key ${n.files.length === 1 ? "file" : "files"}`,
      detail: n.purpose,
    }));
    const edges: GraphEdge[] = atlas.edges.map((e) => ({ source: e.from, target: e.to, label: shortLabel(e.label), verified: e.verified }));
    return { nodes, edges };
  }, [atlas, summary, moduleOf]);

  const files = useMemo(() => {
    const fanIn = new Map<number, number>();
    for (const [, to] of summary.imports) fanIn.set(to, (fanIn.get(to) ?? 0) + 1);
    const onTour = new Set([...(tour?.steps.map((s) => s.file) ?? []), ...(tour?.pull?.files.map((f) => f.path) ?? [])]);
    const ranked = summary.fileSizes
      .map(([path, lines], i) => ({ i, path, lines, score: (onTour.has(path) ? 1000 : 0) + (fanIn.get(i) ?? 0) * 10 + (summary.imports.some(([a]) => a === i) ? 1 : 0) }))
      .filter((f) => f.score > 0 || onTour.has(f.path))
      .sort((a, b) => b.score - a.score);
    const chosen = all ? ranked : ranked.slice(0, FILE_CAP);
    const keep = new Set(chosen.map((f) => f.i));
    const nodes: GraphNode[] = chosen.map((f) => {
      const m = moduleOf(f.path);
      return {
        id: f.path,
        label: f.path.split("/").pop() ?? f.path,
        color: KIND_COLOR[kindOf.get(m) ?? ""] ?? SUPPORT,
        weight: Math.max(5, f.lines),
        group: m || undefined,
        groupLabel: labelOf.get(m),
        kind: `${f.lines.toLocaleString()} lines · imported by ${fanIn.get(f.i) ?? 0}`,
        detail: f.path,
      };
    });
    const edges: GraphEdge[] = summary.imports.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => ({ source: summary.fileSizes[a][0], target: summary.fileSizes[b][0], label: "imports", verified: true }));
    return { nodes, edges, total: ranked.length };
  }, [summary, tour, all, moduleOf, kindOf, labelOf]);

  const current = tour?.steps[step];
  const previous = tour && step > 0 ? tour.steps[step - 1] : undefined;
  const visited = useMemo(() => {
    const m = new Map<string, number[]>();
    tour?.steps.forEach((s, i) => {
      const key = view === "modules" ? s.node : s.file;
      m.set(key, [...(m.get(key) ?? []), i + 1]);
    });
    return m;
  }, [tour, view]);

  // A PR tour marks what it changes: its modules on the module map, its files on the file graph.
  const changed = useMemo(() => (tour?.pull ? new Set([...(tour.modules ?? []), ...tour.pull.files.map((f) => f.path)]) : undefined), [tour]);

  const g = view === "modules" ? modules : files;
  const active = current ? (view === "modules" ? current.node : current.file) : null;
  const prev = previous ? (view === "modules" ? previous.node : previous.file) : null;

  return (
    <div ref={box} className="relative h-full w-full dot-grid">
      <div className="sr-only">
        <h2>Modules</h2>
        <ul>
          {atlas.nodes.map((n) => (
            <li key={n.id}>
              {n.label} ({n.kind}): {n.purpose} Connects to:{" "}
              {atlas.edges
                .filter((e) => e.from === n.id)
                .map((e) => `${labelOf.get(e.to) ?? e.to} (${e.label}${e.verified ? ", confirmed by imports" : ""})`)
                .join("; ") || "nothing"}
              .
            </li>
          ))}
        </ul>
      </div>
      <div role="tablist" aria-label="Map view" className="absolute top-3 left-3 z-10 flex gap-0.5 rounded-[10px] border border-line bg-panel/90 p-[3px] backdrop-blur">
        {(["modules", "files"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-[7px] px-3 py-1.5 font-mono text-[11.5px] tracking-[0.12em] uppercase transition ${view === v ? "bg-fg text-ink" : "text-fg-3 hover:text-fg"}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute top-3.5 right-3 left-[190px] z-10 hidden flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-[11px] text-fg-3 sm:flex">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" y1="3" x2="20" y2="3" stroke="#3987e5" strokeWidth="2" />
          </svg>
          imports in code
        </span>
        {changed && (
          <span className="flex items-center gap-1.5">
            <span className="grid size-3.5 place-items-center rounded-full bg-[#2ea043] text-[9px] font-bold text-white">±</span>
            changed in this PR
          </span>
        )}
        {view === "modules" && (
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke="#8a88a0" strokeWidth="1.6" strokeDasharray="4 4" />
            </svg>
            inferred by the model
          </span>
        )}
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
        <button
          onClick={() =>
            navigator.clipboard?.writeText(atlasToMermaid(atlas)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          title="Copy the module map as a Mermaid flowchart (for READMEs and docs)"
          className="rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg"
        >
          {copied ? "Mermaid copied" : "Copy Mermaid"}
        </button>
        <button onClick={downloadSvg} title="Download this view as an SVG image" className="rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg">
          Download SVG
        </button>
        {view === "files" && files.total > FILE_CAP && (
          <button onClick={() => setAll((a) => !a)} className="rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg">
            {all ? `Top ${FILE_CAP} only` : `${FILE_CAP} of ${files.total} files · show all`}
          </button>
        )}
      </div>
      {g.nodes.length === 0 ? (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-3">No import links were found between the files read, so there is no file graph for this repo.</p>
      ) : (
        <GraphView
          key={view}
          nodes={g.nodes}
          edges={g.edges}
          active={active}
          previous={prev}
          visited={visited}
          changed={changed}
          selected={selected}
          onSelect={(id) => onSelect(id, view === "modules" ? "module" : "file")}
          edgeLabels={view === "modules" && g.edges.length <= 16 ? "all" : "focus"}
          minRadius={view === "modules" ? 20 : 7}
          maxRadius={view === "modules" ? 48 : 26}
        />
      )}
    </div>
  );
}
