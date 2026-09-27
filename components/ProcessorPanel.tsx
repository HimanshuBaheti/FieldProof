"use client";

import { useState } from "react";
import { ApiError, postJson } from "@/lib/client";
import type { ActionRecord } from "@/lib/types";
import { AddressLink, TxLink } from "./TxLink";

type Step = "transfer" | "burn" | "done";

const input =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30";

function StepRow({ label, state }: { label: string; state: "todo" | "active" | "done" }) {
  return (
    <li className={`flex items-center gap-3 text-lg ${state === "todo" ? "text-stone-400" : "text-stone-900"}`}>
      {state === "done" ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-sm text-white">✓</span>
      ) : state === "active" ? (
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      ) : (
        <span className="h-6 w-6 rounded-full border-2 border-stone-300" />
      )}
      <span className={state === "active" ? "font-semibold" : ""}>{label}</span>
    </li>
  );
}

function ProcessorCard({
  a,
  onChanged,
  paymentSol,
}: {
  a: ActionRecord;
  onChanged: () => Promise<void>;
  paymentSol: number;
}) {
  const [buyer, setBuyer] = useState(a.buyer ?? "Glanbia Mock Processor");
  const [reportingYear, setReportingYear] = useState(a.reportingYear ?? "FY2026");
  const [step, setStep] = useState<Step | undefined>(
    a.status === "retired" ? "done" : undefined,
  );
  const [error, setError] = useState<{ message: string; logs?: string[] }>();

  async function buyAndRetire() {
    setError(undefined);
    try {
      if (a.status === "minted") {
        setStep("transfer");
        await postJson("/api/retire", { actionId: a.actionId, buyer, reportingYear, step: "transfer" });
        await onChanged();
      }
      setStep("burn");
      await postJson("/api/retire", { actionId: a.actionId, buyer, reportingYear, step: "burn" });
      setStep("done");
    } catch (e) {
      setStep(undefined);
      setError({ message: (e as Error).message, logs: (e as ApiError).logs });
    } finally {
      await onChanged();
    }
  }

  const running = step === "transfer" || step === "burn";
  const transferState = step === "transfer" ? "active" : a.status === "minted" && step !== "done" ? "todo" : "done";
  const burnState = step === "burn" ? "active" : step === "done" || a.status === "retired" ? "done" : "todo";

  return (
    <article className="grid grid-cols-[1fr_320px] gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold">{a.actionId}</h3>
          <span className="text-lg text-stone-600">
            {a.farmerName} · {a.county}
          </span>
        </div>
        <p className="text-lg">
          {a.practice} — <b>{a.estReduction} tCO₂e</b>{" "}
          <span className="rounded bg-stone-200 px-1.5 py-0.5 text-sm uppercase tracking-wide">estimate</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <AddressLink address={a.mint} />
          <TxLink sig={a.txMint} label="mint tx" />
        </div>

        {a.status !== "retired" && (
          <div className="grid grid-cols-[1fr_180px] gap-4 pt-2">
            <label>
              <span className="mb-1 block text-base font-semibold text-stone-700">Buyer</span>
              <input className={input} value={buyer} disabled={running} onChange={(e) => setBuyer(e.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-base font-semibold text-stone-700">Reporting year</span>
              <input
                className={input}
                value={reportingYear}
                disabled={running}
                onChange={(e) => setReportingYear(e.target.value)}
              />
            </label>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-base text-red-800">
            {error.message}
            {error.logs && <pre className="mt-2 whitespace-pre-wrap text-xs">{error.logs.join("\n")}</pre>}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center gap-4 rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
        <ol className="space-y-2">
          <StepRow label={`Transferring… (pays farmer ${paymentSol} SOL)`} state={transferState} />
          <StepRow label="Burning with memo…" state={burnState} />
        </ol>
        {a.status === "retired" ? (
          <div className="space-y-2">
            <p className="text-xl font-bold text-stone-900">✓ Retired for {a.buyer}, {a.reportingYear}</p>
            {a.paymentSol !== undefined && (
              <p className="text-base text-stone-600">Farmer paid {a.paymentSol} SOL in the sale transaction.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <TxLink sig={a.txTransfer} label="transfer" />
              <TxLink sig={a.txBurn} label="burn" />
            </div>
          </div>
        ) : (
          <button
            disabled={running || !buyer.trim() || !reportingYear.trim()}
            onClick={buyAndRetire}
            className="rounded-xl bg-emerald-700 px-5 py-4 text-xl font-semibold text-white hover:bg-emerald-800 disabled:bg-stone-300"
          >
            {running ? "Working…" : a.status === "sold" ? "Finish retiring" : "Buy and retire"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function ProcessorPanel({
  actions,
  onChanged,
  paymentSol,
}: {
  actions: ActionRecord[];
  onChanged: () => Promise<void>;
  paymentSol: number;
}) {
  // Session-local: keep cards that were retired here visible so the result stays on screen.
  const [seen, setSeen] = useState<string[]>([]);
  const open = actions.filter((a) => (a.status === "minted" || a.status === "sold") && a.mint !== "seed");
  const openIds = open.map((a) => a.actionId);
  if (openIds.some((id) => !seen.includes(id))) setSeen((s) => [...new Set([...s, ...openIds])]);
  const list = actions.filter(
    (a) => openIds.includes(a.actionId) || (seen.includes(a.actionId) && a.status === "retired"),
  );

  if (list.length === 0) {
    return (
      <p className="rounded-2xl bg-stone-50 p-8 text-center text-lg text-stone-500 ring-1 ring-stone-200">
        No minted actions for sale yet. Approve one in the Verifier tab.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {list.map((a) => (
        <ProcessorCard key={a.actionId} a={a} onChanged={onChanged} paymentSol={paymentSol} />
      ))}
    </div>
  );
}
