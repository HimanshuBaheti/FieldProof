import { createHash } from "crypto";
import type { ActionRecord } from "./types";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Canonical JSON: fixed key order, no whitespace. */
export function canonicalRecordString(r: ActionRecord): string {
  return JSON.stringify({
    actionId: r.actionId,
    farmId: r.farmId,
    practice: r.practice,
    season: r.season,
    verifier: r.verifier,
    evidenceHash: r.evidenceHash,
  });
}

export function computeRecordHash(r: ActionRecord): string {
  return sha256Hex(canonicalRecordString(r));
}
