import { computeRecordHash, sha256Hex } from "./hash";
import { SEASON, VERIFIER } from "./farms";
import type { ActionRecord } from "./types";

/** Small generated field "photo" so seeded records have a thumbnail. */
function fieldSvg(sky: string, grass: string, label: string): { image: string; hash: string } {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<rect width="240" height="70" fill="${sky}"/>` +
    `<circle cx="200" cy="30" r="14" fill="#fde68a"/>` +
    `<rect y="70" width="240" height="90" fill="${grass}"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<rect y="${78 + i * 14}" width="240" height="4" fill="#00000018"/>`).join("") +
    `<text x="10" y="150" font-family="sans-serif" font-size="12" fill="#ffffffcc">${label}</text>` +
    `</svg>`;
  return {
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    hash: sha256Hex(svg),
  };
}

export function buildSeed(): ActionRecord[] {
  const seán = fieldSvg("#bfdbfe", "#4d7c0f", "IE-TP-0412 · LESS trailing shoe");
  const aoife = fieldSvg("#d1d5db", "#65a30d", "IE-CK-0877 · (blurry)");
  const mary = fieldSvg("#bae6fd", "#15803d", "IE-KK-0193 · protected urea bags");
  const declan = fieldSvg("#e0f2fe", "#3f6212", "IE-WX-0256 · clover reseed");

  const retired: ActionRecord = {
    actionId: "FP-2026-0038",
    farmId: "IE-TP-0412",
    farmerName: "Seán Murphy",
    county: "Tipperary",
    practice: "Low-emission slurry spreading (LESS)",
    note: "Trailing shoe on 32 ha of silage ground, April and June applications.",
    season: SEASON,
    estReduction: 0.8,
    evidenceHash: seán.hash,
    evidenceImage: seán.image,
    verifier: VERIFIER,
    status: "retired",
    mint: "seed",
    txMint: "seed",
    txTransfer: "seed",
    txBurn: "seed",
    buyer: "Glanbia Mock Processor",
    reportingYear: "FY2026",
    history: [
      { status: "submitted", timestamp: "2026-06-12T09:14:00.000Z" },
      { status: "approved", timestamp: "2026-06-19T14:02:00.000Z" },
      { status: "minted", timestamp: "2026-06-19T14:02:08.000Z", txSig: "seed" },
      { status: "sold", timestamp: "2026-07-03T11:30:00.000Z", txSig: "seed" },
      { status: "retired", timestamp: "2026-07-03T11:30:06.000Z", txSig: "seed" },
    ],
  };
  retired.recordHash = computeRecordHash(retired);

  const rejected: ActionRecord = {
    actionId: "FP-2026-0039",
    farmId: "IE-CK-0877",
    farmerName: "Aoife Kelly",
    county: "Cork",
    practice: "Clover-rich sward reseeding",
    note: "Reseeded 8 ha with white clover mix after first cut.",
    season: SEASON,
    estReduction: 1.5,
    evidenceHash: aoife.hash,
    evidenceImage: aoife.image,
    verifier: VERIFIER,
    status: "rejected",
    history: [
      { status: "submitted", timestamp: "2026-08-02T16:40:00.000Z" },
      {
        status: "rejected",
        timestamp: "2026-08-05T10:05:00.000Z",
        note: "Photo too blurry to confirm seed mix — please resubmit.",
      },
    ],
  };

  const marySubmitted: ActionRecord = {
    actionId: "FP-2026-0041",
    farmId: "IE-KK-0193",
    farmerName: "Mary Byrne",
    county: "Kilkenny",
    practice: "Protected urea replacing CAN",
    note: "Dairy farm, 60 ha grazing platform. Switched all spring and summer CAN to protected urea.",
    season: SEASON,
    estReduction: 1.2,
    evidenceHash: mary.hash,
    evidenceImage: mary.image,
    verifier: VERIFIER,
    status: "submitted",
    history: [{ status: "submitted", timestamp: "2026-09-20T08:30:00.000Z" }],
  };

  const declanSubmitted: ActionRecord = {
    actionId: "FP-2026-0040",
    farmId: "IE-WX-0256",
    farmerName: "Declan Walsh",
    county: "Wexford",
    practice: "Clover-rich sward reseeding",
    note: "Over-sowed 12 ha of sheep grazing with red and white clover.",
    season: SEASON,
    estReduction: 1.5,
    evidenceHash: declan.hash,
    evidenceImage: declan.image,
    verifier: VERIFIER,
    status: "submitted",
    history: [{ status: "submitted", timestamp: "2026-09-14T13:10:00.000Z" }],
  };

  return [marySubmitted, declanSubmitted, rejected, retired];
}
