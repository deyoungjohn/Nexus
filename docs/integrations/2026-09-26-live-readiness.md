# Live automation readiness — 2026-09-26

This records read-only integration findings for P5.5. It is not a production
allowlist or trade authorization. P5 remains fail-closed and no signer is wired.

| Gate | Evidence and implemented step | Remaining release condition |
|---|---|---|
| Underlying reference | Pyth Pro's documented `feedUpdateTimestamp` is the price-origin clock; `timestampUs` may carry a prior price. Stable regular-session IDs observed from its public symbol directory: NVDA 1314, AMD 949, AAPL 922. `pyth-pro.ts` converts mantissa/exponent to exact 18-decimal USD units and returns null on malformed/non-regular packets or provider errors. | Provision a server-side Pyth Pro key, verify one authenticated response and feed terms during a regular session, then test freshness with P5 policy. The key is not in project memory. |
| Economic quantity | Ondo publishes BSC SyntheticSharesOracle `0xF4Fd8a1B412633e10527454137A29Db7Aa35F15e`. `ondo-quantity.ts` pins one BSC block, checks chain 56, reads `getSValue` plus `assetData`, and rejects an active/scheduled pause. Read-only live probes passed for three P2 candidate token addresses. | Recheck issuer contract address and decimals at activation; refresh ratio and mapping revision with each quote/recheck. Candidate tokens are not yet registered for execution. |
| Owner and transfer eligibility | Ondo eligibility and secondary-market restrictions require a non-prohibited person and permitted transfers; a prior supervised DEX fill does not establish a standing determination. | Owner confirms eligibility for the intended wallet and venue without storing identity details; implement a dated, revocable attestation source. No response is assumed. |
| Exchange session and issuer events | P5 checks a dated America/New_York session and fresh issuer-event evidence. | Maintain an authoritative holiday/early-close calendar and manual issuer IR review with source/revision/recheck process; no automation from an unreviewed event feed. |
| Settlement valuation | P5 requires fresh lower/upper USDT-to-USD evidence for cash and proceeds. | Select and verify a source with timestamps, conservative depeg bounds and outages. |
| Token risk | Binance token audit returned unsupported for NVDAon in P2. Ondo's published contract audits are useful provenance but do not satisfy a token-specific `clear` result. | Obtain supported token-risk evidence or make an explicit, reviewed policy change with bounded scope. Current gate blocks `unsupported`. |
| Route and lifecycle | P2 proved one owner-approved 5-USDT direct-V3 trade and receipt. P5 can decode that route class, simulate it and hash evidence. | P7 must persist exact approval, revalidate each leg, record transaction identity, deduplicate submission and reconcile mined/replaced/reorged outcomes. No application execution path exists. |

Read-only BSC observation at blocks 124179311–124179324: NVDAon
`1.000932054247057497`, AMDon `1`, AAPLon `1.003376073740221058`
reference shares per raw whole token. All oracle pause flags and pending pause
metadata were zero at those blocks. These are snapshots, not cached constants.
The NVDAon ratio differs from P2's earlier public display value, demonstrating
why a fresh mapping revision matters.

Primary references: [Ondo contract addresses](https://docs.ondo.finance/addresses),
[Ondo token and quote pricing](https://docs.ondo.finance/ondo-stocks/token-and-quote-pricing),
[Ondo eligibility](https://docs.ondo.finance/ondo-stocks/eligibility),
[Ondo secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions),
[Ondo oracle audit](https://docs.ondo.finance/pdf/GM-SyntheticShares-Cantina-11-18-2025.pdf),
[Pyth Pro payload](https://docs.pyth.network/price-feeds/pro/payload-reference),
[Pyth Pro REST authentication](https://docs.pyth.network/price-feeds/pro/api/rest),
[Pyth Pro symbol directory](https://pyth.dourolabs.app/v1/symbols?asset_type=equity).
