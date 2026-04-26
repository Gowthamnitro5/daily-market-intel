import { config } from "dotenv";
import path from "node:path";

export function register() {
  config({ path: path.join(process.cwd(), ".env.local"), override: true });
}
