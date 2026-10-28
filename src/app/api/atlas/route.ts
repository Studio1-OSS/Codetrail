// Reads the whole repository with the model and returns the module map (stored per commit).
import { NextResponse } from "next/server";
import { callerOf, errorResponse, repoAt } from "@/server/http";
import { getAtlas, getLedger, getTourIndex, prepare, withActuals } from "@/server/trail/service";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { owner, repo, sha } = repoAt.parse(await req.json());
    const p = await prepare({ owner, repo, ref: sha });
    const { atlas, fromCache } = await getAtlas(p, await callerOf(req));
    const [ledger, tours] = await Promise.all([getLedger(p.info), getTourIndex(p.info)]);
    return NextResponse.json({ atlas, fromCache, ledger, tours, summary: withActuals(p.summary, ledger) });
  } catch (error) {
    return errorResponse(error);
  }
}
