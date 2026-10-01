import { createHash } from "node:crypto";
import { trustedReviewPublication } from "./review-publishers.js";
import type { SecurityReviewArtifact, TokenSecurityReview } from "./token-security.js";

/** Verify artifact integrity/provenance, not audit completeness or risk acceptance. */
export async function fetchSecurityReviewArtifact(input: {
  readonly review: Pick<TokenSecurityReview, "version" | "reviewId" | "publisherId" | "reportUrl" | "reportDigest">;
  readonly maxAgeMs: number; readonly now?: string;
}, fetcher: typeof fetch = fetch): Promise<SecurityReviewArtifact> {
  const r = input.review;
  let state: SecurityReviewArtifact["state"] = "unsupported", observedDigest: string | null = null;
  if (r.version === 2 && trustedReviewPublication(r.publisherId, r.reportUrl)) {
    try {
      const response = await fetcher(r.reportUrl, { redirect: "error", signal: AbortSignal.timeout(10_000) });
      const mime = response.headers.get("content-type")?.split(";")[0]?.trim();
      const length = response.headers.get("content-length");
      const limit = 4 * 1024 * 1024;
      if (!response.ok) state = "unavailable";
      else if ((response.url && response.url !== r.reportUrl)
        || !["application/pdf", "application/octet-stream"].includes(mime ?? "")
        || (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))) state = "unsupported";
      else if (!response.body) state = "unavailable";
      else {
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.length;
            if (bytes > limit) throw Error("Audit artifact exceeds bound.");
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        const body = Buffer.concat(chunks);
        if (body.subarray(0, 5).toString("ascii") !== "%PDF-") state = "unsupported";
        else {
          observedDigest = createHash("sha256").update(body).digest("hex");
          state = observedDigest === r.reportDigest ? "verified" : "mismatch";
        }
      }
      if (!response.bodyUsed) await response.body?.cancel();
    } catch { state = "unavailable"; }
  }
  const observedAt = input.now ?? new Date().toISOString();
  return { reviewId: r.reviewId, publisherId: r.publisherId ?? null, reportUrl: r.reportUrl,
    expectedDigest: r.reportDigest, observedDigest, state, observedAt,
    expiresAt: new Date(Date.parse(observedAt) + input.maxAgeMs).toISOString() };
}
