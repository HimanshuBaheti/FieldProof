"use client";

import { useState } from "react";
import { ApiError, formatTime, postJson } from "@/lib/client";
import type { ActionRecord } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { AddressLink, TxLink } from "./TxLink";

function omit<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

export default function VerifierPanel({
  actions,
  onChanged,
  goProcessor,
}: {
  actions: ActionRecord[];
  onChanged: () => Promise<void>;
  goProcessor: () => void;
}) {
  const [busy, setBusy] = useState<Record<string, "approve" | "reject">>({});
  const [errors, setErrors] = useState<Record<string, { message: string; logs?: string[] }>>({});
  const [minted, setMinted] = useState<string[]>([]);

  const queue = actions.filter((a) => a.status === "submitted" || a.status === "approved");
  const justMinted = actions.filter((a) => minted.includes(a.actionId));

  async function decide(a: ActionRecord, decision: "approve" | "reject") {
    setBusy((b) => ({ ...b, [a.actionId]: decision }));
    setErrors((x) => omit(x, a.actionId));
    try {
      await postJson<ActionRecord>("/api/verify", { actionId: a.actionId, decision });
      if (decision === "approve") setMinted((m) => [a.actionId, ...m]);
    } catch (e) {
      setErrors((x) => ({
        ...x,
        [a.actionId]: { message: (e as Error).message, logs: (e as ApiError).logs },
      }));
    } finally {
      await onChanged();
      setBusy((b) => omit(b, a.actionId));
    }
  }

  return (
    <div className="space-y-5">
      {justMinted.map((a) => (
        <div
          key={a.actionId}
          className="flex flex-wrap items-center gap-4 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-300"
        >
          <span className="text-2xl font-bold text-emerald-800">✓ Minted</span>
          <span className="text-lg">
            <b>{a.actionId}</b> · {a.farmerName} · 1 token, supply locked
          </span>
          <TxLink sig={a.txMint} label="mint tx" />
          <AddressLink address={a.mint} />
          <button onClick={goProcessor} className="ml-auto text-lg font-semibold text-emerald-800 underline underline-offset-4">
            Go to Processor →
          </button>
        </div>
      ))}

      {queue.length === 0 && (
        <p className="rounded-2xl bg-stone-50 p-8 text-center text-lg text-stone-500 ring-1 ring-stone-200">
          Nothing waiting for review. Submit an action from the Farmer tab.
        </p>
      )}

      {queue.map((a) => {
        const state = busy[a.actionId];
        const err = errors[a.actionId];
        return (
          <article key={a.actionId} className="flex gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
            <div className="h-40 w-56 shrink-0 overflow-hidden rounded-xl bg-stone-200">
              {a.evidenceImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.evidenceImage} alt={`Evidence for ${a.actionId}`} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold">{a.actionId}</h3>
                <StatusBadge status={a.status} />
                <span className="text-base text-stone-500">submitted {formatTime(a.history.at(-1)!.timestamp)}</span>
              </div>
              <p className="text-lg">
                <b>{a.farmerName}</b> · {a.county} · {a.farmId}
              </p>
              <p className="text-lg">
                {a.practice} —{" "}
                <b>{a.estReduction} tCO₂e</b>{" "}
                <span className="rounded bg-stone-200 px-1.5 py-0.5 text-sm uppercase tracking-wide">estimate</span>
              </p>
              {a.note && <p className="text-base text-stone-600">“{a.note}”</p>}
              <p className="break-all font-mono text-sm text-stone-500">evidence sha256: {a.evidenceHash}</p>
              {a.status === "approved" && !state && (
                <p className="text-base text-sky-800">Approved earlier but not minted yet — approve again to retry the mint.</p>
              )}
              {err && (
                <div className="rounded-xl bg-red-50 p-3 text-base text-red-800">
                  {err.message}
                  {err.logs && <pre className="mt-2 whitespace-pre-wrap text-xs">{err.logs.join("\n")}</pre>}
                </div>
              )}
            </div>
            <div className="flex w-56 shrink-0 flex-col justify-center gap-3">
              {state === "approve" ? (
                <div className="flex items-center justify-center gap-3 rounded-xl bg-emerald-50 px-4 py-4 text-lg font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                  Minting on Solana…
                </div>
              ) : (
                <>
                  <button
                    disabled={!!state}
                    onClick={() => decide(a, "approve")}
                    className="rounded-xl bg-emerald-700 px-5 py-4 text-xl font-semibold text-white hover:bg-emerald-800 disabled:bg-stone-300"
                  >
                    Approve & mint
                  </button>
                  {a.status === "submitted" && (
                    <button
                      disabled={!!state}
                      onClick={() => decide(a, "reject")}
                      className="rounded-xl bg-white px-5 py-3 text-lg font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      {state === "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  )}
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
