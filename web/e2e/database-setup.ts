import { Pool } from "pg";
import { createInstrument } from "../../src/domain/instrument.js";
import { CoordinatorStore } from "../../src/coordinator/store.js";
import { migrate } from "../../src/ledger/migrate.js";

export default async function setup() {
  const schema = process.env.NEXUS_E2E_SCHEMA;
  if (!schema || !/^nexus_browser_[a-f0-9]+$/.test(schema)) throw new Error("Isolated browser schema is required.");
  const admin = new Pool({ connectionString:process.env.TEST_DATABASE_URL });
  const pool = new Pool({ connectionString:process.env.DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  try {
    await migrate(pool);
    await new CoordinatorStore(pool).registerInstrument(createInstrument({ chainId:56,
      tokenAddress:"0x1111111111111111111111111111111111111111",issuerId:"fixture",productType:"share",underlyingId:"NVDA",ticker:"NVDA",decimals:18,
      quantityModel:"fixed",adapterVersion:"v1",sectorTags:["semi"],classificationVersion:"v1",statusSource:"fixture",referenceSource:"fixture",eligibilityRequirements:["fixture-only"] }));
  } catch (error) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); throw error; }
  finally { await pool.end(); }
  return async () => { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); };
}
