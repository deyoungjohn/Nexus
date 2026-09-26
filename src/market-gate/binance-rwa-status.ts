import type { TokenStatusEvidence } from "./evidence.js";

const endpoint = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/asset/market/status/ai";

/** A momentary venue status. It does not certify underlying-price freshness or issuer eligibility. */
export async function fetchBinanceRwaStatus(instrumentId: string, tokenAddress: string,
  fetcher: typeof fetch = fetch, now: () => Date = () => new Date()): Promise<TokenStatusEvidence | null> {
  if (!instrumentId || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddress)) return null;
  try {
    const url = new URL(endpoint);
    url.searchParams.set("chainId", "56");
    url.searchParams.set("contractAddress", tokenAddress.toLowerCase());
    const response = await fetcher(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const body = await response.json() as Record<string, unknown>;
    if (body.code !== "000000" || body.success !== true
      || !body.data || typeof body.data !== "object") return null;
    const data = body.data as Record<string, unknown>;
    if (typeof data.openState !== "boolean" || typeof data.reasonCode !== "string") return null;
    const observedAt = now();
    if (!Number.isFinite(observedAt.getTime())) return null;
    return { instrumentId, source: "binance-rwa-status", observedAt: observedAt.toISOString(),
      expiresAt: new Date(observedAt.getTime() + 30_000).toISOString(),
      state: data.openState === true && data.reasonCode === "TRADING" ? "open" : "unknown" };
  } catch { return null; }
}
