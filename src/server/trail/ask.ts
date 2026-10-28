// Ask answers with generative UI: DeepSeek writes OpenUI Lang from our block library (tables, file lists,
// sequences, code references), on the same cached repo prefix as tours. Every code reference and file path
// is then checked against the real code, and the answer is stored per commit for free replays.
import { createLibrary, createParser, defineComponent, type ElementNode } from "@openuidev/lang-core";
import { ANSWER_EXAMPLE, ANSWER_ROOT, ANSWER_RULES, answerDescription, answerProps, blockSpecs, cleanProgram, refKey, THOROUGH_RULES, type StoredAnswer } from "@/lib/answer-schema";
import type { Atlas } from "@/lib/schemas";
import { chatText, type StreamHooks } from "@/server/ai/nebius";
import { getJSON, putJSON } from "@/server/store";
import { groundSteps, resolvePath } from "./ground";
import { answerTitle } from "@/lib/thread";
import { answerBase, checkLimitsFor, questionIdOf, shared, trackedCall, type Followed, type Prepared } from "./service";

const blocks = Object.entries(blockSpecs).map(([name, spec]) => defineComponent({ name, description: spec.description, props: spec.props, component: null }));
const root = defineComponent({ name: ANSWER_ROOT, description: answerDescription, props: answerProps(blocks.map((b) => b.ref)), component: null });
const serverLibrary = createLibrary({ components: [root, ...blocks], root: ANSWER_ROOT });

const PROMPT = serverLibrary.prompt({
  preamble: "Answer the developer's question about the repository above with a short structured answer.",
  additionalRules: ANSWER_RULES,
  examples: [ANSWER_EXAMPLE],
});

type AnswerIndexEntry = { id: string; question: string; title: string; at: number };

export const getAnswerIndex = (p: Prepared) => getJSON<AnswerIndexEntry[]>(`${answerBase(p)}/answers.json`).then((a) => a ?? []);
export const getStoredAnswer = (p: Prepared, id: string) => getJSON<StoredAnswer>(`${answerBase(p)}/answers/${id.replace(/[^\w-]/g, "")}.json`);

/** Walks the parsed answer and checks every code reference and file path against the repo. */
function checkAnswer(text: string, p: Pick<Prepared, "files">, atlas: Atlas): StoredAnswer["checks"] {
  const parsed = createParser(serverLibrary.toJSONSchema(), ANSWER_ROOT).parse(text);
  const refs: StoredAnswer["checks"]["refs"] = {};
  const files: StoredAnswer["checks"]["files"] = {};
  const nodes = atlas.nodes.map((n) => ({ id: n.id, files: n.files }));
  const visit = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(visit);
    if (!v || typeof v !== "object") return;
    const el = v as ElementNode;
    if (el.type === "element") {
      const props = el.props as Record<string, unknown>;
      if (el.typeName === "CodeRef" && typeof props.file === "string" && typeof props.startLine === "number") {
        const step = { node: "", title: "", file: props.file, startLine: props.startLine, endLine: Number(props.endLine ?? props.startLine), anchor: String(props.anchor ?? ""), narration: "" };
        const g = groundSteps([step], p.files, nodes);
        const s = g.steps[0];
        refs[refKey(props.file, props.startLine)] = s ? { file: s.file, startLine: s.startLine, endLine: s.endLine, corrected: s.corrected } : null;
      }
      if (el.typeName === "FileList" && Array.isArray(props.items)) {
        for (const item of props.items as { path?: string }[]) if (item?.path) files[item.path] = resolvePath(item.path, p.files);
      }
      Object.values(props).forEach(visit);
    } else {
      Object.values(v).forEach(visit);
    }
  };
  visit(parsed.root);
  return { refs, files };
}

type AnswerOptions = { stream?: StreamHooks; thorough?: boolean; follow?: Followed };

/**
 * A structured answer. Thorough mode traces further (more reasoning, more blocks). Inside a conversation, the
 * recap goes before the question and the answer is stored for that thread only (not in the repo's answer list).
 */
export async function getAnswer(p: Prepared, atlas: Atlas, question: string, who: string, opts: AnswerOptions = {}): Promise<{ answer: StoredAnswer; fromCache: boolean }> {
  const q = question.trim().slice(0, 300);
  const id = questionIdOf(`ask:${opts.follow ? `${opts.follow.scope}:` : ""}${opts.thorough ? "thorough:" : ""}${q}`);
  const stored = await getStoredAnswer(p, id);
  if (stored) return { answer: stored, fromCache: true };
  return shared(`${answerBase(p)}/answers/${id}`, () => writeAnswer(p, atlas, q, id, who, opts));
}

async function writeAnswer(p: Prepared, atlas: Atlas, q: string, id: string, who: string, opts: AnswerOptions): Promise<{ answer: StoredAnswer; fromCache: boolean }> {
  await checkLimitsFor(who, "asks");

  // The block library's prompt goes after the repo, so the cached prefix is unchanged.
  // Medium effort: the model plans in its reasoning, so the program it writes needs no second attempt.
  const task = [opts.follow?.context, PROMPT, opts.thorough ? `Thorough mode:\n${THOROUGH_RULES.map((r) => `- ${r}`).join("\n")}` : "", `Question: ${q}`].filter(Boolean).join("\n\n");
  const { result: raw, record } = await trackedCall(p, "ask", q, (cfg) =>
    chatText(cfg, {
      prefix: p.prefix,
      task,
      cacheKey: `codetrail:${p.info.owner}/${p.info.repo}@${p.info.sha}`,
      effort: opts.thorough ? "high" : "medium",
      maxTokens: opts.thorough ? 16_384 : 8_192,
      stream: opts.stream,
    }),
  );
  const text = cleanProgram(raw);
  const answer: StoredAnswer = { id, question: q, text, checks: checkAnswer(text, p, atlas), calls: [record], at: Date.now(), ...(opts.thorough ? { thorough: true } : {}) };
  await putJSON(`${answerBase(p)}/answers/${id}.json`, answer);
  if (opts.follow) return { answer, fromCache: false };
  const index = await getAnswerIndex(p);
  const title = (answerTitle(text) ?? q).slice(0, 100);
  await putJSON(`${answerBase(p)}/answers.json`, [...index.filter((a) => a.id !== id), { id, question: q, title, at: answer.at }]);
  return { answer, fromCache: false };
}
