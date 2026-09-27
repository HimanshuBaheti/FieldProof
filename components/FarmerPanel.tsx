"use client";

import { useState } from "react";
import { FARMS, PRACTICES } from "@/lib/farms";
import { postJson } from "@/lib/client";
import type { ActionRecord } from "@/lib/types";

async function sha256File(file: File): Promise<string> {
  if (!crypto?.subtle) throw new Error("crypto.subtle unavailable — open the app via http://localhost");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Downscale to a small JPEG data URL for storage/thumbnails. The hash is of the original file. */
async function thumbnail(file: File, max = 360): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

const input =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30";
const label = "mb-2 block text-base font-semibold text-stone-700";

export default function FarmerPanel({
  actions,
  onChanged,
  goVerifier,
}: {
  actions: ActionRecord[];
  onChanged: () => Promise<void>;
  goVerifier: () => void;
}) {
  const [farmId, setFarmId] = useState(FARMS[0].farmId);
  const [practice, setPractice] = useState(PRACTICES[0].name);
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string>();
  const [hash, setHash] = useState<string>();
  const [hashing, setHashing] = useState(false);
  const [resubmitOf, setResubmitOf] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<ActionRecord>();

  const est = PRACTICES.find((p) => p.name === practice)!.estReduction;
  const rejected = actions.filter((a) => a.farmId === farmId && a.status === "rejected");

  async function onFile(file?: File) {
    setError(undefined);
    setImage(undefined);
    setHash(undefined);
    if (!file) return;
    setHashing(true);
    try {
      const [h, t] = await Promise.all([sha256File(file), thumbnail(file)]);
      setHash(h);
      setImage(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHashing(false);
    }
  }

  function startResubmit(a: ActionRecord) {
    setResubmitOf(a.actionId);
    setPractice(a.practice);
    setNote(a.note);
    setImage(undefined);
    setHash(undefined);
    setDone(undefined);
  }

  async function submit() {
    if (!hash) return;
    setBusy(true);
    setError(undefined);
    try {
      const rec = await postJson<ActionRecord>("/api/actions", {
        farmId,
        practice,
        note,
        evidenceHash: hash,
        evidenceImage: image,
        resubmitOf,
      });
      await onChanged();
      setDone(rec);
      setNote("");
      setImage(undefined);
      setHash(undefined);
      setResubmitOf(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={label}>Farm</label>
            <select
              className={input}
              value={farmId}
              onChange={(e) => {
                setFarmId(e.target.value);
                setResubmitOf(undefined);
                setDone(undefined);
              }}
            >
              {FARMS.map((f) => (
                <option key={f.farmId} value={f.farmId}>
                  {f.farmerName} · {f.county} · {f.farmId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Practice</label>
            <select className={input} value={practice} onChange={(e) => setPractice(e.target.value)}>
              {PRACTICES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-base text-stone-600">
              <span className="font-semibold text-stone-900">{est} tCO₂e</span>{" "}
              <span className="rounded bg-stone-200 px-1.5 py-0.5 text-sm uppercase tracking-wide">
                estimate
              </span>{" "}
              · season 2026
            </p>
          </div>
        </div>

        {rejected.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-base">
            {rejected.map((a) => (
              <div key={a.actionId} className="flex items-center justify-between gap-4">
                <span className="text-red-900">
                  <b>{a.actionId}</b> was rejected: {a.history.at(-1)?.note ?? "evidence insufficient"}
                </span>
                {resubmitOf === a.actionId ? (
                  <span className="shrink-0 font-semibold text-red-900">Resubmitting ↓</span>
                ) : (
                  <button
                    onClick={() => startResubmit(a)}
                    className="shrink-0 rounded-lg bg-white px-3 py-1.5 font-semibold text-red-800 ring-1 ring-red-300 hover:bg-red-100"
                  >
                    Resubmit with new evidence
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className={label}>Note</label>
          <textarea
            className={`${input} min-h-24`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done, where and when (e.g. 'Switched all CAN to protected urea on 60 ha')"
          />
        </div>

        <div>
          <label className={label}>Evidence photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-base text-stone-700 file:mr-4 file:rounded-xl file:border-0 file:bg-stone-800 file:px-5 file:py-3 file:text-base file:font-semibold file:text-white hover:file:bg-stone-700"
          />
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            disabled={!hash || busy}
            onClick={submit}
            className="rounded-xl bg-emerald-700 px-8 py-4 text-xl font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {busy ? "Submitting…" : resubmitOf ? `Resubmit ${resubmitOf}` : "Submit action"}
          </button>
          {!hash && !hashing && <span className="text-base text-stone-500">Add an evidence photo to submit.</span>}
        </div>

        {error && <p className="rounded-xl bg-red-50 p-4 text-base text-red-800">{error}</p>}
        {done && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 text-lg text-emerald-900 ring-1 ring-emerald-200">
            <span>
              ✓ <b>{done.actionId}</b> submitted for {done.farmerName}.
            </span>
            <button onClick={goVerifier} className="font-semibold underline underline-offset-4">
              Go to Verifier →
            </button>
          </div>
        )}
      </div>

      <aside className="rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200">
        <p className="mb-3 text-base font-semibold text-stone-700">Evidence preview</p>
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-stone-200 text-stone-500">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Evidence preview" className="h-full w-full object-cover" />
          ) : hashing ? (
            "Hashing…"
          ) : (
            "No photo yet"
          )}
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Evidence hash (SHA-256, computed in your browser)
        </p>
        <p className="mt-1 break-all font-mono text-sm text-stone-800">{hash ?? "—"}</p>
      </aside>
    </div>
  );
}
