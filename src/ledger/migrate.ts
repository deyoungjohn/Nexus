import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool, PoolClient } from "pg";

export async function migrate(pool: Pool, directory = resolve(process.cwd(), "migrations")): Promise<void> {
  const files = (await readdir(directory)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  const client = await pool.connect();
  try {
    // One migration process at a time per database; a migration and its record
    // commit together, so restart can safely replay the remaining files.
    await client.query("SELECT pg_advisory_lock(589442001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    for (const name of files) {
      const sql = await readFile(resolve(directory, name), "utf8");
      const sha256 = createHash("sha256").update(sql).digest("hex");
      const prior = await client.query<{ sha256: string }>("SELECT sha256 FROM schema_migrations WHERE name = $1", [name]);
      if (prior.rows[0]) {
        if (prior.rows[0].sha256 !== sha256) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await applyMigration(client, name, sql, sha256);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(589442001)");
    client.release();
  }
}

async function applyMigration(client: PoolClient, name: string, sql: string, sha256: string): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(name, sha256) VALUES ($1, $2)", [name, sha256]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
