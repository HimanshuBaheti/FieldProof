import { NextResponse } from "next/server";
import { attemptResale, describeError } from "@/lib/solana";
import { getAction } from "@/lib/store";
import type { ResellResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { actionId } = (await req.json().catch(() => ({}))) as { actionId?: string };
  if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });

  const rec = await getAction(actionId);
  if (!rec) return NextResponse.json({ error: `Action ${actionId} not found` }, { status: 404 });
  if (!rec.mint || rec.mint === "seed") {
    return NextResponse.json({ error: "Seeded record has no on-chain token to test" }, { status: 409 });
  }
  if (rec.status !== "retired") {
    return NextResponse.json({ error: `Resale check is for retired records (status is ${rec.status})` }, { status: 409 });
  }

  try {
    const { error, logs, mintInfo } = await attemptResale(rec.mint);
    const result: ResellResult = {
      ok: false,
      message: `Resale failed: record already retired (supply ${mintInfo.supply}, mint authority ${
        mintInfo.mintAuthority ?? "none"
      })`,
      error,
      logs,
      mintInfo,
    };
    return NextResponse.json(result);
  } catch (e) {
    const { message, logs } = await describeError(e);
    return NextResponse.json({ error: message, logs }, { status: 502 });
  }
}
