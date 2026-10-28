"use client";

// A modal dialog: focus moves in on open and back on close, Escape closes, the page behind can't be tabbed to.
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** For any modal panel: focus moves in on open and back on close, Escape closes, Tab stays inside. */
export function useModal(panel: React.RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>("button, a[href], input, textarea, [tabindex]:not([tabindex='-1'])");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus();
    };
  }, [panel, onClose, active]);
}

export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useModal(panel, onClose);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button aria-label="Close" tabIndex={-1} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-card border border-line bg-night outline-none ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[18px] font-medium tracking-tight [font-stretch:85%]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-fg-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["← →", "Previous / next step"],
  ["Space", "Play or pause the tour"],
  ["/", "Browse and search files"],
  ["Tab, then Enter", "Move through the map's nodes and open one"],
  ["T", "Read the tour as text"],
  ["?", "Show these shortcuts"],
  ["Esc", "Close a panel or dialog"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <dl className="divide-y divide-line">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[14px]">
            <dt>
              <kbd className="rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-[12px] text-fg">{k}</kbd>
            </dt>
            <dd className="text-right text-fg-2">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-line pt-3 text-[13px] leading-relaxed text-fg-3">
        About cost: every question sends the whole repo first, so it can be billed as cached input (about 2% of the price). The cache is best-effort: the first few calls on a repo
        often miss it. Anything already asked opens free, and the Ask box shows matches before you pay.
      </p>
    </Dialog>
  );
}
