"use client";

// The Calls view: one file's functions, who calls them and what they call, from the code itself. Pick a file
// (the current step's file to start); click a function to open it in the code panel.
import { useEffect, useMemo, useState } from "react";
import { callsSpec, type CodeSpot } from "@/lib/diagram";
import { PALETTE, SUPPORT } from "@/lib/palette";
import type { RepoSummary } from "@/lib/schemas";
import type { Calls } from "@/server/repo/calls";
import { DiagramView } from "./diagram-view";

const CODE = /\.(m?[jt]sx?|c[jt]s|py|go)$/;

type Props = { summary: RepoSummary; file: string | null; onFile: (path: string) => void; onOpen: (spot: CodeSpot) => void };

export function CallsView({ summary, file, onFile, onOpen }: Props) {
  const [calls, setCalls] = useState<Calls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const choices = useMemo(() => summary.fileSizes.map(([p]) => p).filter((p) => CODE.test(p)), [summary]);

  useEffect(() => {
    if (!file) return;
    let live = true;
    setCalls(null);
    setError(null);
    fetch(`/api/calls?${new URLSearchParams({ owner: summary.owner, repo: summary.repo, sha: summary.sha, ...(summary.scope ? { scope: summary.scope } : {}), path: file })}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`couldn't read this file (${r.status})`))))
      .then((d: { calls: Calls }) => live && setCalls(d.calls))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [file, summary]);

  const built = useMemo(() => (calls ? callsSpec(calls, { here: PALETTE[0], other: SUPPORT }) : null), [calls]);
  const matches = query.trim().length >= 2 ? choices.filter((p) => p.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];

  return (
    <div className="absolute inset-0 flex flex-col pt-14">
      <div className="relative z-10 mx-3 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (matches[0]) {
              onFile(matches[0]);
              setQuery("");
            }
          }}
          className="relative"
        >
          <label htmlFor="calls-file" className="sr-only">
            File to show the calls of
          </label>
          <input
            id="calls-file"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={file ? `${file} · type to pick another file` : "Type a file name (JS, TS, Python or Go)"}
            className="w-[min(420px,80vw)] rounded-[9px] border border-line bg-panel/95 px-2.5 py-1.5 font-mono text-[11.5px] text-fg outline-none placeholder:text-fg-3 focus:border-trail/60"
          />
          {matches.length > 0 && (
            <ul className="absolute top-full left-0 mt-1 w-full rounded-[9px] border border-line bg-panel p-1 shadow-lg">
              {matches.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => {
                      onFile(p);
                      setQuery("");
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left font-mono text-[11.5px] text-fg-2 hover:bg-raised hover:text-fg"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
        {calls && built && (
          <span className="rounded-[8px] bg-ink/75 px-2 py-1 font-mono text-[10.5px] text-fg-3 backdrop-blur">
            {calls.functions.length} functions · {calls.calls.length - built.unplaced} calls placed · {calls.callers.length} callers
            {built.unplaced ? ` · ${built.unplaced} calls to libraries or not found` : ""}
            {built.moreCallers ? ` · ${built.moreCallers} more callers not drawn` : ""}
          </span>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {!file ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-3">Pick a file to see its functions, what they call, and who calls them.</p>
        ) : error ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-danger">{error}</p>
        ) : calls && !calls.language ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-3">Function calls are worked out for JavaScript, TypeScript, Python and Go. Pick one of those files.</p>
        ) : calls && built && built.spec.boxes.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-fg-3">No functions found in this file.</p>
        ) : built ? (
          <DiagramView
            key={file}
            spec={built.spec}
            ariaLabel={`Calls in ${file}: callers on the left, its functions in the middle, what they call on the right. Enter opens a function in the code.`}
            onSelect={(id) => {
              const spot = id ? built.spots.get(id) : undefined;
              if (spot) onOpen(spot);
              else if (id?.startsWith("file:") && id.slice(5) !== file) onFile(id.slice(5));
            }}
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center font-mono text-[11px] text-fg-3">Reading the calls…</p>
        )}
      </div>
    </div>
  );
}
