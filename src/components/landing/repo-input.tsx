"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseRepoInput } from "@/lib/ref";

const repoPath = (r: { owner: string; repo: string; ref?: string; pull?: number }) =>
  `/${r.owner}/${r.repo}${r.pull ? `/pull/${r.pull}` : r.ref ? `/tree/${encodeURIComponent(r.ref)}` : ""}`;

/** Takes any GitHub link (repo, branch, file, commit, pull request, .git remote) or owner/repo. */
export function RepoInput({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = parseRepoInput(value);
    if (!ref) {
      setError("That isn't a GitHub repository, branch, file or pull-request link. Try https://github.com/owner/repo.");
      return;
    }
    router.push(repoPath(ref));
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[640px]">
      <label htmlFor="repo-link" className="mb-2 block font-mono text-[11px] tracking-[0.2em] text-fg-3 uppercase">
        Paste any GitHub link
      </label>
      <div className="flex items-stretch overflow-hidden rounded-[14px] border border-outline bg-panel/80 backdrop-blur-md focus-within:border-trail">
        <input
          id="repo-link"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onPaste={(e) => {
            // A pasted link opens the repo right away.
            const text = e.clipboardData.getData("text");
            const ref = parseRepoInput(text);
            if (ref) {
              e.preventDefault();
              setValue(text.trim());
              router.push(repoPath(ref));
            }
          }}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          inputMode="url"
          placeholder="https://github.com/owner/repo"
          className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-[15px] text-fg outline-none placeholder:text-fg-3"
        />
        <button type="submit" className="shrink-0 bg-trail px-5 font-display text-[13px] font-bold tracking-wide text-[#16171a] transition hover:bg-trail-strong sm:px-6 [font-stretch:90%]">
          READ THIS REPO →
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger">{error}</p>
      ) : (
        <p className="mt-2.5 text-[13px] text-fg-3">Repo, branch or file link · or swap github.com for this site in the address bar</p>
      )}
    </form>
  );
}
