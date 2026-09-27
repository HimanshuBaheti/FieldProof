import "server-only";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  AuthorityType,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createBurnCheckedInstruction,
  createMint,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const COMMITMENT = "confirmed" as const;
const DECIMALS = 0;

// ---------- config ----------

/** Mock mode unless MOCK_MODE is explicitly "false". */
export function isMockMode(): boolean {
  return (process.env.MOCK_MODE ?? "true").trim().toLowerCase() !== "false";
}

/** SOL the buyer pays the farmer in the sale transaction (PAYMENT_SOL, default 0.0001). */
export function paymentSol(): number {
  const v = parseFloat(process.env.PAYMENT_SOL ?? "0.0001");
  return Number.isFinite(v) && v >= 0 ? v : 0.0001;
}
const paymentLamports = () => Math.round(paymentSol() * LAMPORTS_PER_SOL);

function rpcUrl(): string {
  const url = process.env.RPC_URL || "https://api.devnet.solana.com";
  if (/mainnet/i.test(url)) throw new Error("Refusing to run against mainnet. Use a devnet RPC_URL.");
  return url;
}

let _conn: Connection | null = null;
function connection(): Connection {
  if (!_conn) _conn = new Connection(rpcUrl(), COMMITMENT);
  return _conn;
}

function loadKey(name: "ISSUER_KEY" | "FARMER_KEY" | "PROCESSOR_KEY"): Keypair {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} missing from .env.local. Run: npx tsx scripts/setup-keys.ts`);
  try {
    return Keypair.fromSecretKey(bs58.decode(raw.trim()));
  } catch {
    throw new Error(`${name} in .env.local is not a valid base58 secret key`);
  }
}

function keys() {
  return {
    issuer: loadKey("ISSUER_KEY"),
    farmer: loadKey("FARMER_KEY"),
    processor: loadKey("PROCESSOR_KEY"),
  };
}

// ---------- mock helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockId(): string {
  const bytes = new Uint8Array(40);
  crypto.getRandomValues(bytes);
  return "MOCK_" + bs58.encode(bytes).slice(0, 48);
}

// ---------- helpers ----------

function memoIx(text: string, signers: PublicKey[]): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: signers.map((pubkey) => ({ pubkey, isSigner: true, isWritable: false })),
    data: Buffer.from(text, "utf8"),
  });
}

async function send(tx: Transaction, signers: Keypair[]): Promise<string> {
  tx.feePayer = signers[0].publicKey; // issuer is always first, always pays
  return sendAndConfirmTransaction(connection(), tx, signers, { commitment: COMMITMENT });
}

/** Turn any Solana error into a readable message + program logs. */
export async function describeError(e: unknown): Promise<{ message: string; logs?: string[] }> {
  let logs: string[] | undefined;
  if (e instanceof SendTransactionError) {
    logs = e.logs ?? (await e.getLogs(connection()).catch(() => undefined)) ?? undefined;
  }
  const message = e instanceof Error ? e.message : String(e);
  if (/insufficient lamports|Attempt to debit an account but found no record of a prior credit/i.test(message)) {
    return {
      message: `Issuer has no devnet SOL. Fund it at https://faucet.solana.com. (${message})`,
      logs,
    };
  }
  return { message, logs };
}

// ---------- 1. mint on approve ----------

export async function mintActionToken(
  actionId: string,
  recordHash: string,
): Promise<{ mint: string; txMint: string }> {
  if (isMockMode()) {
    await sleep(1000);
    return { mint: mockId(), txMint: mockId() };
  }
  const { issuer, farmer } = keys();
  const conn = connection();

  // Fresh mint: issuer is mint authority, no freeze authority, 0 decimals.
  const mint = await createMint(conn, issuer, issuer.publicKey, null, DECIMALS, undefined, {
    commitment: COMMITMENT,
  });
  const farmerAta = await getOrCreateAssociatedTokenAccount(
    conn, issuer, mint, farmer.publicKey, false, COMMITMENT,
  );

  // One transaction: mint 1, then remove mint authority forever, plus the record memo.
  const tx = new Transaction().add(
    createMintToInstruction(mint, farmerAta.address, issuer.publicKey, 1),
    createSetAuthorityInstruction(mint, issuer.publicKey, AuthorityType.MintTokens, null),
    memoIx(`${actionId} | ${recordHash}`, [issuer.publicKey]),
  );
  const txMint = await send(tx, [issuer]);
  return { mint: mint.toBase58(), txMint };
}

// ---------- 2a. sale: buyer pays farmer, token farmer -> processor ----------

/**
 * A wallet can't exist with less than the rent-exempt minimum (~0.00089 SOL), so a
 * 0.0001 SOL payment to a brand-new farmer wallet would fail. The first time, the
 * issuer tops the farmer up to that minimum and gives the processor enough for a
 * few payments. Returns the top-up signature, or undefined if nothing was needed.
 */
