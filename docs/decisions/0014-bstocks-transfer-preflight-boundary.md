# ADR 0014: Separate on-chain bStocks transfer controls from user eligibility

- Status: accepted for read-only P5.5c preflight; production eligibility open
- Date: 2026-09-27
- Owners: Codex (implementation); project owner (bStocks-first priority)

## Context

The exact NVDAB implementation's verified transfer hook consults a pause
manager and compliance contract. The compliance contract uses a per-token
blocklist and global sanctions list; the pause manager can pause one token or
all tokens. A direct V3 trade can involve the wallet, pool and router as token
transfer participants. A successful DEX quote does not check all transfer
restrictions, and a successful on-chain check does not establish a person's
jurisdiction or issuer eligibility.

## Decision

Add a separate read-only preflight for the currently validated direct NVDAB/
USDT PancakeSwap V3 pool and router. Require a recent bStocks quantity/control
snapshot and a separately reviewed control fingerprint. At that snapshot's
exact BSC block, reject a paused token and call `checkIsCompliant` for the
wallet, pool and router. Treat any revert, malformed response, stale/mismatched
block, changed reviewed control or pending multiplier as unavailable evidence.
The result describes **on-chain transfer controls only**; it cannot be cast as
P5 `EligibilityEvidence` or token-audit clearance.

The jurisdiction check needs a current issuer-supported country endpoint and
the intended user's own account/product eligibility. Binance's FAQ says a
public country endpoint exists but does not give its path in the reviewed
public text. Do not guess that endpoint or infer eligibility from a localized
webpage, VPN, quote, or a synthetic wallet preflight. P7 must repeat the
actual-wallet preflight immediately before submission and after each fill.

## Consequences

Nexus can now discover a current on-chain block/blacklist/pause failure before
trying an exact route, while retaining the existing fail-closed Market Gate.
The result is time-limited and can change at the next block. No private wallet
address is recorded in Git or shared memory. Geographic and account-level
eligibility, independent risk evidence, price policy and execution recovery
remain open.

Sources: [verified NVDAB implementation](https://sourcify.dev/server/v2/contract/56/0xcfed6c4679297ea4889f8183bc057b4a86c64e46?fields=all),
[verified compliance contract](https://sourcify.dev/server/v2/contract/56/0x53dba7aabde774787a1f57236b235567da8e14f4?fields=all),
[verified pause manager](https://sourcify.dev/server/v2/contract/56/0x9fc74be63f3589485b2423984a7a0557e0cf700a?fields=all),
[Binance bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38).
