import { describe, expect, it } from "vitest";
import { docsToMarkdown, type Docs } from "./docs-schema";
import { atlasToMermaid } from "./export-map";
import type { Atlas } from "./schemas";

const atlas = {
  summary: "s",
  stack: [],
  nodes: [
    { id: "core", label: 'Server "core"', kind: "core", purpose: "p", files: ["a.ts"] },
    { id: "url-parser", label: "URL [parser]", kind: "core", purpose: "p", files: ["b.ts"] },
  ],
  edges: [
    { from: "core", to: "url-parser", label: "calls", verified: true },
    { from: "url-parser", to: "core", label: "reads config", verified: false },
  ],
  tours: [],
  call: {} as Atlas["call"],
} as Atlas;

describe("atlasToMermaid", () => {
  it("writes a flowchart with safe ids and labels, dotted for inferred links", () => {
    const m = atlasToMermaid(atlas);
    expect(m.split("\n")[0]).toBe("flowchart LR");
    expect(m).toContain('m_core["Server #quot;core#quot;"]');
    expect(m).toContain('m_url_parser["URL  parser"]');
    expect(m).toContain('m_core -->|"calls"| m_url_parser');
    expect(m).toContain('m_url_parser -.->|"reads config"| m_core');
  });
});

describe("docsToMarkdown", () => {
  it("links only checked files and references, at the exact commit", () => {
    const docs: Docs = {
      at: 0,
      calls: [],
      pages: [
        {
          node: "core",
          title: "Core",
          overview: "The server.",
          sections: [{ heading: "How it works", body: "It listens." }],
          keyFiles: [
            { path: "src/a.ts", role: "entry", ok: true },
            { path: "src/gone.ts", role: "missing", ok: false },
          ],
          refs: [{ file: "src/a.ts", startLine: 3, endLine: 9, anchor: "x", note: "Starts it.", ok: true, corrected: false }],
        },
      ],
    };
    const md = docsToMarkdown(docs, { owner: "o", repo: "r", sha: "abcdef1234567890" });
    expect(md).toContain("## Core");
    expect(md).toContain("### How it works");
    expect(md).toContain("[`src/a.ts`](https://github.com/o/r/blob/abcdef1234567890/src/a.ts)");
    expect(md).toContain("[`src/a.ts:3-9`](https://github.com/o/r/blob/abcdef1234567890/src/a.ts#L3-L9)");
    expect(md).not.toContain("gone.ts");
  });
});
