// The MCP tools, shared by the local stdio server (`pnpm mcp`) and the hosted endpoint (`/api/mcp`): a coding
// agent can get the module map of a GitHub repo (or, self-hosted, a local folder), a line-checked tour answering "how does X work?", a
// structured answer (with follow-ups in a thread), or a reviewer's tour of a pull request.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { atlasToMermaid } from "@/lib/export-map";
import { formatTokens, formatUsd } from "@/lib/format";
import { blobUrl, parseRepoInput } from "@/lib/ref";
import type { Atlas, CallRecord, Tour } from "@/lib/schemas";
import type { StoredAnswer } from "@/lib/answer-schema";
import { answerFollowUps, answerGist, answerTitle } from "@/lib/thread";
import { getAnswer } from "@/server/trail/ask";
import { getPullTour } from "@/server/trail/pulls";
import { askFollowUp, startThread } from "@/server/trail/threads";
import { getAtlas, getTour, latestReadSha, prepare, type Prepared } from "@/server/trail/service";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const blob = (p: Prepared, path: string, start?: number, end?: number) => blobUrl(p.info.owner, p.info.repo, p.info.sha, path, start, end ?? start) ?? `${path}${start ? `:${start}-${end ?? start}` : ""}`;
const cost = (c: CallRecord, fromCache: boolean) =>
  fromCache
    ? "Served from Codetrail's store: $0."
    : `Cost ${formatUsd(c.cost)} on Nebius Token Factory (${formatTokens(c.usage.input)} input tokens, ${c.usage.input ? Math.round((c.usage.cached / c.usage.input) * 100) : 0}% from cache, ${formatTokens(c.usage.output)} output).`;

async function load(repo: string) {
  const ref = parseRepoInput(repo);
  if (!ref) throw new Error(`"${repo}" isn't a GitHub repository. Use owner/repo, a github.com URL, or _local/<folder> for a folder on a self-hosted Codetrail.`);
  return prepare(ref);
}

function mapMarkdown(p: Prepared, atlas: Atlas, fromCache: boolean) {
  const s = p.summary;
  return [
    `# ${s.owner}/${s.repo} @ ${s.sha.slice(0, 7)} (${s.ref})`,
    "",
    atlas.summary,
    "",
    ...(atlas.stack.length ? [`Stack: ${atlas.stack.join(", ")}`] : []),
    `Read ${s.files.read} of ${s.files.total} files (~${formatTokens(s.tokens)} tokens) in one prompt with ${s.modelLabel}.`,
    "",
    "## Modules",
    ...atlas.nodes.map((n) => `- **${n.label}** (\`${n.id}\`, ${n.layer ? `${n.layer} layer, ` : ""}${n.kind}): ${n.purpose}\n  ${n.files.map((f) => `\`${f}\``).join(", ")}`),
    "",
    "## Connections",
    ...atlas.edges.map((e) => `- ${e.from} → ${e.to}: ${e.label}${e.verified ? " (confirmed by imports)" : " (inferred)"}`),
    "",
    "## Architecture (Mermaid)",
    "```mermaid",
    atlasToMermaid(atlas, s),
    "```",
    "",
    "## Suggested tours (ask codetrail_tour with one of these)",
    ...atlas.tours.map((t) => `- ${t.question}`),
    "",
    cost(atlas.call, fromCache),
  ].join("\n");
}

