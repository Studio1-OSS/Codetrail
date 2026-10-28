"use client";

import { Renderer } from "@openuidev/react-lang";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { useState } from "react";
import { answerFiles, answerToMarkdown } from "@/lib/answer-md";
import type { StoredAnswer } from "@/lib/answer-schema";
import { CallLine } from "@/components/trail/cost";
import { AnswerContext, answerLibrary } from "./library";

/** A generative-UI answer: rendered live while it streams, then with every code reference checked. */
export function AnswerView({
  question,
  text,
  streaming,
  answer,
  fromCache,
  onOpen,
  at,
}: {
  question: string;
  text: string;
  streaming: boolean;
  answer: StoredAnswer | null;
  fromCache: boolean;
  onOpen: (file: string, start?: number, end?: number) => void;
  /** The commit, for links in the Markdown export. */
  at: { owner: string; repo: string; sha: string };
}) {
  const [copied, setCopied] = useState(false);
  /** The answer as Markdown, with the lines of every checked code reference. */
  async function markdown() {
    if (!answer) return "";
    const files = await Promise.all(
      answerFiles(answer).map(async (path) => {
        const r = await fetch(`/api/file?owner=${encodeURIComponent(at.owner)}&repo=${encodeURIComponent(at.repo)}&sha=${at.sha}&path=${encodeURIComponent(path)}`).catch(() => null);
        return [path, r?.ok ? (await r.text()).split("\n") : []] as const;
      }),
    );
    return answerToMarkdown(answer, at, Object.fromEntries(files));
  }
  return (
    <div>
      <p className="flex items-center gap-2 font-mono text-[11.5px] text-fg-3">
        <Sparkles className="size-3.5 text-trail" />
        <span className="truncate" title={question}>
          {question}
        </span>
      </p>
      <div className="mt-2.5">
        <AnswerContext.Provider value={{ checks: answer?.checks ?? null, onOpen }}>
          {text ? <Renderer response={text} library={answerLibrary} isStreaming={streaming} /> : <p className="text-sm text-fg-3">DeepSeek is reading the question…</p>}
        </AnswerContext.Provider>
      </div>
      {!streaming && answer && (
        <div className="mt-3 border-t border-line pt-2.5">
          {fromCache ? (
            <span className="font-mono text-[11px] text-fg-3">Saved earlier · free to replay</span>
          ) : (
            answer.calls[0] && <CallLine call={answer.calls[0]} />
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={async () => {
                await navigator.clipboard?.writeText(await markdown());
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2 py-1 font-mono text-[10.5px] text-fg-3 hover:border-outline hover:text-fg"
            >
              {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy as Markdown"}
            </button>
            <button
              onClick={async () => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([await markdown()], { type: "text/markdown" }));
                a.download = `${at.repo}-${answer.id}.md`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-line px-2 py-1 font-mono text-[10.5px] text-fg-3 hover:border-outline hover:text-fg"
            >
              <Download className="size-3" /> Download .md
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
