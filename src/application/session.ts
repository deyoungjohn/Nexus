import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import type { Pool, PoolClient } from "pg";
import { identifier, requireInput } from "../domain/errors.js";

export const SESSION_SECONDS = 3600;
export async function applicationTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try { const result = await run(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
  } finally { client.release(); }
}
export function appOrigin(value: string): string {
  let url: URL | undefined;
  try { url = new URL(value); } catch { /* Report a bounded configuration error below. */ }
  requireInput(url !== undefined && url.origin === value && !url.username && !url.password
    && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))),
    "INVALID_APP_ORIGIN", "Configure an HTTPS origin, or a local HTTP development origin.");
  return url.origin;
}
export function requireOrigin(actual: string | null, expected: string): void {
  requireInput(actual === expected, "WRONG_ORIGIN", "Request origin does not match this workspace.");
}
function tokenHash(value: string): string {
  requireInput(/^[0-9a-f]{64}$/.test(value), "SESSION_REQUIRED", "Sign in to open saved records.");
  return createHash("sha256").update(value).digest("hex");
}
function validClock(now: Date): void {
  requireInput(Number.isFinite(now.getTime()), "INVALID_CLOCK", "A valid server clock is required.");
}
export interface WalletSession { readonly wallet: string; readonly expiresAt: string }

export class SessionStore {
  readonly origin: string;
  constructor(private readonly pool: Pool, origin: string) { this.origin = appOrigin(origin); }

  async challenge(wallet: string, now: Date): Promise<{ id: string; message: string; expiresAt: string }> {
    validClock(now);
    let checksum = "";
    try { checksum = getAddress(wallet); } catch { /* Invalid addresses fail closed. */ }
    requireInput(checksum !== "" && !/^0x0{40}$/.test(checksum), "INVALID_WALLET", "A valid EOA address is required.");
    const id = randomUUID(), nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(now.getTime() + 300_000).toISOString();
    const message = `${new URL(this.origin).host} wants you to sign in with your Ethereum account:\n${checksum}\n\nSign in to Nexus. This does not authorize a trade.\n\nURI: ${this.origin}\nVersion: 1\nChain ID: 56\nNonce: ${nonce}\nIssued At: ${now.toISOString()}\nExpiration Time: ${expiresAt}\nRequest ID: ${id}`;
    return applicationTransaction(this.pool, async client => {
      // Bound repeated challenges per wallet even when requests race.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`sign-in:${checksum.toLowerCase()}`]);
      const recent = await client.query<{ count: string }>("SELECT count(*) FROM wallet_challenges WHERE wallet=$1 AND created_at > $2", [checksum.toLowerCase(), new Date(now.getTime() - 300_000)]);
      requireInput(BigInt(recent.rows[0]!.count) < 10n, "SIGN_IN_RATE_LIMIT", "Too many sign-in requests. Try again in five minutes.");
      await client.query("INSERT INTO wallet_challenges(id,wallet,origin,message,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)", [id,checksum.toLowerCase(),this.origin,message,expiresAt,now]);
      return { id, message, expiresAt };
    });
  }

  async verify(id: string, signature: string, now: Date): Promise<WalletSession & { token: string }> {
    identifier(id); validClock(now);
    requireInput(typeof signature === "string" && /^0x[0-9a-fA-F]{130}$/.test(signature), "INVALID_SIGNATURE", "A valid EOA message signature is required.");
    return applicationTransaction(this.pool, async client => {
      const result = await client.query<{ wallet: string; origin: string; message: string; expires_at: Date; used_at: Date | null }>("SELECT wallet,origin,message,expires_at,used_at FROM wallet_challenges WHERE id=$1 FOR UPDATE", [id]);
      const row = result.rows[0];
      requireInput(row !== undefined && row.origin === this.origin && row.used_at === null && row.expires_at > now,
        "CHALLENGE_UNAVAILABLE", "Sign-in request expired or was already used. Request a new one.");
      let recovered = "";
      try { recovered = verifyMessage(row.message, signature).toLowerCase(); } catch { /* Fail closed. */ }
      requireInput(recovered === row.wallet, "INVALID_SIGNATURE", "Signature does not match the requested wallet.");
      const token = randomBytes(32).toString("hex"), expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
      await client.query("UPDATE wallet_challenges SET used_at=$2 WHERE id=$1", [id,now]);
      await client.query("INSERT INTO wallet_sessions(token_hash,wallet,origin,expires_at) VALUES($1,$2,$3,$4)", [tokenHash(token),row.wallet,this.origin,expiresAt]);
      return { token, wallet: row.wallet, expiresAt };
    });
  }

  async authenticate(token: string, now: Date, client?: PoolClient): Promise<WalletSession> {
    validClock(now);
    const load = async (db: PoolClient): Promise<WalletSession> => {
      const result = await db.query<{ wallet: string; expires_at: Date }>("SELECT wallet,expires_at FROM wallet_sessions WHERE token_hash=$1 AND origin=$2 AND expires_at>$3 AND revoked_at IS NULL FOR SHARE", [tokenHash(token),this.origin,now]);
      requireInput(result.rows[0] !== undefined, "SESSION_REQUIRED", "Your session ended. Sign in again.");
      return { wallet: result.rows[0].wallet, expiresAt: result.rows[0].expires_at.toISOString() };
    };
    return client ? load(client) : applicationTransaction(this.pool, load);
  }

  async logout(token: string, now: Date): Promise<void> {
    validClock(now);
    await this.pool.query("UPDATE wallet_sessions SET revoked_at=$3 WHERE token_hash=$1 AND origin=$2 AND revoked_at IS NULL", [tokenHash(token),this.origin,now]);
  }
}
