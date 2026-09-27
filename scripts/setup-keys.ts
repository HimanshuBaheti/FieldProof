/**
 * Generates three DEVNET-ONLY demo keypairs for FieldProof.
 * Usage: npx tsx scripts/setup-keys.ts
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const issuer = Keypair.generate();
const farmer = Keypair.generate();
const processor = Keypair.generate();

console.log("\n# ---- paste into .env.local (devnet demo keys only — never use on mainnet) ----");
console.log("RPC_URL=https://api.devnet.solana.com");
console.log("MOCK_MODE=false");
console.log(`ISSUER_KEY=${bs58.encode(issuer.secretKey)}`);
console.log(`FARMER_KEY=${bs58.encode(farmer.secretKey)}`);
console.log(`PROCESSOR_KEY=${bs58.encode(processor.secretKey)}`);
console.log("# ---------------------------------------------------------------------------\n");
console.log("Public addresses:");
console.log(`  issuer    ${issuer.publicKey.toBase58()}   <- fund this one`);
console.log(`  farmer    ${farmer.publicKey.toBase58()}`);
console.log(`  processor ${processor.publicKey.toBase58()}\n`);
console.log("Only the issuer needs SOL (it pays every fee and rent). Fund it with ~1-2 devnet SOL at:");
console.log("  https://faucet.solana.com  (choose Devnet, paste the issuer address)\n");
