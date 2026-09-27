"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionRecord } from "@/lib/types";
import AuditPanel from "./AuditPanel";
import FarmerPanel from "./FarmerPanel";
import Header from "./Header";
import ProcessorPanel from "./ProcessorPanel";
import RoleTabs, { type Role } from "./RoleTabs";
import VerifierPanel from "./VerifierPanel";

export default function FieldProofApp({ mock, paymentSol }: { mock: boolean; paymentSol: number }) {
  const [role, setRole] = useState<Role>("farmer");
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [loadError, setLoadError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/actions", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load actions (HTTP ${res.status})`);
      setActions(await res.json());
      setLoadError(undefined);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "farmer" || tab === "verifier" || tab === "processor") setRole(tab);
  }, [refresh]);

  const counts: Record<Role, number> = {
    farmer: 0,
    verifier: actions.filter((a) => a.status === "submitted" || a.status === "approved").length,
    processor: actions.filter((a) => (a.status === "minted" || a.status === "sold") && a.mint !== "seed").length,
  };

  return (
    <main className="mx-auto max-w-[1240px] space-y-8 px-8 py-8">
      <Header mock={mock} />
      <RoleTabs role={role} onChange={setRole} counts={counts} />

      {loadError && <p className="rounded-xl bg-red-50 p-4 text-lg text-red-800">{loadError}</p>}

      {/* Panels stay mounted so in-progress state survives tab switches. */}
      <section className="rounded-3xl bg-white/60 p-6 ring-1 ring-stone-200">
        <div hidden={role !== "farmer"}>
          <FarmerPanel actions={actions} onChanged={refresh} goVerifier={() => setRole("verifier")} />
        </div>
        <div hidden={role !== "verifier"}>
          <VerifierPanel actions={actions} onChanged={refresh} goProcessor={() => setRole("processor")} />
        </div>
        <div hidden={role !== "processor"}>
          <ProcessorPanel actions={actions} onChanged={refresh} paymentSol={paymentSol} />
        </div>
      </section>

      <AuditPanel actions={actions} />

      <footer className="pb-4 text-center text-sm text-stone-500">
        Reduction figures are practice-based estimates, not measurements. Demo on Solana devnet only.{" "}
        <button
          onClick={async () => {
            if (!confirm("Reset to the 4 seeded demo actions? On-chain transactions are not affected.")) return;
            await fetch("/api/reset", { method: "POST" });
            await refresh();
          }}
          className="underline underline-offset-2 hover:text-stone-800"
        >
          Reset demo data
        </button>
      </footer>
    </main>
  );
}
