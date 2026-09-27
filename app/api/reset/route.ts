import { NextResponse } from "next/server";
import { readAll, resetToSeed } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Restore the 4 seeded demo actions (local file or Redis). On-chain history is untouched. */
export async function POST() {
  await resetToSeed();
  return NextResponse.json(await readAll());
}
