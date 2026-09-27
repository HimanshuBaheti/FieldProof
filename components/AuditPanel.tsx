"use client";

import { useState } from "react";
import { formatTime, postJson } from "@/lib/client";
import type { ActionRecord, HistoryEntry, ResellResult, Status } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { AddressLink, TxLink } from "./TxLink";

const FLOW: Status[] = ["submitted", "approved", "minted", "sold", "retired"];

function lastEntry(history: HistoryEntry[], status: Status) {
  return [...history].reverse().find((h) => h.status === status);
}

function Timeline({ a }: { a: ActionRecord }) {
  const steps: Status[] = a.status === "rejected" ? ["submitted", "rejected"] : FLOW;
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${FLOW.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const h = lastEntry(a.history, s);
        const done = !!h;
        const isReject = s === "rejected";
        return (
          <li key={s} className="relative">
            {i > 0 && (
              <span
                className={`absolute -left-2 top-3 h-0.5 w-2 ${done ? (isReject ? "bg-red-400" : "bg-emerald-600") : "bg-stone-300"}`}
              />
            )}
            <div
              className={`h-full rounded-xl p-3 ring-1 ${
                !done
                  ? "bg-stone-50 ring-stone-200"
                  : isReject
                    ? "bg-red-50 ring-red-200"
                    : "bg-emerald-50/60 ring-emerald-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    !done ? "bg-stone-300" : isReject ? "bg-red-500" : "bg-emerald-600"
                  }`}
                />
                <span className={`text-base font-semibold capitalize ${done ? "text-stone-900" : "text-stone-400"}`}>
                  {s}
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-600">{h ? formatTime(h.timestamp) : "—"}</p>
              {h?.txSig && (
                <div className="mt-1">
                  <TxLink sig={h.txSig} />
                </div>
              )}
              {h?.note && <p className="mt-1 text-sm text-stone-600">{h.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AuditCard({ a }: { a: ActionRecord }) {
  const [resell, setResell] = useState<ResellResult>();
  const [resellErr, setResellErr] = useState<string>();
  const [checking, setChecking] = useState(false);
  const canResell = a.status === "retired" && a.mint && a.mint !== "seed";

  async function tryResell() {
    setChecking(true);
    setResell(undefined);
    setResellErr(undefined);
    try {
      setResell(await postJson<ResellResult>("/api/resell", { actionId: a.actionId }));
    } catch (e) {
      setResellErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <article className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-bold">{a.actionId}</h3>
        <StatusBadge status={a.status} large />
        <span className="text-lg text-stone-700">
          {a.farmerName} · {a.county} · {a.practice} · {a.estReduction} tCO₂e{" "}
          <span className="text-stone-500">(estimate)</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <AddressLink address={a.mint} />
          {canResell && (
            <button
              onClick={tryResell}
              disabled={checking}
              className="rounded-lg bg-stone-900 px-4 py-2 text-base font-semibold text-white hover:bg-stone-700 disabled:bg-stone-400"
            >
              {checking ? "Trying…" : "Try to resell"}
            </button>
          )}
        </div>
      </div>

      <Timeline a={a} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="font-semibold text-stone-500">evidence hash</dt>
        <dd className="break-all font-mono text-stone-700">{a.evidenceHash}</dd>
        {a.recordHash && (
          <>
            <dt className="font-semibold text-stone-500">record hash</dt>
            <dd className="break-all font-mono text-stone-700">{a.recordHash}</dd>
          </>
        )}
        {a.paymentSol !== undefined && (
          <>
            <dt className="font-semibold text-stone-500">farmer paid</dt>
            <dd className="flex items-center gap-2 text-stone-700">
              {a.paymentSol} SOL by {a.buyer} (in the sale tx)
              {a.txTopUp && <TxLink sig={a.txTopUp} label="wallet top-up" />}
            </dd>
          </>
        )}
        {a.buyer && (
          <>
            <dt className="font-semibold text-stone-500">retired for</dt>
            <dd className="text-stone-700">
              {a.buyer} · {a.reportingYear}
            </dd>
          </>
        )}
      </dl>

      {resell && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-xl font-bold text-red-700">✕ {resell.message}</p>
          <p className="mt-2 font-mono text-sm text-red-900">{resell.error}</p>
          {resell.logs && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-mono text-xs text-red-900">
              {resell.logs.join("\n")}
            </pre>
          )}
        </div>
      )}
      {resellErr && <p className="rounded-xl bg-red-50 p-3 text-base text-red-800">{resellErr}</p>}
    </article>
  );
}

export default function AuditPanel({ actions }: { actions: ActionRecord[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold text-stone-900">Audit trail</h2>
        <p className="text-base text-stone-500">Every action, every state change, every on-chain transaction.</p>
      </div>
      {actions.map((a) => (
        <AuditCard key={a.actionId} a={a} />
      ))}
    </section>
  );
}
