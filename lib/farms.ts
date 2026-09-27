export interface Farm {
  farmId: string;
  farmerName: string;
  county: string;
  type: string;
}

export const FARMS: Farm[] = [
  { farmId: "IE-KK-0193", farmerName: "Mary Byrne", county: "Kilkenny", type: "Dairy" },
  { farmId: "IE-TP-0412", farmerName: "Seán Murphy", county: "Tipperary", type: "Beef" },
  { farmId: "IE-CK-0877", farmerName: "Aoife Kelly", county: "Cork", type: "Dairy" },
  { farmId: "IE-WX-0256", farmerName: "Declan Walsh", county: "Wexford", type: "Tillage & sheep" },
];

export const PRACTICES: { name: string; estReduction: number }[] = [
  { name: "Protected urea replacing CAN", estReduction: 1.2 },
  { name: "Low-emission slurry spreading (LESS)", estReduction: 0.8 },
  { name: "Clover-rich sward reseeding", estReduction: 1.5 },
];

export const SEASON = "2026";
export const VERIFIER = "Mock co-op advisor";
