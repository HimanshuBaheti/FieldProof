export type Status =
  | "submitted"
  | "rejected"
  | "approved"
  | "minted"
  | "sold"
  | "retired";

export interface HistoryEntry {
  status: Status;
  timestamp: string;
  txSig?: string;
  note?: string;
}

export interface ActionRecord {
  actionId: string;
  farmId: string;
  farmerName: string;
  county: string;
  practice: string;
  note: string;
  season: string;
  /** tCO2e — always an estimate, never a measured value */
  estReduction: number;
  evidenceHash: string;
  evidenceImage?: string;
  verifier: string;
  status: Status;
  recordHash?: string;
  mint?: string;
  txMint?: string;
  txTransfer?: string;
  /** one-time issuer top-up of farmer/processor wallets before the first sale */
  txTopUp?: string;
  /** SOL the buyer paid the farmer in the sale transaction */
  paymentSol?: number;
  txBurn?: string;
  buyer?: string;
  reportingYear?: string;
  history: HistoryEntry[];
}

export interface ResellResult {
  ok: false;
  message: string;
  error: string;
  logs?: string[];
  mintInfo: { supply: string; mintAuthority: string | null } | null;
}
