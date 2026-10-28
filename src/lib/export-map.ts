// Map exports: the module map as a Mermaid flowchart, a tour as a Mermaid sequence diagram, and the graph on screen
// as a standalone SVG file.
import type { Atlas, Tour } from "./schemas";

const safeId = (id: string) => `m_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
const safeLabel = (s: string) => s.replace(/"/g, "#quot;").replace(/[[\]{}()<>|]/g, " ").trim();

/** Solid arrows are links confirmed by imports; dotted ones were inferred by the model. */
export function atlasToMermaid(atlas: Atlas): string {
  const lines = ["flowchart LR"];
  for (const n of atlas.nodes) lines.push(`  ${safeId(n.id)}["${safeLabel(n.label)}"]`);
  for (const e of atlas.edges) lines.push(`  ${safeId(e.from)} ${e.verified ? "-->" : "-.->"}|"${safeLabel(e.label)}"| ${safeId(e.to)}`);
  return lines.join("\n");
}

const seqText = (s: string) => s.replace(/[;#<>\n\r]/g, " ").replace(/\s+/g, " ").trim();

/** A tour as who-hands-to-whom: modules are participants, each step a message from the previous step's module. */
export function tourToSequence(tour: Pick<Tour, "steps">, atlas: Pick<Atlas, "nodes">): string {
  const label = new Map(atlas.nodes.map((n) => [n.id, n.label]));
  const lines = ["sequenceDiagram", "  autonumber"];
  for (const id of new Set(tour.steps.map((s) => s.node))) lines.push(`  participant ${safeId(id)} as ${seqText(label.get(id) ?? id)}`);
  tour.steps.forEach((s, i) => {
    const from = i === 0 ? s.node : tour.steps[i - 1].node;
    lines.push(`  ${safeId(from)}->>${safeId(s.node)}: ${seqText(s.title)} (${s.file}:L${s.startLine})`);
  });
  return lines.join("\n");
}

/** Serializes an on-screen SVG with the theme's CSS variables resolved, so it renders anywhere. */
export function svgFile(svg: SVGSVGElement): string {
  const css = getComputedStyle(document.documentElement);
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(width)));
  clone.setAttribute("height", String(Math.round(height)));
  clone.setAttribute("viewBox", `0 0 ${Math.round(width)} ${Math.round(height)}`);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", css.getPropertyValue("--color-ink").trim() || "#08090b");
  clone.insertBefore(bg, clone.firstChild);
  return clone.outerHTML.replace(/var\(--([\w-]+)\)/g, (_, name: string) => css.getPropertyValue(`--${name}`).trim() || "#888");
}
