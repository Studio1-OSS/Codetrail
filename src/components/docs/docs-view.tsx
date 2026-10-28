"use client";

// Written docs, wiki-style: one page per module, with checked key files and code references that open in the
// code panel, and the whole set downloadable as Markdown.
import { Check, CornerUpRight, Download, X } from "lucide-react";
import { Rich } from "@/components/rich";
import { docsToMarkdown, type Docs } from "@/lib/docs-schema";
import { KIND_COLOR, SUPPORT } from "@/lib/palette";
import type { Atlas, RepoSummary } from "@/lib/schemas";

type Props = {
  docs: Docs;
  atlas: Atlas;
  summary: RepoSummary;
  page: string;
  onPage: (node: string) => void;
  onOpen: (file: string, start?: number, end?: number) => void;
  onClose: () => void;
};

function download(docs: Docs, summary: RepoSummary) {
  const blob = new Blob([docsToMarkdown(docs, summary)], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${summary.repo}-docs.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DocsView({ docs, atlas, summary, page, onPage, onOpen, onClose }: Props) {
  const p = docs.pages.find((x) => x.node === page) ?? docs.pages[0];
  const kind = (id: string) => atlas.nodes.find((n) => n.id === id)?.kind ?? "";
  if (!p) return null;
  return (
    <article aria-labelledby="doc-title">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">Docs · {docs.pages.length} pages</p>
        <span className="flex items-center gap-1">
          <button onClick={() => download(docs, summary)} className="inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2 py-1 font-mono text-[10.5px] text-fg-2 hover:border-outline hover:text-fg">
            <Download className="size-3" /> Markdown
          </button>
          <button onClick={onClose} aria-label="Close the docs" className="rounded p-1 text-fg-3 hover:text-fg">
            <X className="size-3.5" />
          </button>
        </span>
      </div>
      <nav aria-label="Doc pages" className="mt-2 flex flex-wrap gap-1.5">
        {docs.pages.map((x) => (
          <button
            key={x.node}
            onClick={() => onPage(x.node)}
            aria-current={x.node === p.node ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${x.node === p.node ? "border-trail/60 bg-trail-soft text-fg" : "border-line text-fg-2 hover:border-outline"}`}
          >
            <span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[kind(x.node)] ?? SUPPORT }} />
            {x.title}
          </button>
        ))}
      </nav>

      <h2 id="doc-title" className="mt-4 font-display text-[24px] leading-[1.08] font-medium tracking-[-0.03em] [font-stretch:82%]">
        {p.title}
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">
        <Rich text={p.overview} />
      </p>
      {p.sections.map((s) => (
        <section key={s.heading} className="mt-4">
          <h3 className="font-medium text-fg">{s.heading}</h3>
          <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-line text-fg-2">
            <Rich text={s.body} />
          </p>
        </section>
      ))}
      {p.keyFiles.length > 0 && (
        <section className="mt-5">
          <h3 className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">Key files</h3>
          <ul className="mt-1.5 divide-y divide-line rounded-[12px] border border-line">
            {p.keyFiles.map((f) => (
              <li key={f.path} className="px-3 py-2">
                <button onClick={() => f.ok && onOpen(f.path)} disabled={!f.ok} className="block w-full text-left disabled:cursor-default">
                  <span className={`font-mono text-[12.5px] ${f.ok ? "text-fg hover:text-trail" : "text-fg-3 line-through"}`}>{f.path}</span>
                  <span className="block text-[12.5px] text-fg-2">{f.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.refs.length > 0 && (
        <section className="mt-5">
          <h3 className="font-mono text-[10.5px] tracking-[0.15em] text-fg-3 uppercase">Where to look</h3>
          <ul className="mt-1.5 space-y-2">
            {p.refs.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => r.ok && onOpen(r.file, r.startLine, r.endLine)}
                  disabled={!r.ok}
                  className={`block w-full rounded-[12px] border border-line px-3 py-2 text-left ${r.ok ? "hover:border-trail/60" : "opacity-50"}`}
                >
                  <span className="flex items-center justify-between gap-2 font-mono text-[11.5px]">
                    <span className="truncate text-fg-2">
                      {r.file} <span className="text-trail">L{r.startLine}–{r.endLine}</span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 tracking-[0.08em] uppercase ${!r.ok ? "text-fg-3" : r.corrected ? "text-warn" : "text-ok"}`}>
                      {!r.ok ? "couldn't verify" : r.corrected ? <><CornerUpRight className="size-3" /> range corrected</> : <><Check className="size-3" /> lines checked</>}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-fg-2">
                    <Rich text={r.note} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
