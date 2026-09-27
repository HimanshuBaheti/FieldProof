import type { Status } from "@/lib/types";

const STYLES: Record<Status, string> = {
  submitted: "bg-amber-100 text-amber-900 ring-amber-300",
  rejected: "bg-red-100 text-red-800 ring-red-300",
  approved: "bg-sky-100 text-sky-900 ring-sky-300",
  minted: "bg-emerald-100 text-emerald-900 ring-emerald-400",
  sold: "bg-indigo-100 text-indigo-900 ring-indigo-300",
  retired: "bg-stone-800 text-white ring-stone-800",
};

export default function StatusBadge({ status, large }: { status: Status; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide ring-1 ${
        STYLES[status]
      } ${large ? "px-4 py-1.5 text-base" : "px-3 py-1 text-sm"}`}
    >
      {status}
    </span>
  );
}
