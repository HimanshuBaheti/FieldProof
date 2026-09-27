import FieldProofApp from "@/components/FieldProofApp";
import { isMockMode, paymentSol } from "@/lib/solana";

export const dynamic = "force-dynamic";

export default function Page() {
  return <FieldProofApp mock={isMockMode()} paymentSol={paymentSol()} />;
}
