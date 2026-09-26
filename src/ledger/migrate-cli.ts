import { Pool } from "pg";
import { migrate } from "./migrate.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for migrations.");

const pool = new Pool({ connectionString });
try {
  await migrate(pool);
  process.stdout.write("Nexus database migrations applied.\n");
} finally {
  await pool.end();
}
