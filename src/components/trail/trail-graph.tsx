"use client";

// The map in three views: Architecture (the modules as a layered diagram), Modules (the same map as a graph you
// can drag, relationships labelled) and Files (the real import graph worked out from the code, grouped by module).
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { groupsOf } from "@/lib/architecture";
import { drawioXml, type Layout, type Route } from "@/lib/diagram";
import { atlasToMermaid, svgFile, svgToPng } from "@/lib/export-map";
import { formatUsd } from "@/lib/format";
import { SUPPORT } from "@/lib/palette";
import type { Atlas, RepoSummary, Tour } from "@/lib/schemas";
import { nodeForFile } from "@/server/trail/ground";
import { ArchitectureView } from "./architecture";
import { CallsView } from "./calls-view";
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
  /** Modules opened into their files on the Architecture view. */
  expanded: Set<string>;
  onToggle: (id: string) => void;
  /** A link was clicked: show the import lines behind it. */
  onEdge: (route: Route) => void;
  /** Where the README image and the Markdown page are served from. */
  siteUrl: string;
  /** The file on the Calls view, and a way to open code from it. */
  callsFile: string | null;
  onCallsFile: (path: string) => void;
  onOpenCode: (file: string, line: number) => void;
  /** Names the layers of a map read before reads did (one small call on the module list). */
  onGroupLayers?: () => Promise<void>;
};

