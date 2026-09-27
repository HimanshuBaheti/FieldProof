export type SigKind = "seed" | "mock" | "real";

export function sigKind(sig: string): SigKind {
  if (sig === "seed") return "seed";
  if (sig.startsWith("MOCK_")) return "mock";
  return "real";
}

export const txUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const addressUrl = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;

export const shorten = (s: string, n = 6) => (s.length > n * 2 + 3 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
