"use client";

// Writing a tour by hand, or editing a copy of one: a title, then steps that each point at lines of a file, with
// your own words. Open any file (press /) or step, and "Add the lines on screen" turns what the code panel shows
// into a step. Saved free, checked against the code like any other tour.
import { ArrowDown, ArrowUp, Eye, Plus, Trash2, X } from "lucide-react";

export type DraftStep = { file: string; startLine: number; endLine: number; title: string; narration: string };
export type Draft = { title: string; summary: string; steps: DraftStep[]; basedOn?: string };

type Props = {
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** What the code panel shows now, to add as a step. */
  onScreen: { file: string; start: number; end: number } | null;
  onShow: (step: DraftStep) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
};

const field = "w-full rounded-[9px] border border-line bg-ink px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-trail/60";

export function TourEditor({ draft, onChange, onScreen, onShow, onSave, onCancel, saving, error }: Props) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setStep = (i: number, patch: Partial<DraftStep>) => set({ steps: draft.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const move = (i: number, by: number) => {
    const steps = [...draft.steps];
    const [s] = steps.splice(i, 1);
    steps.splice(i + by, 0, s);
    set({ steps });
  };
  const ready = draft.title.trim().length >= 3 && draft.steps.length > 0 && draft.steps.every((s) => s.title.trim());
  return (
    <form
      aria-label="Write a tour"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !saving) onSave();
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.14em] text-trail uppercase">{draft.basedOn ? "Editing a copy of a tour" : "Writing a tour"}</p>
        <button type="button" onClick={onCancel} aria-label="Stop editing without saving" className="rounded p-1 text-fg-3 hover:text-fg">
          <X className="size-3.5" />
        </button>
      </div>
      <label className="block">
        <span className="font-mono text-[10.5px] text-fg-3">Title</span>
        <input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="e.g. How a request reaches its handler" className={`${field} mt-1 font-display text-[16px]`} />
      </label>
      <label className="block">
        <span className="font-mono text-[10.5px] text-fg-3">In short (optional)</span>
        <textarea value={draft.summary} onChange={(e) => set({ summary: e.target.value })} rows={2} maxLength={600} className={`${field} mt-1 resize-none`} />
      </label>

      <ol className="space-y-2.5">
        {draft.steps.map((s, i) => (
          <li key={i} className="rounded-[12px] border border-line bg-panel p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-trail">{String(i + 1).padStart(2, "0")}</span>
              <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} maxLength={120} placeholder="Step title" aria-label={`Step ${i + 1} title`} className={`${field} py-1`} />
              <button type="button" onClick={() => onShow(s)} title="Show these lines" aria-label={`Show step ${i + 1}'s lines`} className="rounded p-1 text-fg-3 hover:text-fg">
                <Eye className="size-3.5" />
              </button>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`} className="rounded p-1 text-fg-3 hover:text-fg disabled:opacity-30">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`} className="rounded p-1 text-fg-3 hover:text-fg disabled:opacity-30">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => set({ steps: draft.steps.filter((_, k) => k !== i) })} aria-label={`Delete step ${i + 1}`} className="rounded p-1 text-fg-3 hover:text-danger">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-fg-3">
              <span className="min-w-0 truncate" title={s.file}>
                {s.file}
              </span>
              <span>lines</span>
              <input type="number" min={1} value={s.startLine} onChange={(e) => setStep(i, { startLine: Math.max(1, Number(e.target.value) || 1) })} aria-label={`Step ${i + 1} first line`} className={`${field} w-16 px-1.5 py-0.5 font-mono text-[11px]`} />
              <span>–</span>
              <input type="number" min={1} value={s.endLine} onChange={(e) => setStep(i, { endLine: Math.max(1, Number(e.target.value) || 1) })} aria-label={`Step ${i + 1} last line`} className={`${field} w-16 px-1.5 py-0.5 font-mono text-[11px]`} />
            </div>
            <textarea value={s.narration} onChange={(e) => setStep(i, { narration: e.target.value })} rows={2} maxLength={1200} placeholder="What happens here, and what it hands to the next step" aria-label={`Step ${i + 1} explanation`} className={`${field} mt-1.5 resize-y`} />
          </li>
        ))}
      </ol>

      <button
        type="button"
        disabled={!onScreen}
        onClick={() => onScreen && set({ steps: [...draft.steps, { file: onScreen.file, startLine: onScreen.start, endLine: onScreen.end, title: "", narration: "" }] })}
        className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line px-3 py-2 text-[13px] text-fg-2 hover:border-trail/60 hover:text-fg disabled:opacity-50"
      >
        <Plus className="size-3.5" /> {onScreen ? `Add the lines on screen as a step (${onScreen.file.split("/").pop()}:${onScreen.start}–${onScreen.end})` : "Open a file (press /) to add its lines as a step"}
      </button>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-[10px] px-3 py-2 text-[13px] text-fg-2 hover:text-fg">
          Cancel
        </button>
        <button type="submit" disabled={!ready || saving} className="rounded-[10px] bg-trail px-3.5 py-2 text-[13px] font-semibold text-[#16171a] disabled:opacity-50">
          {saving ? "Saving…" : "Save the tour · free"}
        </button>
      </div>
      <p className="text-[11.5px] text-fg-3">Each step is checked against the code when you save: the file must be in this commit and the lines must exist.</p>
    </form>
  );
}
