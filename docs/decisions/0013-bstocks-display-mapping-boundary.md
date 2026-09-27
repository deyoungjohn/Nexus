# ADR 0013: Keep bStocks display mapping separate from reference-share evidence

- Status: accepted for read-only P5.5b adapter; production mapping remains open
- Date: 2026-09-27
- Owners: Codex (implementation); project owner (bStocks-first priority)

## Context

The exact NVDAB BSC token implements BEP-677. Its raw BEP-20 amounts stay
constant while `uiMultiplier()` scales the amount shown by compatible wallets.
Binance describes the adjusted display amount as intended to reflect dividend
reinvestment and stock splits, subject to product documents, fees, rounding and
issuer discretion. The P5 `QuantityEvidence` ratio, however, represents
verified reference-share economic exposure used for portfolio limits and price
checks. An on-chain UI multiplier alone cannot prove that entitlement or a
fresh underlying price.

## Decision

Add a separate read-only bStocks adapter for the exact NVDAB contract. Pin
chain 56, block time, 18 raw decimals, required BEP-677 interfaces, current and
pending multiplier state, EIP-1967 beacon, implementation, code hashes and
beacon owner. The verified implementation also exposes mutable compliance and
pause-manager contracts and enumerable admin/issuer roles; pin their addresses,
code hashes, token pause state and role-set hashes at the same block. Any
inconsistent interface response fails closed. A scheduled
multiplier is visible to reviewers but cannot pass the current control-review
check. Keep raw token units canonical for balances, swap inputs and receipts;
apply the multiplier only to displayed units. A code/control change invalidates
a prior review, while a multiplier or schedule change invalidates the mapping
revision.

Do not convert this snapshot into P5 `QuantityEvidence` or label it a token
audit. Before production registration, verify the issuer's actual reference-
share entitlement, corporate-action handling and all mutable transfer/admin
controls, then bind that reviewed evidence to the P5 mapping. The reviewed
fingerprint must be supplied from a separately approved record; a caller
echoing a fresh snapshot is not an independent review.

## Consequences

Nexus can now inspect raw/display quantities and detect certain upgrades or
control-pointer changes without confusing them with trading approval. Changes
to the external compliance or pause contracts' internal policy may occur without
changing these hashes or the beacon owner, so a full control review and supported risk
policy remain open. This does not register a bStock, satisfy eligibility or
permit live execution.

Sources: [BEP-677](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md),
[Binance bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38),
[verified implementation source](https://sourcify.dev/server/v2/contract/56/0xcfed6c4679297ea4889f8183bc057b4a86c64e46?fields=all),
[ADR 0012](0012-bstocks-first-bsc-provider.md).
