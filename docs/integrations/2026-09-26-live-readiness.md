# Live automation readiness — 2026-09-26

This records read-only integration findings for P5.5. It is not a production
allowlist or trade authorization. P5 remains fail-closed and no signer is wired.
This table records the earlier Ondo candidate path. The owner has since made
xStocks the first live-provider target; its separate current findings and
remaining gates are in the [xStocks BSC matrix](2026-09-26-xstocks-bsc.md).

| Gate | Evidence and implemented step | Remaining release condition |
|---|---|---|
| Underlying reference | `chainlink-bsc.ts` reads Chainlink's published BSC NVDA/USD `0xea5c2Cbb5cD57daC24E26180b19a929F3E9699B8` and AAPL/USD `0xb7Ed5bE7977d61E83534230f3256C021e0fae0B6` proxies at a pinned block. It checks chain, block number/age, description, decimals, round validity and `updatedAt`; weekend probes decoded both Friday rounds and rejected them at a 60-second freshness limit. | Verify freshness and quote deviation during a regular NYSE session; accept that a 24-hour feed heartbeat can leave periods blocked. No BSC AMD/USD feed was listed in the published directory at this review, so AMDon is excluded from the two-asset executable MVP. Pyth remains dormant, not required. |
| Economic quantity | Ondo publishes BSC SyntheticSharesOracle `0xF4Fd8a1B412633e10527454137A29Db7Aa35F15e`. `ondo-quantity.ts` pins one BSC block, checks chain 56, reads `getSValue` plus `assetData`, and rejects an active/scheduled pause. Read-only live probes passed for three P2 candidate token addresses. | Recheck issuer contract address and decimals at activation; refresh ratio and mapping revision with each quote/recheck. Candidate tokens are not yet registered for execution. |
| Owner and transfer eligibility | Ondo eligibility and secondary-market restrictions require a non-prohibited person and permitted transfers; a prior supervised DEX fill does not establish a standing determination. `owner-attestation.ts` now creates and verifies 24-hour EIP-712 declarations bound to wallet, token, router, venue and side; a local challenge/verify CLI is available. No identity information is retained in Git. See [the owner procedure](2026-09-26-eligibility-risk.md) and [ADR 0010](../decisions/0010-owner-attestation-and-token-risk.md). | Obtain the owner's actual signed declaration near activation, persist revocations durably, bind its verification to `EligibilityEvidence`, and independently verify current transfer/venue permission. A conversation statement cannot populate live evidence. |
| Exchange session | `nyse-calendar.ts` fetches the official NYSE holiday/early-close section, requires an exact reviewed digest, and issues five-minute dated evidence for 2026–2027. Live read-only probes identified 2026-09-26 as closed, 2026-09-28 as regular, Thanksgiving as a holiday and 2026-11-27 as a 13:00 early close. | Review any publisher revision before updating the digest; emergency closures and stock-specific halts need separate evidence. P5 currently blocks early-close dates unless policy is set for the shorter session. |
| Issuer events | P5 requires issuer IR provenance, revision and confirmation. The [manual review runbook](../runbooks/issuer-event-review.md) identifies official NVDA/AAPL sources, dated records, rechecks and fail-closed uncertainty. Dynamic or inaccessible pages on 2026-09-26 were not interpreted as no event. | Obtain a current reviewed issuer-event record before a live leg and recheck its revision; no unreviewed or inferred event state may authorize a plan. |
| Settlement valuation | `chainlink-bsc.ts` reads the standard 8-decimal BSC USDT/USD proxy `0xB97Ad0E74fa7d920791E90258A6E2085088b4320`, verifies round time, applies an uncertainty band and explicit peg-deviation ceiling, and now emits P5's `USD-18` unit. A read-only mainnet probe passed illustrative 20-minute age/50-bp uncertainty/100-bp peg bounds; 60-second age and 2% depeg fixtures block. | Review production feed-age, uncertainty and peg thresholds, and test provider outage behavior with P5's full evidence bundle. The published heartbeat is 900 seconds. |
| Token status | `binance-rwa-status.ts` reads the public chain-56 token status, treats `openState=true` with `reasonCode=TRADING` as a 30-second venue status, and blocks other/unknown states. Read-only NVDAon/AAPLon probes succeeded on 2026-09-26 while the separate stock session was closed. | Recheck immediately before each leg and confirm independent issuer/chain restrictions; a public venue status is momentary and does not establish transfer eligibility. |
| Token risk | Repeated Binance requests returned `hasResult=false`, `isSupported=false` for both tokens while the same endpoint supported BSC USDT. GoPlus returned proxy metadata but no honeypot, blacklist, whitelist, transfer-pause or mintability determinations. A pinned-block adapter now identifies both tokens' common EIP-1967 beacon and implementation hashes; it does not classify code as safe. See [the investigation](2026-09-26-eligibility-risk.md). | Obtain supported token-risk evidence or explicitly review a bounded exception mapped to exact runtime code, current controls and route simulation. No exception is active; P5 blocks `unsupported`. |
| Route and lifecycle | P2 proved one owner-approved 5-USDT direct-V3 trade and receipt. P5 can decode that route class, simulate it and hash evidence. | P7 must persist exact approval, revalidate each leg, record transaction identity, deduplicate submission and reconcile mined/replaced/reorged outcomes. No application execution path exists. |

Read-only BSC observation at blocks 124179311–124179324: NVDAon
`1.000932054247057497`, AMDon `1`, AAPLon `1.003376073740221058`
reference shares per raw whole token. All oracle pause flags and pending pause
metadata were zero at those blocks. These are snapshots, not cached constants.
The NVDAon ratio differs from P2's earlier public display value, demonstrating
why a fresh mapping revision matters.

Read-only BSC Chainlink observation on 2026-09-26: NVDA/USD was $225.30
with provider `updatedAt=2026-09-25T19:55:00Z`; AAPL/USD was $340.745 with
`updatedAt=2026-09-25T19:40:29Z`. Both are weekend-stale for live execution.
The USDT/USD feed returned a source timestamp and a bounded valuation under a
20-minute age limit. These probes validate decoding, not a regular-session
market gate pass. The MVP reference set is NVDAon and AAPLon; no candidate is
registered for execution yet.

Primary references: [Ondo contract addresses](https://docs.ondo.finance/addresses),
[Ondo token and quote pricing](https://docs.ondo.finance/ondo-stocks/token-and-quote-pricing),
[Ondo eligibility](https://docs.ondo.finance/ondo-stocks/eligibility),
[Ondo secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions),
[Ondo oracle audit](https://docs.ondo.finance/pdf/GM-SyntheticShares-Cantina-11-18-2025.pdf),
[Pyth Pro payload](https://docs.pyth.network/price-feeds/pro/payload-reference),
[Pyth Pro REST authentication](https://docs.pyth.network/price-feeds/pro/api/rest),
[Pyth Pro symbol directory](https://pyth.dourolabs.app/v1/symbols?asset_type=equity).
The calendar source is the [NYSE holidays and trading-hours page](https://www.nyse.com/markets/hours-calendars).
The current no-subscription source decision uses the
[Chainlink BSC feed directory](https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json)
and [Chainlink feed integration guidance](https://docs.chain.link/data-feeds/using-data-feeds).
The [Pyth Core upgrade notice](https://www.pyth.network/blog/the-pyth-core-upgrade)
explains why Core Hermes is not a free production fallback.
Risk-source findings extend the [P2 integration matrix](2026-09-25-phase-2.md);
unknown proxy fields follow [GoPlus's token-security response guide](https://docs.gopluslabs.io/reference/response-details).
