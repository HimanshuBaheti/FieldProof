import { NextResponse } from "next/server";
import { FARMS, PRACTICES, SEASON, VERIFIER } from "@/lib/farms";
import { insertAction, pushHistory, readAll, updateAction } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readAll());
}

interface CreateBody {
  farmId?: string;
  practice?: string;
  note?: string;
  evidenceHash?: string;
  evidenceImage?: string;
  /** actionId of a rejected action being resubmitted with new evidence */
  resubmitOf?: string;
}

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const farm = FARMS.find((f) => f.farmId === body.farmId);
  const practice = PRACTICES.find((p) => p.name === body.practice);
  if (!farm) return NextResponse.json({ error: "Unknown farmId" }, { status: 400 });
  if (!practice) return NextResponse.json({ error: "Unknown practice" }, { status: 400 });
  if (!body.evidenceHash || !/^[0-9a-f]{64}$/.test(body.evidenceHash)) {
    return NextResponse.json({ error: "evidenceHash must be a SHA-256 hex string" }, { status: 400 });
  }
  if (body.evidenceImage && body.evidenceImage.length > 400_000) {
    return NextResponse.json({ error: "evidenceImage too large" }, { status: 400 });
  }

  const note = (body.note ?? "").slice(0, 500);

  try {
    if (body.resubmitOf) {
      const rec = await updateAction(body.resubmitOf, (r) => {
        if (r.status !== "rejected") throw new Error(`Only rejected actions can be resubmitted (is ${r.status})`);
        if (r.farmId !== farm.farmId) throw new Error("Resubmission must be for the same farm");
        r.practice = practice.name;
        r.estReduction = practice.estReduction;
        r.note = note;
        r.evidenceHash = body.evidenceHash!;
        r.evidenceImage = body.evidenceImage;
        pushHistory(r, "submitted", { note: "Resubmitted with new evidence" });
      });
      return NextResponse.json(rec);
    }

    const rec = await insertAction((actionId) => ({
      actionId,
      farmId: farm.farmId,
      farmerName: farm.farmerName,
      county: farm.county,
      practice: practice.name,
      note,
      season: SEASON,
      estReduction: practice.estReduction,
      evidenceHash: body.evidenceHash!,
      evidenceImage: body.evidenceImage,
      verifier: VERIFIER,
      status: "submitted",
      history: [{ status: "submitted", timestamp: new Date().toISOString() }],
    }));
    return NextResponse.json(rec, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
