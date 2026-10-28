"use client";

import { ExternalLink, FileCode2, GitCompareArrows } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { lineRanges, patchLines } from "@/lib/diff";
import { blobUrl, LOCAL_OWNER } from "@/lib/ref";

const LANG: Record<string, string> = {
  ts: "typescript", mts: "typescript", cts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  py: "python", pyi: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin", scala: "scala", rb: "ruby", php: "php",
  cs: "csharp", c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", swift: "swift", m: "objective-c", mm: "objective-cpp",
  md: "markdown", mdx: "mdx", json: "json", jsonc: "jsonc", yml: "yaml", yaml: "yaml", toml: "toml", xml: "xml", html: "html", htm: "html",
  css: "css", scss: "scss", sass: "sass", less: "less", vue: "vue", svelte: "svelte", astro: "astro", sh: "bash", bash: "bash", zsh: "bash",
  sql: "sql", graphql: "graphql", gql: "graphql", lua: "lua", dart: "dart", ex: "elixir", exs: "elixir", erl: "erlang", zig: "zig",
  prisma: "prisma", proto: "proto", tf: "hcl", hcl: "hcl", nix: "nix", r: "r", jl: "julia", hs: "haskell", ml: "ocaml", clj: "clojure", sol: "solidity",
};

function langOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  if (/^Dockerfile/i.test(name)) return "docker";
  if (/^Makefile$/i.test(name)) return "make";
  return LANG[name.split(".").pop()?.toLowerCase() ?? ""] ?? "text";
}

const rawUrl = (owner: string, repo: string, sha: string, path: string) =>
  owner === LOCAL_OWNER ? null : `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;

// Highlighted files, kept across steps (most tours stay in a handful of files).
const htmlCache = new Map<string, Promise<string>>();

async function shiki(text: string, lang: string): Promise<string> {
  const { codeToHtml } = await import("shiki");
  try {
    return await codeToHtml(text, { lang, theme: "github-dark-default" });
  } catch {
    return codeToHtml(text, { lang: "text", theme: "github-dark-default" });
  }
}

async function highlight(url: string, fallback: string | null, path: string): Promise<string> {
  // Codetrail's stored copy of the commit first (no GitHub limits), then GitHub's raw file.
  let res = await fetch(url).catch(() => null);
  if (!res?.ok && fallback) res = await fetch(fallback).catch(() => null);
  if (!res?.ok) throw new Error(`couldn't load the file (${res?.status ?? "offline"})`);
  return shiki(await res.text(), langOf(path));
}

type Props = {
  owner: string;
  repo: string;
  sha: string;
  path: string;
  start?: number;
  end?: number;
  /** In a pull-request tour: this file's patch, so the lines it changed are marked (and the diff can be shown). */
  patch?: string;
};

export function CodePanel({ owner, repo, sha, path, start, end, patch }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const changes = useMemo(() => (patch ? patchLines(patch) : null), [patch]);
  const diffView = showDiff && !!patch;
  const github = blobUrl(owner, repo, sha, path, start, end);
  // A stable object: React rewrites the HTML whenever this prop changes, which would wipe the line marks below.
  const inner = useMemo(() => (html ? { __html: html } : null), [html]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const url = `/api/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&sha=${sha}&path=${encodeURIComponent(path)}`;
    const key = diffView ? `diff:${sha}:${path}` : url;
    let p = htmlCache.get(key);
    if (!p) {
      p = diffView ? shiki(patch!, "diff") : highlight(url, rawUrl(owner, repo, sha, path), path);
      p.catch(() => htmlCache.delete(key));
      htmlCache.set(key, p);
    }
    setHtml(null);
    p.then((h) => !cancelled && setHtml(h)).catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [owner, repo, sha, path, diffView, patch]);

  // Mark the step's lines and bring them into view.
  useEffect(() => {
    const root = box.current;
    if (!root || !html) return;
    const lines = root.querySelectorAll<HTMLElement>(".line");
    if (diffView) {
      // The unified patch: +/- lines carry their own marker character, colour only adds to it.
      lines.forEach((el) => {
        const c = el.textContent?.[0];
        el.classList.toggle("add", c === "+");
        el.classList.toggle("del", c === "-");
        el.classList.toggle("hunk", c === "@");
      });
      setBar(null);
      root.scrollTo({ top: 0 });
      return;
    }
    lines.forEach((el, i) => {
      const n = i + 1;
      const inRange = start !== undefined && end !== undefined && n >= start && n <= end;
      el.classList.toggle("hl", inRange);
      el.classList.toggle("dim", start !== undefined && !inRange);
      el.classList.toggle("add", !!changes?.added.has(n));
      // Removed lines show as a red rule between the lines they sat between.
      el.classList.toggle("del-above", !!changes?.removedAfter.has(n - 1));
    });
    // Where the range sits in the whole file, for the position bar.
    setBar(start && end && lines.length ? { top: ((start - 1) / lines.length) * 100, height: Math.max(2, ((end - start + 1) / lines.length) * 100) } : null);
    const first = start ? lines[start - 1] : undefined;
    if (first) {
      const top = first.offsetTop - root.clientHeight * 0.22;
      root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    } else {
      root.scrollTo({ top: 0 });
    }
  }, [html, start, end, changes, diffView]);

  return (
    <div className="code-surface flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-line bg-code">
      <div className="flex items-center justify-between gap-2 border-b border-[#1d2026] px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[11.5px]">
          <FileCode2 className="size-3.5 shrink-0 text-[#7a7d86]" />
          <span className="truncate text-[#a9abb2]" title={path}>
            {path}
          </span>
          {start && !diffView && (
            <span className="shrink-0 text-trail">
              L{start}
              {end && end !== start ? `–${end}` : ""}
            </span>
          )}
        </div>
        {changes && (
          <button
            onClick={() => setShowDiff((d) => !d)}
            aria-pressed={showDiff}
            title={showDiff ? "Show the file as the PR leaves it" : "Show this file's diff"}
            className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[11px] ${showDiff ? "text-[#eeece6]" : "text-[#7a7d86] hover:text-[#eeece6]"}`}
          >
            <GitCompareArrows className="size-3" /> {showDiff ? "file" : "diff"}
          </button>
        )}
        {github && (
          <a
            href={github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[11px] text-[#7a7d86] hover:text-[#eeece6]"
          >
            GitHub <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      {changes && (
        <p className="sr-only">
          Changed in this pull request: {changes.added.size ? `lines ${lineRanges(changes.added)} added` : "no lines added"}
          {changes.removed ? `, ${changes.removed} lines removed` : ""}.
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <div ref={box} className={`code-view relative min-h-0 flex-1 overflow-auto ${diffView ? "diff" : ""}`}>
          {error ? (
            <p className="p-4 text-sm text-danger">Couldn&apos;t load this file ({error}).</p>
          ) : inner ? (
            <div dangerouslySetInnerHTML={inner} />
          ) : (
            <div className="space-y-2 p-4">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-[#171a1f]" style={{ width: `${30 + ((i * 37) % 60)}%` }} />
              ))}
            </div>
          )}
        </div>
        <div aria-hidden className="relative my-2.5 mr-2 w-1 shrink-0 rounded-full bg-[#1d2026]">
          {bar && <div className="absolute right-0 left-0 rounded-full bg-trail transition-all duration-300" style={{ top: `${bar.top}%`, height: `${bar.height}%` }} />}
        </div>
      </div>
    </div>
  );
}