async function ensureWalletsFunded(issuer: Keypair, farmer: PublicKey, processor: PublicKey) {
  const conn = connection();
  const rentMin = await conn.getMinimumBalanceForRentExemption(0);
  const pay = paymentLamports();
  const [farmerBal, processorBal] = await Promise.all([conn.getBalance(farmer), conn.getBalance(processor)]);

  const tx = new Transaction();
  if (farmerBal < rentMin) {
    tx.add(SystemProgram.transfer({ fromPubkey: issuer.publicKey, toPubkey: farmer, lamports: rentMin - farmerBal }));
  }
  if (processorBal < rentMin + pay) {
    const target = rentMin + pay * 10; // enough for ~10 demo sales
    tx.add(SystemProgram.transfer({ fromPubkey: issuer.publicKey, toPubkey: processor, lamports: target - processorBal }));
  }
  if (tx.instructions.length === 0) return undefined;
  return send(tx, [issuer]);
}

export async function transferToProcessor(
  mintAddr: string,
): Promise<{ txTransfer: string; txTopUp?: string; paymentSol: number }> {
  if (isMockMode()) {
    await sleep(1000);
    return { txTransfer: mockId(), paymentSol: paymentSol() };
  }
  const { issuer, farmer, processor } = keys();
  const mint = new PublicKey(mintAddr);
  const farmerAta = getAssociatedTokenAddressSync(mint, farmer.publicKey);
  const processorAta = getAssociatedTokenAddressSync(mint, processor.publicKey);

  const txTopUp = await ensureWalletsFunded(issuer, farmer.publicKey, processor.publicKey);

  const tx = new Transaction();
  if (paymentLamports() > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: processor.publicKey,
        toPubkey: farmer.publicKey,
        lamports: paymentLamports(),
      }),
    );
  }
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      issuer.publicKey, processorAta, processor.publicKey, mint,
    ),
    createTransferCheckedInstruction(farmerAta, mint, processorAta, farmer.publicKey, 1, DECIMALS),
    // Farmer's token account is now empty: close it and return its deposit to the issuer.
    createCloseAccountInstruction(farmerAta, issuer.publicKey, farmer.publicKey),
  );
  const txTransfer = await send(tx, [issuer, farmer, processor]);
  return { txTransfer, txTopUp, paymentSol: paymentSol() };
}

// ---------- 2b. burn with retirement memo ----------

export async function burnWithMemo(
  mintAddr: string,
  actionId: string,
  buyer: string,
  reportingYear: string,
): Promise<string> {
  if (isMockMode()) {
    await sleep(1000);
    return mockId();
  }
  const { issuer, processor } = keys();
  const mint = new PublicKey(mintAddr);
  const processorAta = getAssociatedTokenAddressSync(mint, processor.publicKey);

  const tx = new Transaction().add(
    createBurnCheckedInstruction(processorAta, mint, processor.publicKey, 1, DECIMALS),
    // Empty after the burn: close it and return its deposit to the issuer.
    createCloseAccountInstruction(processorAta, issuer.publicKey, processor.publicKey),
    memoIx(`RETIRED | ${actionId} | ${buyer} | ${reportingYear}`, [issuer.publicKey]),
  );
  return send(tx, [issuer, processor]);
}

// ---------- 3. resale attempt ----------

export async function attemptResale(mintAddr: string): Promise<{
  error: string;
  logs?: string[];
  mintInfo: { supply: string; mintAuthority: string | null };
}> {
  if (isMockMode()) {
    await sleep(1000);
    return {
      error:
        "Simulation failed. Message: Transaction simulation failed: Error processing Instruction 2: custom program error: 0x1.",
      logs: [
        "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]",
        "Program log: Instruction: TransferChecked",
        "Program log: Error: insufficient funds",
        "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: custom program error: 0x1",
      ],
      mintInfo: { supply: "0", mintAuthority: null },
    };
  }
  const { issuer, farmer, processor } = keys();
  const conn = connection();
  const mint = new PublicKey(mintAddr);
  const processorAta = getAssociatedTokenAddressSync(mint, processor.publicKey);
  const farmerAta = getAssociatedTokenAddressSync(mint, farmer.publicKey);

  // The processor tries to sell the (already burned) token on again. Its token accounts were
  // closed, so recreate them in the same tx: then the transfer fails on the balance itself.
  // The whole tx fails in simulation, so nothing is sent and nothing is paid.
  let error = "Unexpected: resale transaction succeeded";
  let logs: string[] | undefined;
  try {
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(issuer.publicKey, processorAta, processor.publicKey, mint),
      createAssociatedTokenAccountIdempotentInstruction(issuer.publicKey, farmerAta, farmer.publicKey, mint),
      createTransferCheckedInstruction(processorAta, mint, farmerAta, processor.publicKey, 1, DECIMALS),
    );
    await send(tx, [issuer, processor]);
  } catch (e) {
    ({ message: error, logs } = await describeError(e));
  }

  const info = await getMint(conn, mint, COMMITMENT);
  return {
    error,
    logs,
    mintInfo: {
      supply: info.supply.toString(),
      mintAuthority: info.mintAuthority ? info.mintAuthority.toBase58() : null,
    },
  };
}
