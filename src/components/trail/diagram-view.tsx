"use client";

// Draws a laid-out diagram (src/lib/diagram.ts) and lets you work with it: pan and zoom (opening at a size you
// can read), hover to light a box's links and read what they do, click a box or a link, double-click to open a
// module. A tour lights its boxes and the hop between steps.
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { COMPOUND_TOP, layoutDiagram, midpoint, rounded, type DiagramSpec, type Layout, type Route } from "@/lib/diagram";
import { touchFriendly } from "@/lib/touch";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const TRAIL = "#ffb020";
const LINE = "#8a88a0";
// The smallest zoom the diagram opens at: below it, box labels get too small to read.
const READABLE = 0.85;

type Props = {
  spec: DiagramSpec;
  ariaLabel: string;
  active?: string | null;
  previous?: string | null;
  visited?: Map<string, number[]>;
  changed?: Set<string>;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  onEdge?: (route: Route) => void;
  onLayout?: (layout: Layout) => void;
  /** Smaller chrome for a diagram inside a page (the docs). */
  compact?: boolean;
  /** Label for each box, read by screen readers. */
  describe?: (id: string) => string;
};

export function DiagramView({ spec, ariaLabel, active = null, previous = null, visited, changed, selected = null, onSelect, onOpen, onEdge, onLayout, compact, describe }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [failed, setFailed] = useState(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const still = useReducedMotion();
  const layoutSeen = useRef(onLayout);
  layoutSeen.current = onLayout;

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    layoutDiagram(spec)
      .then((l) => {
        if (!live) return;
        setLayout(l);
        setFailed(false);
        layoutSeen.current?.(l);
      })
      .catch((err) => {
        console.error("Diagram layout failed", err);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [spec]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 2.5])
      .filter(touchFriendly)
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
  }, []);

  /** Frame the whole diagram; unless `whole`, never below a readable size, centred on the tour's box instead. */
  const fit = (whole = true, animate = true) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z || !layout) return;
    const top = compact ? 16 : 56;
    const all = Math.min(compact ? 1 : 1.15, (size.w - 32) / layout.w, (size.h - top - 40) / layout.h);
    const k = whole || compact ? all : Math.max(all, READABLE);
    const b = active ? layout.boxes.get(active) : undefined;
    const t =
      k === all
        ? zoomIdentity.translate((size.w - layout.w * k) / 2, Math.max(top, (size.h - layout.h * k) / 2)).scale(k)
        : b
          ? zoomIdentity.translate(size.w / 2, size.h / 2).scale(k).translate(-(b.x + b.w / 2), -(b.y + b.h / 2))
          : zoomIdentity.translate((size.w - layout.w * k) / 2, top).scale(k);
    if (animate) select(svg).transition().duration(400).call(z.transform, t);
    else select(svg).call(z.transform, t);
  };

  // Frame the diagram once it's laid out, and again when the panel changes size.
  useEffect(() => {
    fit(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, size.w, size.h]);

  // Follow the tour: bring the current box into view if it isn't.
  useEffect(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    const b = active ? layout?.boxes.get(active) : undefined;
    if (!svg || !z || !b) return;
    const cx = transform.applyX(b.x + b.w / 2), cy = transform.applyY(b.y + b.h / 2);
    if (cx > 60 && cx < size.w - 60 && cy > 90 && cy < size.h - 60) return;
    const k = Math.max(transform.k, READABLE);
    select(svg)
      .transition()
      .duration(600)
      .call(z.transform, zoomIdentity.translate(size.w / 2, size.h / 2).scale(k).translate(-(b.x + b.w / 2), -(b.y + b.h / 2)));
    // Only when the step moves: a new layout is framed whole by the fit above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).transition().duration(250).call(z.scaleBy, factor);
  };

  if (failed) return <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-3">The diagram couldn&apos;t be laid out.</p>;

  const parentOf = new Map(spec.boxes.filter((b) => b.parent).map((b) => [b.id, b.parent!]));
  const focus = hover ?? selected;
  const near = new Set<string>(focus ? [focus] : []);
  if (focus)
    for (const r of layout?.routes ?? []) {
      if (r.from === focus || r.to === focus || parentOf.get(r.from) === focus || parentOf.get(r.to) === focus) near.add(r.from).add(r.to);
    }
  const touring = (visited?.size ?? 0) > 0;
  const hop = active && previous && active !== previous ? [`${previous}>${active}`, `${active}>${previous}`] : [];
  const hopRoute = layout?.routes.find((r) => hop.includes(r.key));
  const routeOn = (r: Route) => !!focus && (r.from === focus || r.to === focus || parentOf.get(r.from) === focus || parentOf.get(r.to) === focus);
  // Compound boxes first, so the files inside them draw on top.
  const boxes = layout ? [...layout.boxes.values()].sort((a, b) => Number(b.box.kind === "compound") - Number(a.box.kind === "compound")) : [];

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg ref={svgRef} className="h-full w-full touch-pan-y select-none lg:touch-none" role="group" aria-label={ariaLabel} onClick={(e) => e.target === svgRef.current && onSelect?.(null)}>
        <defs>
          {[
            ["dg-arrow", LINE],
            ["dg-arrow-on", "var(--color-fg)"],
            ["dg-arrow-trail", TRAIL],
          ].map(([id, fill]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill }} />
            </marker>
          ))}
        </defs>
        {layout && (
          <g transform={transform.toString()}>
            {layout.groups.map((l) => (
              <g key={l.id} className="pointer-events-none" opacity={focus ? 0.5 : 1}>
                <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={14} fill={l.color} fillOpacity={0.05} stroke={l.color} strokeOpacity={0.45} strokeWidth={1.2} strokeDasharray="5 5" />
                <text x={l.x + 16} y={l.y + 22} className="font-mono uppercase" fontSize={11.5} fontWeight={600} letterSpacing="0.14em" fill={l.color}>
                  {l.title}
                </text>
              </g>
            ))}

            {boxes.map((p) => {
              const b = p.box;
              const isActive = p.id === active;
              const steps = visited?.get(p.id);
              const compound = b.kind === "compound";
              const small = b.kind === "file" || b.kind === "fn" || b.kind === "external";
              const dim = focus ? !near.has(p.id) && parentOf.get(focus) !== p.id && p.id !== parentOf.get(p.id) : touring && !steps && !isActive && !compound;
              const pick = () => onSelect?.(p.id === selected ? null : p.id);
              return (
                <g
                  key={p.id}
                  transform={`translate(${p.x},${p.y})`}
                  className="cursor-pointer"
                  opacity={dim && !compound ? (focus ? 0.3 : 0.55) : 1}
                  role="button"
                  tabIndex={0}
                  aria-pressed={p.id === selected}
                  aria-label={describe?.(p.id) ?? `${b.label}${b.caption ? `, ${b.caption}` : ""}`}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                  onFocus={() => setHover(p.id)}
                  onBlur={() => setHover((h) => (h === p.id ? null : h))}
                  onClick={(e) => {
                    e.stopPropagation();
                    pick();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpen?.(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick();
                    }
                  }}
                >
                  {isActive && <rect x={-5} y={-5} width={p.w + 10} height={p.h + 10} rx={14} fill="none" stroke={TRAIL} strokeWidth={2} strokeOpacity={0.5} />}
                  <rect
                    width={p.w}
                    height={p.h}
                    rx={compound ? 12 : small ? 8 : 10}
                    style={{ fill: "var(--color-panel)", stroke: isActive ? TRAIL : p.id === selected ? "var(--color-fg)" : b.color }}
                    strokeWidth={isActive || p.id === selected ? 2.2 : compound ? 1.6 : 1.4}
                    strokeDasharray={b.kind === "external" ? "4 4" : undefined}
                  />
                  <rect width={p.w} height={compound ? COMPOUND_TOP - 6 : p.h} rx={compound ? 12 : small ? 8 : 10} fill={isActive ? TRAIL : b.color} fillOpacity={isActive ? 0.16 : compound ? 0.16 : 0.12} className="pointer-events-none" />
                  {!small && <rect x={0} y={10} width={3.5} height={(compound ? COMPOUND_TOP : p.h) - 20} rx={1.75} fill={isActive ? TRAIL : b.color} />}
                  <text x={small ? 10 : 14} y={small ? (b.caption ? 17 : 20) : p.lines.length > 1 && !compound ? 19 : compound ? 20 : 25} fontSize={small ? 11.5 : 12.5} fontWeight={small ? 600 : 700} style={{ fill: "var(--color-fg)" }} className={`pointer-events-none ${b.kind === "fn" || b.kind === "file" ? "font-mono" : ""}`}>
                    {(compound ? [p.lines.join(" ")] : p.lines).map((t, i) => (
                      <tspan key={i} x={small ? 10 : 14} dy={i ? 15 : 0}>
                        {t}
                      </tspan>
                    ))}
                  </text>
                  {b.caption && (
                    <text x={small ? 10 : 14} y={compound ? 35 : small ? p.h - 9 : p.h - 10} fontSize={small ? 9.5 : 10.5} style={{ fill: "var(--color-fg-3)" }} className="pointer-events-none font-mono">
                      {b.caption.length > (small ? 34 : 40) ? `…${b.caption.slice(-(small ? 33 : 39))}` : b.caption}
                    </text>
                  )}
                  {changed?.has(p.id) && (
                    <g transform={`translate(${p.w - 2},2)`} className="pointer-events-none">
                      <circle r={9} fill="#2ea043" style={{ stroke: "var(--color-outline)" }} strokeWidth={2} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="#ffffff" className="font-mono">
                        ±
                      </text>
                    </g>
                  )}
                  {steps && (
                    <g transform={`translate(${p.w - (changed?.has(p.id) ? 26 : 4)},-2)`} className="pointer-events-none">
                      <rect x={-Math.max(22, steps.slice(0, 3).join(",").length * 7.4 + 12)} y={-9} width={Math.max(22, steps.slice(0, 3).join(",").length * 7.4 + 12)} height={20} rx={10} fill={TRAIL} style={{ stroke: "var(--color-outline)" }} strokeWidth={2} />
                      <text x={-Math.max(22, steps.slice(0, 3).join(",").length * 7.4 + 12) / 2} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} fill="#07080c" className="font-mono">
                        {steps.slice(0, 3).join(",")}
                        {steps.length > 3 ? "…" : ""}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {layout.routes.map((r) => {
              const on = routeOn(r);
              const isHop = r === hopRoute;
              const dim = (focus && !on) || (touring && !isHop && !focus);
              const reverse = isHop && r.key !== hop[0];
              const d = rounded(r.points);
              return (
                <g key={r.key} opacity={dim ? (focus ? 0.15 : 0.4) : 1}>
                  <path
                    id={`dg-${r.key}`}
                    d={d}
                    fill="none"
                    style={{ stroke: isHop ? TRAIL : on ? "var(--color-fg)" : LINE }}
                    strokeWidth={isHop ? 3.5 : on ? 2 : 1.5}
                    strokeDasharray={isHop ? "2 8" : r.verified ? undefined : "6 5"}
                    strokeLinecap="round"
                    className={`pointer-events-none ${isHop ? "trail-dash" : ""}`}
                    markerEnd={`url(#${isHop ? "dg-arrow-trail" : on ? "dg-arrow-on" : "dg-arrow"})`}
                  />
                  {/* A wider invisible stroke, so a link is easy to hover and click. */}
                  {onEdge && (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={-1}
                      aria-label={`Link: ${r.label || "imports"}`}
                      onMouseEnter={() => setHover(r.from)}
                      onMouseLeave={() => setHover((h) => (h === r.from ? null : h))}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdge(r);
                      }}
                    />
                  )}
                  {isHop && !still && (
                    <circle r={6} fill={TRAIL} style={{ stroke: "var(--color-outline)" }} strokeWidth={2} className="pointer-events-none">
                      <animateMotion dur="1.4s" repeatCount="indefinite" keyPoints={reverse ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear">
                        <mpath href={`#dg-${r.key}`} />
                      </animateMotion>
                    </circle>
                  )}
                </g>
              );
            })}

            {/* A hop the map has no arrow for: a straight trail, for this step only. */}
            {hop.length > 0 && !hopRoute && layout.boxes.get(previous!) && layout.boxes.get(active!) && (() => {
              const a = layout.boxes.get(previous!)!, b = layout.boxes.get(active!)!;
              return <path d={`M${a.x + a.w / 2},${a.y + a.h / 2} L${b.x + b.w / 2},${b.y + b.h / 2}`} fill="none" stroke={TRAIL} strokeWidth={3.5} strokeDasharray="2 8" strokeLinecap="round" className="trail-dash pointer-events-none" />;
            })()}

            {/* Relationship labels for the box in focus, on top of everything, nudged apart when they'd overlap. */}
            {(() => {
              const placed: { x: number; y: number; w: number }[] = [];
              return layout.routes
                .filter((r) => (routeOn(r) || r === hopRoute) && r.label)
                .map((r) => {
                  const m = midpoint(r.points);
                  const label = r.label.length > 34 ? `${r.label.slice(0, 33)}…` : r.label;
                  const w = label.length * 6.2 + 16;
                  let y = m.y;
                  while (placed.some((q) => Math.abs(q.x - m.x) < (q.w + w) / 2 && Math.abs(q.y - y) < 20)) y += 21;
                  placed.push({ x: m.x, y, w });
                  return (
                    <g key={`l:${r.key}`} transform={`translate(${m.x},${y})`} className="pointer-events-none">
                      <rect x={-w / 2} y={-9} width={w} height={18} rx={9} style={{ fill: "var(--color-ink)", stroke: r === hopRoute ? TRAIL : "var(--color-line)" }} strokeWidth={1.2} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} style={{ fill: r === hopRoute ? TRAIL : "var(--color-fg-2)" }} className="font-mono">
                        {label}
                      </text>
                    </g>
                  );
                });
            })()}
          </g>
        )}
      </svg>
      {!layout && <p className="absolute inset-0 grid place-items-center font-mono text-[11px] text-fg-3">Laying out the diagram…</p>}
      <div className={`absolute flex flex-col gap-1.5 ${compact ? "right-2 bottom-2" : "right-3 bottom-3"}`}>
        {[
          { label: "Zoom in", icon: Plus, run: () => zoomBy(1.3) },
          { label: "Zoom out", icon: Minus, run: () => zoomBy(1 / 1.3) },
          { label: "Fit to screen", icon: Maximize2, run: () => fit(true) },
        ].map(({ label, icon: Icon, run }) => (
          <button key={label} onClick={run} aria-label={label} title={label} className={`toon-sm toon-press grid place-items-center rounded-[10px] bg-panel text-fg-2 hover:text-fg ${compact ? "size-7" : "size-9"}`}>
            <Icon className={compact ? "size-3.5" : "size-4"} />
          </button>
        ))}
      </div>
    </div>
  );
}
