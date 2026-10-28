"use client";

// The Ask box, in the sidebar and under an answer as "Ask a follow-up". Before anything is spent it shows what's
// already stored that answers the question (free), picks Answer or Tour from the wording (switchable, plus
// Thorough), and says what this kind of question costs.
import { CornerDownLeft } from "lucide-react";
import { useId, useState } from "react";
import { formatUsd } from "@/lib/format";
import { matchStored, pickMode, type AskMode, type Stored } from "@/lib/match";
import type { RepoSummary } from "@/lib/schemas";

const MODES: { id: AskMode; label: string; hint: string }[] = [
  { id: "answer", label: "Answer", hint: "A short structured answer: tables, file lists, call sequences, checked code references" },
  { id: "tour", label: "Tour", hint: "A step-by-step walk through the code, in the order it runs" },
  { id: "thorough", label: "Thorough", hint: "Slower and more thorough: traces the answer across every file involved" },
];

const KIND_LABEL: Record<Stored["kind"], string> = { tour: "tour", answer: "answer", docs: "docs page", thread: "conversation" };

/** What one question costs: the repo as cached input (or not), the question (and a follow-up's recap), the reply. */
export function costOf(summary: RepoSummary, mode: AskMode, followUp: boolean) {
  const p = summary.price;
  if (!p) return null;
  const fresh = followUp ? 3_000 : 500;
  const out = mode === "thorough" ? 14_000 : 5_000;
  return { cached: summary.tokens * p.cached + fresh * p.input + out * p.output, cold: (summary.tokens + fresh) * p.input + out * p.output };
}

type Props = {
  summary: RepoSummary;
  label: string;
  placeholder: string;
  busy: boolean;
  /** Resolves false when the question failed, so the box gives the text back. */
  onAsk: (question: string, mode: AskMode) => Promise<boolean> | void;
  /** Stored work to offer before asking (the sidebar); follow-ups have none. */
  stored?: Stored[];
  onOpenStored?: (item: Stored) => void;
  followUp?: boolean;
  footer?: React.ReactNode;
};

export function AskBox({ summary, label, placeholder, busy, onAsk, stored, onOpenStored, followUp = false, footer }: Props) {
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<AskMode | null>(null);
  const id = useId();
  const q = question.trim();
  const mode = picked ?? pickMode(q);
  const matches = stored && q.length >= 8 ? matchStored(q, stored) : [];
  const cost = costOf(summary, mode, followUp);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.length < 3 || busy) return;
    const asked = question;
    setQuestion("");
    setPicked(null);
    Promise.resolve(onAsk(q, mode)).then((ok) => ok === false && setQuestion((now) => now || asked));
  }

  return (
    <form onSubmit={submit} className="rounded-[14px] border border-line bg-panel p-3">
      <label htmlFor={`${id}-q`} className="font-display text-[15px] font-medium [font-stretch:85%]">
        {label}
      </label>
      <textarea
        id={`${id}-q`}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) submit(e);
        }}
        rows={2}
        maxLength={300}
        placeholder={placeholder}
        aria-describedby={`${id}-cost`}
        className="mt-2 w-full resize-none rounded-[10px] border border-line bg-ink px-2.5 py-2 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-trail/70"
      />
      {matches.length > 0 && (
        <div className="mb-2 rounded-[10px] border border-ok/30 bg-ok/5 px-2.5 py-2" aria-live="polite">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ok uppercase">Already answered · free</p>
          <ul className="mt-1 space-y-0.5">
            {matches.map((m) => (
              <li key={`${m.kind}:${m.id}`}>
                <button type="button" onClick={() => onOpenStored?.(m)} className="w-full truncate text-left text-[12.5px] text-fg-2 hover:text-fg">
                  {m.title} <span className="font-mono text-[10.5px] text-fg-3">· {KIND_LABEL[m.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Kind of answer" className="flex gap-0.5 rounded-[9px] border border-line p-[2px]">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              title={m.hint}
              onClick={() => setPicked(m.id)}
              className={`rounded-[7px] px-2 py-0.5 font-mono text-[10.5px] tracking-[0.04em] ${mode === m.id ? "bg-fg text-ink" : "text-fg-3 hover:text-fg"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="submit" disabled={q.length < 3 || busy} title={q.length < 3 ? "Type a question first" : undefined} className="inline-flex items-center gap-1 rounded-[8px] bg-trail px-2.5 py-1 text-xs font-semibold text-[#16171a] disabled:opacity-40">
          Ask <CornerDownLeft className="size-3" />
        </button>
      </div>
      {question.length > 240 && <p className="mt-1 font-mono text-[10.5px] text-fg-3">{300 - question.length} characters left</p>}
      <p id={`${id}-cost`} className="mt-1.5 font-mono text-[10.5px] text-fg-3">
        {cost ? `≈ ${formatUsd(cost.cached)} if the repo is cached · up to ${formatUsd(cost.cold)}` : "Priced after the call"}
      </p>
      {footer}
    </form>
  );
}
