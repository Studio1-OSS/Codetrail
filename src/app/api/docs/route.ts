// Written docs: GET returns stored docs (free), POST writes them with one call on the cached repo.
import { NextResponse } from "next/server";
import { callerOf, errorResponse, repoAt } from "@/server/http";
import { getDocs, getStoredDocs } from "@/server/trail/docs";
import { getAtlas, getLedger, prepare } from "@/server/trail/service";

export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const { owner, repo, sha } = repoAt.parse(Object.fromEntries(new URL(req.url).searchParams));
    const docs = await getStoredDocs(await prepare({ owner, repo, ref: sha }));
    return docs ? NextResponse.json({ docs }) : NextResponse.json({ error: "No docs yet." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const { owner, repo, sha } = repoAt.parse(await req.json());
    const who = await callerOf(req);
    const p = await prepare({ owner, repo, ref: sha });
    const { atlas } = await getAtlas(p, who);
    const { docs, fromCache } = await getDocs(p, atlas, who);
    return NextResponse.json({ docs, fromCache, ledger: await getLedger(p.info) });
  } catch (error) {
    return errorResponse(error);
  }
}
