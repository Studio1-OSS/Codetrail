// Site-wide numbers. A daily table counts spend (for the optional daily budget, failed calls included) and free
// replays; the counters people see are summed from the call ledger. Increments are single SQL upserts.
import { sql } from "drizzle-orm";
import type { CallRecord } from "@/lib/schemas";
import { modelPrice } from "@/server/ai/client";
import { db, dbReady, schema } from "@/server/db";

export const today = () => new Date().toISOString().slice(0, 10);

type Delta = Partial<Record<"reads" | "tours" | "replays" | "inputTokens" | "cachedTokens" | "outputTokens" | "usd" | "savedUsd", number>>;

async function bump(delta: Delta) {
  await dbReady();
  const s = schema.stats;
  const set = Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, sql`${s[k as keyof Delta]} + ${v}`]));
  await db
    .insert(s)
    .values({ day: today(), ...delta })
    .onConflictDoUpdate({ target: s.day, set });
}

/** A finished or failed model call. Failed calls still count their tokens and spend. */
export function recordCall(c: Pick<CallRecord, "usage" | "cost" | "saved">, kind?: CallRecord["kind"]) {
  return bump({
    ...(kind === "atlas" ? { reads: 1 } : kind ? { tours: 1 } : {}),
    inputTokens: c.usage.input,
    cachedTokens: c.usage.cached,
    outputTokens: c.usage.output,
    usd: c.cost ?? 0,
    savedUsd: c.saved ?? 0,
  }).catch((e) => console.error("Couldn't record stats", e));
}

export const recordReplay = () => bump({ replays: 1 }).catch((e) => console.error("Couldn't record a replay", e));

export async function spentToday(): Promise<number> {
  await dbReady();
  const row = await db.query.stats.findFirst({ where: (s, { eq }) => eq(s.day, today()) });
  return row?.usd ?? 0;
}

export type SiteTotals = { reads: number; tours: number; replays: number; inputTokens: number; cachedTokens: number; outputTokens: number; usd: number; savedUsd: number };

/**
 * The counters on the home and data pages. Money and tokens come from the call ledger, the same records as every
 * receipt, so all totals agree. Free replays come from the daily table. Savings are cached tokens priced at the
 * difference between the input and cached-input price.
 */
export async function siteTotals(): Promise<SiteTotals> {
  await dbReady();
  const r = schema.calls.record;
  const [ledger] = await db
    .select({
      // Whole reads only: a folder-scoped read (its key ends in ~<scope hash>) isn't the repo read whole.
      reads: sql<number>`coalesce(sum(json_extract(${r}, '$.kind') = 'atlas' and instr(${schema.calls.commit}, '~') = 0), 0)`,
      tours: sql<number>`coalesce(sum(json_extract(${r}, '$.kind') != 'atlas'), 0)`,
      inputTokens: sql<number>`coalesce(sum(json_extract(${r}, '$.usage.input')), 0)`,
      cachedTokens: sql<number>`coalesce(sum(json_extract(${r}, '$.usage.cached')), 0)`,
      outputTokens: sql<number>`coalesce(sum(json_extract(${r}, '$.usage.output')), 0)`,
      usd: sql<number>`coalesce(sum(json_extract(${r}, '$.cost')), 0)`,
    })
    .from(schema.calls);
  const [daily] = await db.select({ replays: sql<number>`coalesce(sum(${schema.stats.replays}), 0)` }).from(schema.stats);
  const price = await modelPrice();
  return { ...ledger, replays: daily.replays, savedUsd: price ? ledger.cachedTokens * (price.input - price.cached) : 0 };
}
