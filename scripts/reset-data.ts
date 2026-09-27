/** Restores data/actions.json to the 4 seeded demo actions. Usage: npm run reset */
import { resetToSeed } from "../lib/store";

resetToSeed().then(() => console.log("data/actions.json reset to seed data."));
