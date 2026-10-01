import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { parseRecoveryConfig } from "./recovery-config.js";
import { runBscRecoveryOnce } from "./recovery-worker.js";

// Run under the operator's scheduler/service account, separate from browser APIs.
const connectionString = process.env.DATABASE_URL;
const configurationPath = process.env.NEXUS_RECOVERY_CONFIG;
if (!connectionString || !configurationPath) throw new Error("DATABASE_URL and NEXUS_RECOVERY_CONFIG are required.");
const config = parseRecoveryConfig(JSON.parse(await readFile(configurationPath, "utf8")));
const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000 });
try {
  const results = await runBscRecoveryOnce(pool, config);
  process.stdout.write(`${JSON.stringify(results)}\n`);
  if (results.some(result => result.outcome === "manual-review" || result.outcome === "unavailable")) process.exitCode = 2;
} catch {
  process.stderr.write("Recovery infrastructure failed; persisted legs remain available for retry.\n");
  process.exitCode = 1;
} finally { await pool.end(); }
