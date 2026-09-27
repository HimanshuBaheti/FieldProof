import { NextResponse } from "next/server";
import { computeRecordHash } from "@/lib/hash";
import { describeError, mintActionToken } from "@/lib/solana";
import { getAction, pushHistory, updateAction } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { actionId, decision, reason } = (await req.json().catch(() => ({}))) as {
    actionId?: string;
    decision?: string;
    reason?: string;
  };
  if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  const rec = await getAction(actionId);
  if (!rec) return NextResponse.json({ error: `Action ${actionId} not found` }, { status: 404 });

  if (decision === "reject") {
    if (rec.status !== "submitted") {
      return NextResponse.json({ error: `Cannot reject: status is ${rec.status}` }, { status: 409 });
    }
    const updated = await updateAction(actionId, (r) =>
      pushHistory(r, "rejected", { note: reason || "Evidence insufficient — please resubmit." }),
    );
    return NextResponse.json(updated);
  }

  // "approved" means a previous mint attempt failed after approval — allow retry.
  if (rec.status !== "submitted" && rec.status !== "approved") {
    return NextResponse.json({ error: `Cannot approve: status is ${rec.status}` }, { status: 409 });
  }

  let approved = rec;
  if (rec.status === "submitted") {
    approved = await updateAction(actionId, (r) => {
      r.recordHash = computeRecordHash(r);
      pushHistory(r, "approved");
    });
  }

  try {
    const { mint, txMint } = await mintActionToken(actionId, approved.recordHash!);
    const minted = await updateAction(actionId, (r) => {
      r.mint = mint;
      r.txMint = txMint;
      pushHistory(r, "minted", { txSig: txMint });
    });
    return NextResponse.json(minted);
  } catch (e) {
    const { message, logs } = await describeError(e);
    return NextResponse.json(
      { error: `Approved, but minting failed: ${message}`, logs, record: approved },
      { status: 502 },
    );
  }
}