function pullMarkdown(p: Prepared, tour: Tour, fromCache: boolean) {
  const pr = tour.pull!;
  const at = (file: string, line: number | null) => {
    const changed = pr.files.some((f) => f.path === file && f.status !== "removed");
    return `https://github.com/${p.info.owner}/${p.info.repo}/blob/${changed ? pr.headSha : p.info.sha}/${file}${line ? `#L${line}` : ""}`;
  };
  return [
    `# PR #${pr.number}: ${pr.title}`,
    `${pr.htmlUrl} · by ${pr.author} · ${pr.state} · +${pr.additions} −${pr.deletions} in ${pr.changedFiles} files`,
    "",
    `## ${tour.title}`,
    tour.summary,
    "",
    "## The change, in the order it runs",
    ...tour.steps.flatMap((s, i) => [`${i + 1}. **${s.title}** — \`${s.file}:${s.startLine}-${s.endLine}\``, `   ${s.narration}`, `   ${at(s.file, s.startLine)}-L${s.endLine}`]),
    "",
    "## For the reviewer",
    ...(tour.review?.length
      ? tour.review.map((n) => `- **${n.kind}**: ${n.text}${n.file ? ` (\`${n.file}${n.line ? `:${n.line}` : ""}\`${n.checked ? "" : ", line not verified"})` : ""}`)
      : ["Nothing stood out."]),
    "",
    `Steps were checked against the PR's code (${tour.check.corrected} moved to the quoted line, ${tour.check.dropped} dropped).`,
    tour.calls[0] ? cost(tour.calls[0], fromCache) : "",
  ].join("\n");
}

function answerMarkdown(p: Prepared, a: StoredAnswer, fromCache: boolean, threadId?: string) {
  const refs = Object.values(a.checks.refs);
  const follow = answerFollowUps(a.text);
  return [
    `# ${answerTitle(a.text) ?? a.question}`,
    "",
    `Question: ${a.question}`,
    "",
    answerGist(a.text),
    "",
    "## Code references (checked against the file at this commit)",
    ...(refs.length ? refs.map((r) => (r ? `- \`${r.file}:${r.startLine}-${r.endLine}\`${r.corrected ? " (range corrected)" : ""} ${blob(p, r.file, r.startLine, r.endLine)}` : "- (one reference couldn't be verified and was left out)")) : ["None."]),
    ...(follow.length ? ["", "## Ask next", ...follow.map((q) => `- ${q}`)] : []),
    ...(threadId ? ["", `Thread: ${threadId} (pass it as \`thread\` to ask a follow-up in context).`] : []),
    "",
    a.calls[0] ? cost(a.calls[0], fromCache) : "",
  ].join("\n");
}

function tourMarkdown(p: Prepared, tour: Tour, fromCache: boolean) {
  return [
    `# ${tour.title}`,
    "",
    `Question: ${tour.question}`,
    "",
    tour.summary,
    "",
    ...tour.steps.flatMap((s, i) => [
      `${i + 1}. **${s.title}** — \`${s.file}:${s.startLine}-${s.endLine}\` (${s.node})`,
      `   ${s.narration}`,
      `   ${blob(p, s.file, s.startLine, s.endLine)}`,
    ]),
    "",
    `Every step's line range was checked against the file at this commit (${tour.check.corrected} moved to the quoted line, ${tour.check.dropped} dropped).`,
    tour.calls[0] ? cost(tour.calls[0], fromCache) : "",
  ].join("\n");
}

export function registerCodetrailTools(server: McpServer, caller: string) {

server.registerTool(
  "codetrail_map",
  {
    title: "Map a GitHub repository",
    description:
      "Reads a whole GitHub repo (or _local/<folder> on a self-hosted Codetrail) with DeepSeek V4.1 Flash 1017 (1M-token context) and returns its modules, their key files, how they connect (marked when confirmed by real imports) and suggested tours. Stored per commit, so asking again is free.",
    inputSchema: { repo: z.string().min(3).max(300).describe("owner/repo, owner/repo@ref, a github.com URL, or _local/<folder> when self-hosted") },
  },
  async ({ repo }) => {
    const p = await load(repo);
    const { atlas, fromCache } = await getAtlas(p, caller);
    return text(mapMarkdown(p, atlas, fromCache));
  },
);

server.registerTool(
  "codetrail_tour",
  {
    title: "Trace how something works",
    description:
      "Answers a how-does-it-work question about a GitHub repo (or _local/<folder>) as ordered steps through the code, each with a file, a line range checked against the real file, and a short explanation. Maps the repo first if needed.",
    inputSchema: {
      repo: z.string().min(3).max(300).describe("owner/repo, owner/repo@ref, a github.com URL, or _local/<folder> when self-hosted"),
      question: z.string().min(3).max(300).describe('e.g. "What happens when a request hits the server?"'),
    },
  },
  async ({ repo, question }) => {
    const p = await load(repo);
    const { atlas } = await getAtlas(p, caller);
    const { tour, fromCache } = await getTour(p, atlas, question, caller);
    return text(tourMarkdown(p, tour, fromCache));
  },
);

server.registerTool(
  "codetrail_ask",
  {
    title: "Ask about a repository",
    description:
      "Answers a question about a GitHub repo (or _local/<folder>) from a whole-repo read by DeepSeek V4.1 Flash 1017: a short answer with code references checked against the real files, and questions to ask next. Pass the returned thread id to ask a follow-up in context. Answers are stored, so asking again is free.",
    inputSchema: {
      repo: z.string().min(3).max(300).describe("owner/repo, owner/repo@ref, a github.com URL, or _local/<folder> when self-hosted"),
      question: z.string().min(3).max(300),
      thread: z.string().regex(/^[0-9a-f]{12}$/).optional().describe("A thread id from an earlier codetrail_ask, to follow up in context"),
      thorough: z.boolean().optional().describe("Trace across more files (slower, costs more)"),
    },
  },
  async ({ repo, question, thread, thorough }) => {
    const p = await load(repo);
    const { atlas } = await getAtlas(p, caller);
    const mode = thorough ? "thorough" : "answer";
    if (thread) {
      const r = await askFollowUp(p, atlas, { thread }, question, mode, caller);
      return text(answerMarkdown(p, r.answer!, r.fromCache, r.thread.id));
    }
    const { answer, fromCache } = await getAnswer(p, atlas, question, caller, { thorough });
    // A thread holding this answer (free), so the agent can follow up in context.
    const started = await startThread(p, { kind: "answer", id: answer.id });
    return text(answerMarkdown(p, answer, fromCache, started.id));
  },
);

server.registerTool(
  "codetrail_pr",
  {
    title: "Explain a pull request",
    description:
      "A reviewer's tour of a pull request on a public GitHub repo: what it changes, as ordered steps through the PR's code with line ranges checked against the real files, plus risks, missing tests and questions tied to lines. Runs on top of the repo's whole-repo read (mapped first if needed); stored per PR head commit, so asking again is free.",
    inputSchema: {
      repo: z.string().min(3).max(300).describe("owner/repo, a github.com URL, or a pull request URL"),
      number: z.number().int().positive().optional().describe("The pull request number (not needed when repo is a PR URL)"),
    },
  },
  async ({ repo, number }) => {
    const ref = parseRepoInput(repo);
    const n = number ?? ref?.pull;
    if (!ref || !n) throw new Error("Give a pull request URL, or owner/repo and a number.");
    const p = await prepare({ owner: ref.owner, repo: ref.repo, ref: ref.ref ?? (await latestReadSha(ref.owner, ref.repo)) });
    const { atlas } = await getAtlas(p, caller);
    const { tour, fromCache } = await getPullTour(p, atlas, n, caller);
    return text(pullMarkdown(p, tour, fromCache));
  },
);
}
