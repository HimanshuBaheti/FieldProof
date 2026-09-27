# FieldProof

**Verified farm climate actions, paid once, counted once.**

A single-page demo that walks one farm climate action through **verify → mint → sell → retire** with real Solana **devnet** transactions. It uses only the standard SPL Token program and the Memo program, with no custom program. All signing happens in Next.js API routes, so private keys never reach the browser and there are no wallet pop-ups.

| Step | What happens on-chain |
|---|---|
| Verifier approves | New mint (0 decimals, no freeze authority). One tx: mint **1** token to the farmer, **remove mint authority**, and memo `<actionId> \| <recordHash>` |
| Processor buys | One tx: the processor **pays the farmer `PAYMENT_SOL` (0.0001 SOL)** and the token moves farmer → processor; the farmer's empty token account is closed and its deposit returned to the issuer |
| Processor retires | Burn the token, close the processor's token account (deposit back to the issuer), plus memo `RETIRED \| <actionId> \| <buyer> \| <reportingYear>` |
| Resale attempt | Transfer fails for real; `getMint` shows **supply 0, mint authority none** |

The issuer is the only account you fund. It pays every fee and deposit. Before the first sale, it also tops up the farmer and processor wallets once (a wallet needs about 0.00089 SOL before it can receive a 0.0001 SOL payment). A full run then costs the issuer about **0.0016 SOL**: the mint account's deposit (~0.0015, which can't be recovered), plus fees and the 0.0001 SOL payment. 0.1 SOL is plenty for a demo day.

## Setup

```bash
npm install
cp .env.example .env.local           # starts in MOCK_MODE=true, works with no keys
npm run dev                          # http://localhost:3000
```

### Going live on devnet

```bash
npx tsx scripts/setup-keys.ts        # or: npm run setup-keys
```

1. Paste the printed `ISSUER_KEY`, `FARMER_KEY`, `PROCESSOR_KEY` lines into `.env.local`.
2. Fund the **issuer** address it prints with devnet SOL: paste it at https://faucet.solana.com (Devnet), or send 0.1 SOL from Phantom with **Settings → Developer Settings → Testnet Mode → Solana Devnet** switched on.
3. Set `MOCK_MODE=false` in `.env.local` and restart `npm run dev`. The header badge changes from "Mock mode" to "Solana devnet".

These are **throwaway devnet demo keys**. Never use them, or this app, on mainnet. The app refuses an `RPC_URL` containing "mainnet".

### MOCK_MODE

- `MOCK_MODE=true` (the default): no Solana calls. Each step waits ~1 s and returns fake `MOCK_…` signatures. The UI behaves the same, but links read "mock tx" instead of pointing to the explorer. Use this as a fallback if devnet or the Wi-Fi is flaky.
- `MOCK_MODE=false`: real devnet transactions with Solana Explorer links.

Restart the dev server after changing `.env.local`.

### Resetting demo data

Data lives in `data/actions.json`. `npm run reset` restores the 4 seeded Irish farms. Seeded transactions are marked `seed` and never shown as explorer links.

## Deploy to Vercel

1. `npx vercel login`, then `npx vercel link` in this folder (accept the defaults).
2. **Storage (recommended):** in the Vercel dashboard, open the project, go to **Storage → Create → Upstash Redis** (free plan) and connect it. This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically. Without Redis, the app falls back to `/tmp`, which works but can reset whenever Vercel starts a new instance.
3. **Environment variables:** in **Settings → Environment Variables**, add `RPC_URL`, `MOCK_MODE`, `PAYMENT_SOL`, `ISSUER_KEY`, `FARMER_KEY` and `PROCESSOR_KEY` with the same values as `.env.local`. `.env.local` itself is never uploaded (see `.vercelignore`).
4. `npx vercel --prod`

Use **Reset demo data** in the page footer (or `POST /api/reset`) to restore the seeded actions on the deployed site. The URL is public, so anyone who has it can press the buttons, which spends a little of the issuer's devnet SOL. Only share it for the demo.

## 90-second demo

1. **Farmer tab.** Pick *Mary Byrne · Kilkenny*, choose *Protected urea replacing CAN* (1.2 tCO₂e, estimate), add a note and upload a photo. The SHA-256 evidence hash is computed in the browser. Click **Submit action**, then **Go to Verifier →**.
   *(Short on time? Mary Byrne's action FP-2026-0041 is already waiting in the Verifier tab.)*
2. **Verifier tab.** Show the thumbnail, evidence hash and estimate. Click **Approve & mint**, which shows "Minting on Solana…" and then **✓ Minted** with explorer links. On the explorer, point out the memo and that mint authority is now *none*.
3. **Processor tab.** Keep buyer *Glanbia Mock Processor* and year *FY2026*, then click **Buy and retire**. It shows "Transferring…" and then "Burning with memo…", and the action is retired.
4. **Audit trail.** The action's timeline runs submitted → approved → minted → sold → retired, with a transaction link at each step. Click **Try to resell** to get the red message *"Resale failed: record already retired (supply 0, mint authority none)"* along with the actual program error.

Tip: `/?tab=verifier` or `/?tab=processor` opens a tab directly.

## Project layout

```
app/page.tsx                 page (reads MOCK_MODE on the server)
app/api/actions/route.ts     GET all, POST create / resubmit a rejected action
app/api/verify/route.ts      approve (recordHash + mint) or reject
app/api/retire/route.ts      transfer + burn (step: "transfer" | "burn" for UI progress)
app/api/resell/route.ts      resale attempt + getMint proof
components/                  Header, RoleTabs, Farmer/Verifier/Processor/Audit panels
lib/solana.ts                all Solana logic + mock mode
lib/store.ts                 data/actions.json read/write
lib/seed.ts                  seeded demo actions
scripts/setup-keys.ts        generate devnet keypairs
```

**Hashes.** The evidence hash is the SHA-256 of the original image file, computed in the browser. The record hash is the SHA-256 of canonical JSON `{actionId, farmId, practice, season, verifier, evidenceHash}`, computed on the server at approval. Reduction figures are fixed, practice-based **estimates**, not measurements.
