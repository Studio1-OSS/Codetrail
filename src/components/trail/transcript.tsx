"use client";

// The whole tour as text: every step with its file, lines, narration and the code itself. Reads well with a
// screen reader, and copies as Markdown with links to the exact commit.
import { useEffect, useState } from "react";
import { Rich } from "@/components/rich";
import type { RepoSummary, Tour } from "@/lib/schemas";
import { blobUrl, mdLink as link } from "@/lib/ref";
import { Dialog } from "./dialog";

function tourToMarkdown(tour: Tour, s: RepoSummary) {
  return [
    `# ${tour.title}`,
    "",
    `> ${tour.question}`,
    "",
    tour.summary,
    "",
    ...tour.steps.flatMap((st, i) => [`## ${i + 1}. ${st.title}`, "", link(`\`${st.file}:${st.startLine}-${st.endLine}\``, blobUrl(s.owner, s.repo, s.sha, st.file, st.startLine, st.endLine)), "", st.narration, ""]),
    `Traced by Codetrail with DeepSeek V4.1 Flash 1017 at commit ${s.sha.slice(0, 7)}; every line range was checked against the code.`,
  ].join("\n");
}

export function TranscriptDialog({ tour, summary, onClose }: { tour: Tour; summary: RepoSummary; onClose: () => void }) {
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    for (const path of new Set(tour.steps.map((s) => s.file))) {
      fetch(`/api/file?owner=${encodeURIComponent(summary.owner)}&repo=${encodeURIComponent(summary.repo)}&sha=${summary.sha}&path=${encodeURIComponent(path)}`)
        .then((r) => (r.ok ? r.text() : ""))
        .then((t) => setFiles((f) => ({ ...f, [path]: t.split("\n") })))
        .catch(() => {});
    }
  }, [tour, summary]);
  return (
    <Dialog title="The tour as text" onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[20px] font-medium tracking-tight [font-stretch:85%]">
            <Rich text={tour.title} />
          </p>
          <p className="mt-1 text-[14px] text-fg-2">
            <Rich text={tour.summary} />
          </p>
        </div>
        <button
          onClick={() =>
            navigator.clipboard?.writeText(tourToMarkdown(tour, summary)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="shrink-0 rounded-[8px] border border-line px-2.5 py-1 font-mono text-[11px] text-fg-2 hover:text-fg"
        >
          {copied ? "Copied" : "Copy as Markdown"}
        </button>
      </div>
      <ol className="mt-5 space-y-6">
        {tour.steps.map((s, i) => (
          <li key={i}>
            <h3 className="font-medium text-fg">
              <span className="font-mono text-trail">{String(i + 1).padStart(2, "0")}</span> <Rich text={s.title} />
            </h3>
            <p className="mt-0.5 font-mono text-[12px] text-fg-3">
              {s.file}, lines {s.startLine} to {s.endLine}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">
              <Rich text={s.narration} />
            </p>
            {files[s.file] && (
              <pre className="code-surface mt-2 overflow-x-auto rounded-[10px] bg-code p-3 font-mono text-[12px] leading-5 text-[#cfd0d6]" aria-label={`Code from ${s.file}, lines ${s.startLine} to ${s.endLine}`}>
                {files[s.file]
                  .slice(s.startLine - 1, s.endLine)
                  .map((l, k) => `${String(s.startLine + k).padStart(4)}  ${l}`)
                  .join("\n")}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
