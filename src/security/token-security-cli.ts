import { readFile } from "node:fs/promises";
import { collectBscTokenSecurity } from "./bsc-token-security.js";
import { parseTokenSecurityReviews, tokenSecurityFingerprint } from "./token-security.js";

try {
  const reviews = parseTokenSecurityReviews(JSON.parse(await readFile(
    process.env.NEXUS_TOKEN_SECURITY_REVIEWS ?? "config/token-security-reviews.json", "utf8")));
  const evidence = await collectBscTokenSecurity({ rpcUrl: process.env.NEXUS_SECURITY_RPC
    ?? "https://bsc.rpc.sentio.xyz", maxAgeMs: 60_000, reviews });
  console.log(JSON.stringify({ mode: "read-only", chainId: 56,
    reviewFingerprints: Object.fromEntries(evidence.map(e => [e.assetId,
      e.observation ? tokenSecurityFingerprint(e.observation) : null])), evidence },
    (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value, 2));
  // Blocking findings are a useful report, and a nonzero readiness result.
  if (evidence.some(item => item.state !== "clear")) process.exitCode = 2;
} catch {
  console.error("Token security collection failed; check trusted review/RPC configuration.");
  process.exitCode = 1;
}
