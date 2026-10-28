"use client";

import { Renderer } from "@openuidev/react-lang";
import { Sparkles } from "lucide-react";
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
}: {
  question: string;
  text: string;
  streaming: boolean;
  answer: StoredAnswer | null;
  fromCache: boolean;
  onOpen: (file: string, start?: number, end?: number) => void;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 font-mono text-[11.5px] text-fg-3">
        <Sparkles className="size-3.5 text-trail" />
        <span className="truncate">{question}</span>
      </p>
      <div className="mt-2.5">
        <AnswerContext.Provider value={{ checks: answer?.checks ?? null, onOpen }}>
          {text ? <Renderer response={text} library={answerLibrary} isStreaming={streaming} /> : <p className="text-sm text-fg-3">DeepSeek is reading the question…</p>}
        </AnswerContext.Provider>
      </div>
      {!streaming && answer && (
        <div className="mt-3 border-t border-line pt-2.5">
          {fromCache ? (
            <span className="font-mono text-[11px] text-fg-3">Replayed from storage · $0 · answered earlier for everyone</span>
          ) : (
            answer.calls[0] && <CallLine call={answer.calls[0]} />
          )}
          <p className="mt-1 font-mono text-[10.5px] text-fg-3">Generative UI: DeepSeek chose these blocks; every file and line range was checked against the code.</p>
        </div>
      )}
    </div>
  );
}