export function TrailGraph({ atlas, summary, tour, step, selected, onSelect, expanded, onToggle, onEdge, siteUrl, callsFile, onCallsFile, onOpenCode, onGroupLayers }: Props) {
  const [view, setView] = useState<"architecture" | "modules" | "files" | "calls">("architecture");
  // "calls" in the code panel brings the Calls view up on that file.
  useEffect(() => {
    if (callsFile) setView("calls");
  }, [callsFile]);
  const [all, setAll] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [grouping, setGrouping] = useState(false);
  const unlayered = !atlas.nodes.some((n) => n.layer);
  // The module list in, a few hundred words of layers (and reasoning) out; the repo isn't sent.
  const layersCost = summary.price ? (atlas.nodes.length * 80 + 400) * summary.price.input + 1_500 * summary.price.output : null;
  const box = useRef<HTMLDivElement>(null);

  const save = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  /** The current view as an SVG file: the whole diagram on the Architecture view, what's on screen otherwise. */
  const currentSvg = () => {
    const svg = box.current?.querySelector<SVGSVGElement>("svg[role=group]");
    return svg ? svgFile(svg, view === "architecture" && layout ? { w: layout.w, h: layout.h } : undefined) : null;
  };
  const local = summary.owner === "_local";
  const base = `${siteUrl.replace(/\/$/, "")}/${summary.owner}/${summary.repo}`;
  const embed = `[![Architecture of ${summary.owner}/${summary.repo}](${base}/diagram.svg)](${base}) [![Explore with Codetrail](${siteUrl.replace(/\/$/, "")}/badge.svg)](${base})`;
  const exports: { label: string; hint: string; run: () => void | Promise<void>; show: boolean }[] = [
    { label: "Copy as Mermaid", hint: "The architecture as a Mermaid flowchart, each module linking to its folder on GitHub", run: () => navigator.clipboard?.writeText(atlasToMermaid(atlas, summary)), show: view === "architecture" || view === "modules" },
    { label: "Download SVG", hint: `The ${view} view as an SVG image`, run: () => { const f = currentSvg(); if (f) save(new Blob([f], { type: "image/svg+xml" }), `${summary.repo}-${view}.svg`); }, show: true },
    { label: "Download PNG", hint: `The ${view} view as a PNG image, at twice the size`, run: async () => { const f = currentSvg(); if (f) save(await svgToPng(f), `${summary.repo}-${view}.png`); }, show: true },
    { label: "Download for draw.io", hint: "An editable draw.io file, with the layers, boxes and links as laid out here", run: () => { if (layout) save(new Blob([drawioXml(layout, `${summary.repo} architecture`)], { type: "application/xml" }), `${summary.repo}-architecture.drawio`); }, show: view === "architecture" && !!layout },
    { label: "Embed in a README", hint: `Copies Markdown for a live diagram image and a badge, served from ${siteUrl}`, run: () => navigator.clipboard?.writeText(embed), show: !local && !summary.private },
    { label: "Markdown for AI tools", hint: "This repo's map, tours and docs as one Markdown page an AI tool can read", run: () => void window.open(`/${summary.owner}/${summary.repo}.md`, "_blank"), show: true },
  ];

  const moduleOf = useMemo(() => {
    const nodes = atlas.nodes.map((n) => ({ id: n.id, files: n.files }));
    const cache = new Map<string, string>();
    return (path: string) => {
      if (!cache.has(path)) cache.set(path, nodeForFile(path, nodes) ?? "");
      return cache.get(path)!;
    };
  }, [atlas]);
  // One colour per layer (or kind), the same on every view.
  const colorOf = useMemo(() => groupsOf(atlas.nodes).color, [atlas]);
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
      color: colorOf.get(n.id) ?? SUPPORT,
      weight: Math.max(1, lines.get(n.id) ?? n.files.length * 50),
      kind: `${n.kind} · ${n.files.length} key ${n.files.length === 1 ? "file" : "files"}`,
      detail: n.purpose,
    }));
    const edges: GraphEdge[] = atlas.edges.map((e) => ({ source: e.from, target: e.to, label: shortLabel(e.label), verified: e.verified }));
    return { nodes, edges };
  }, [atlas, summary, moduleOf, colorOf]);

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
        color: colorOf.get(m) ?? SUPPORT,
        weight: Math.max(5, f.lines),
        group: m || undefined,
        groupLabel: labelOf.get(m),
        kind: `${f.lines.toLocaleString()} lines · imported by ${fanIn.get(f.i) ?? 0}`,
        detail: f.path,
      };
    });
    const edges: GraphEdge[] = summary.imports.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => ({ source: summary.fileSizes[a][0], target: summary.fileSizes[b][0], label: "imports", verified: true }));
    return { nodes, edges, total: ranked.length };
  }, [summary, tour, all, moduleOf, colorOf, labelOf]);

  const current = tour?.steps[step];
  const previous = tour && step > 0 ? tour.steps[step - 1] : undefined;
  const visited = useMemo(() => {
    const m = new Map<string, number[]>();
    tour?.steps.forEach((s, i) => {
      const key = view === "files" ? s.file : s.node;
      m.set(key, [...(m.get(key) ?? []), i + 1]);
    });
    return m;
  }, [tour, view]);

  // A PR tour marks what it changes: its modules on the module map, its files on the file graph.
  const changed = useMemo(() => (tour?.pull ? new Set([...(tour.modules ?? []), ...tour.pull.files.map((f) => f.path)]) : undefined), [tour]);

  const g = view === "files" ? files : modules;
  const active = current ? (view === "files" ? current.file : current.node) : null;
  const prev = previous ? (view === "files" ? previous.file : previous.node) : null;

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
        {(["architecture", "modules", "files", "calls"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setView(v);
              if (v === "calls" && !callsFile) {
                const start = tour?.steps[step]?.file ?? summary.entries.find((e) => /\.(m?[jt]sx?|py|go)$/.test(e)) ?? null;
                if (start) onCallsFile(start);
              }
            }}
            className={`rounded-[7px] px-3 py-1.5 font-mono text-[11.5px] tracking-[0.12em] uppercase transition ${view === v ? "bg-fg text-ink" : "text-fg-3 hover:text-fg"}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className={`pointer-events-none absolute top-3 right-3 z-10 hidden max-w-[calc(100%-400px)] flex-wrap justify-end gap-x-4 gap-y-1 rounded-[9px] bg-ink/75 px-2.5 py-1.5 font-mono text-[11px] text-fg-3 backdrop-blur ${view === "calls" ? "" : "sm:flex"}`}>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="6" aria-hidden>
            <line x1="0" y1="3" x2="20" y2="3" stroke={view === "architecture" ? "#8a88a0" : "#3987e5"} strokeWidth="2" />
          </svg>
          imports in code
        </span>
        {tour && (
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-[#ffb020] px-1.5 text-[9px] leading-[14px] font-bold text-[#07080c]">1,2</span>
            tour steps
          </span>
        )}
        {changed && (
          <span className="flex items-center gap-1.5">
            <span className="grid size-3.5 place-items-center rounded-full bg-[#2ea043] text-[9px] font-bold text-white">±</span>
            changed in this PR
          </span>
        )}
        {view !== "files" && (
          <span className="flex items-center gap-1.5">
            <svg width="20" height="6" aria-hidden>
              <line x1="0" y1="3" x2="20" y2="3" stroke="#8a88a0" strokeWidth="1.6" strokeDasharray="4 4" />
            </svg>
            inferred by the model
          </span>
        )}
      </div>
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
        <ExportMenu items={exports.filter((x) => x.show)} />
        {view === "architecture" && expanded.size > 0 && (
          <button onClick={() => [...expanded].forEach(onToggle)} className="rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg">
            Close opened modules
          </button>
        )}
        {view === "architecture" && unlayered && onGroupLayers && (
          <button
            disabled={grouping}
            onClick={() => {
              setGrouping(true);
              onGroupLayers().finally(() => setGrouping(false));
            }}
            title="Ask DeepSeek to group these modules into architecture layers. Only the module list is sent, not the repo."
            className="rounded-[9px] border border-trail/50 bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg hover:border-trail disabled:opacity-60"
          >
            {grouping ? "Grouping into layers…" : `Group into layers${layersCost ? ` · ≈ ${formatUsd(layersCost)}` : ""}`}
          </button>
        )}
        {view === "files" && files.total > FILE_CAP && (
          <button onClick={() => setAll((a) => !a)} className="rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg">
            {all ? `Top ${FILE_CAP} only` : `${FILE_CAP} of ${files.total} files · show all`}
          </button>
        )}
      </div>
      {view === "calls" ? (
        <CallsView summary={summary} file={callsFile} onFile={onCallsFile} onOpen={(spot) => onOpenCode(spot.file, spot.line)} />
      ) : view === "architecture" ? (
        <ArchitectureView
          atlas={atlas}
          summary={summary}
          expanded={expanded}
          active={active}
          previous={prev}
          visited={visited}
          changed={changed}
          selected={selected}
          // A file inside an opened module has the id "module::path".
          onSelect={(id) => (id?.includes("::") ? onSelect(id.slice(id.indexOf("::") + 2), "file") : onSelect(id, "module"))}
          onToggle={onToggle}
          onEdge={onEdge}
          onLayout={setLayout}
        />
      ) : g.nodes.length === 0 ? (
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

/** One menu for every way to take the map away. */
function ExportMenu({ items }: { items: { label: string; hint: string; run: () => void | Promise<void> }[] }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-panel/90 px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:text-fg"
      >
        {done ?? "Export"} <ChevronDown className="size-3" />
      </button>
      {open && (
        <ul role="menu" className="absolute bottom-full left-0 z-20 mb-1 w-72 rounded-[10px] border border-line bg-panel p-1 shadow-lg">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  await item.run();
                  setDone(item.label.startsWith("Copy") || item.label.startsWith("Embed") ? "Copied" : "Done");
                  setTimeout(() => setDone(null), 1500);
                }}
                className="block w-full rounded-[7px] px-2.5 py-2 text-left hover:bg-raised"
              >
                <span className="block text-[12.5px] text-fg">{item.label}</span>
                <span className="block text-[11px] leading-snug text-fg-3">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
