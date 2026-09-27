# ADR 0015: Review underlying and bStocks provider events

- Status: accepted for the P5.5c manual review process; live evidence remains open
- Date: 2026-09-27
- Owners: Codex (research and documentation); project owner (bStocks priority)

## Context

P5's manual issuer-event process checks the underlying company's investor
relations announcements. That alone can miss events specific to a tokenized
security. Binance's September 2026 NVDAB dividend notice specified a holder
snapshot, an on-chain multiplier adjustment and temporary conversion, deposit
and withdrawal pauses while spot trading continued. A route quote or open spot
market therefore does not prove that every bStocks service and entitlement is
unchanged.

## Decision

Before a bStocks leg, review direct announcements from both the underlying
company and the bStocks issuer or venue for the exact token. Capture each
source URL, retrieval time, revision or content digest, affected token, event
and effective times, and service impact. A conflicting, inaccessible or
unresolved provider notice blocks live use. A scheduled or changed on-chain
multiplier triggers a new review but does not replace the provider notice.

The current P5 `EventEvidence` binds one underlying issuer source and cannot
represent the additional provider event stream. The manual process documents
the requirement, but cannot clear the live gate until the evidence schema,
policy and tests bind both sources. A past dividend is not evidence that no
future provider event exists. P7 must invalidate an approval when either
source revision changes.

## Consequences

The bStocks-first path has an explicit provider-event evidence gap. Existing
offline P5 behavior and other provider adapters remain unchanged. The live
route stays disabled until this gap and the other P5.5/P7 gates are resolved.

## Sources

- [Binance NVDAB dividend notice](https://www.binance.com/en/support/announcement/detail/eba63ef89a68449088dd16725a2e5a0d)
- [Binance bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
- [BEP-677 specification](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md)
