import { addressUrl, shorten, sigKind, txUrl } from "@/lib/explorer";

const pill = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-sm";

export function TxLink({ sig, label = "tx" }: { sig?: string; label?: string }) {
  if (!sig) return null;
  const kind = sigKind(sig);
  if (kind === "seed") return <span className={`${pill} bg-stone-100 text-stone-500`}>seed data</span>;
  if (kind === "mock")
    return (
      <span className={`${pill} bg-amber-50 text-amber-800`} title={sig}>
        mock tx
      </span>
    );
  return (
    <a
      href={txUrl(sig)}
      target="_blank"
      rel="noreferrer"
      className={`${pill} bg-emerald-50 text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:bg-emerald-100`}
      title={sig}
    >
      {label} {shorten(sig)} ↗
    </a>
  );
}

export function AddressLink({ address, label = "mint" }: { address?: string; label?: string }) {
  if (!address) return null;
  const kind = sigKind(address);
  if (kind === "seed") return <span className={`${pill} bg-stone-100 text-stone-500`}>seed mint</span>;
  if (kind === "mock")
    return (
      <span className={`${pill} bg-amber-50 text-amber-800`} title={address}>
        mock mint
      </span>
    );
  return (
    <a
      href={addressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className={`${pill} bg-emerald-50 text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:bg-emerald-100`}
      title={address}
    >
      {label} {shorten(address)} ↗
    </a>
  );
}
