import { NextResponse } from "next/server";
import { burnWithMemo, describeError, transferToProcessor } from "@/lib/solana";
import { getAction, pushHistory, updateAction } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs both steps (transfer, then burn). Pass step: "transfer" or "burn" to run
 * just one, so the UI can show progress between them.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    actionId?: string;
    buyer?: string;
    reportingYear?: string;
    step?: "transfer" | "burn";
  };
  const actionId = body.actionId;
  const buyer = (body.buyer ?? "").trim().replace(/\|/g, "/").slice(0, 80);
  const reportingYear = (body.reportingYear ?? "").trim().replace(/\|/g, "/").slice(0, 20);
  if (!actionId) return NextResponse.json({ error: "actionId required" }, { status: 400 });
  if (!buyer) return NextResponse.json({ error: "buyer required" }, { status: 400 });
  if (!reportingYear) return NextResponse.json({ error: "reportingYear required" }, { status: 400 });

  let rec = await getAction(actionId);
  if (!rec) return NextResponse.json({ error: `Action ${actionId} not found` }, { status: 404 });
  if (!rec.mint || rec.mint === "seed") {
    return NextResponse.json({ error: "This action has no on-chain token" }, { status: 409 });
  }

  // Transaction A: farmer -> processor (skipped when resuming a sale whose burn failed)
  if (body.step === "transfer" || (body.step !== "burn" && rec.status !== "sold")) {
    if (rec.status !== "minted") {
      return NextResponse.json({ error: `Cannot sell: status is ${rec.status}` }, { status: 409 });
    }
    try {
      const { txTransfer, txTopUp, paymentSol } = await transferToProcessor(rec.mint);
      rec = await updateAction(actionId, (r) => {
        r.txTransfer = txTransfer;
        r.txTopUp = txTopUp;
        r.paymentSol = paymentSol;
        r.buyer = buyer;
        r.reportingYear = reportingYear;
        pushHistory(r, "sold", { txSig: txTransfer });
      });
    } catch (e) {
      const { message, logs } = await describeError(e);
      return NextResponse.json({ error: `Transfer failed: ${message}`, logs }, { status: 502 });
    }
    if (body.step === "transfer") return NextResponse.json(rec);
  }

  // Transaction B: burn + retirement memo
  if (rec.status !== "sold") {
    return NextResponse.json({ error: `Cannot retire: status is ${rec.status}` }, { status: 409 });
  }
  try {
    const txBurn = await burnWithMemo(rec.mint!, actionId, buyer, reportingYear);
    rec = await updateAction(actionId, (r) => {
      r.txBurn = txBurn;
      r.buyer = buyer;
      r.reportingYear = reportingYear;
      pushHistory(r, "retired", { txSig: txBurn });
    });
    return NextResponse.json(rec);
  } catch (e) {
    const { message, logs } = await describeError(e);
    return NextResponse.json({ error: `Burn failed: ${message}`, logs, record: rec }, { status: 502 });
  }
}
