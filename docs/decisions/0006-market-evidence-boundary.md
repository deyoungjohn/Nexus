# ADR 0006: Keep market evidence and route decoding outside the coordinator

- Status: accepted
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (blueprint scope)

## Context

P4 accepts eligibility flags and valuation bounds supplied by a caller. P2
proved one supervised direct V3 route but did not establish production owner
eligibility, source-timestamped stock prices or a tested economic quantity
mapping for all candidates. A recent API receipt and a displayed wallet
quantity can each look current while referring to stale or differently scaled
economic data.

## Decision

Introduce a pure P5 market gate and pluggable read-only evidence adapters.
Require separate source/reference, exchange-session, token-status, issuer-event,
quote and simulation clocks. Require an explicit verified raw-to-share ratio
and settlement-token-to-valuation-unit conversion. Reject missing, stale,
unknown or unsupported evidence. For the first route decoder, support only
direct V3 `exactInputSingle`; decode recipient, tokens, input, minimum output
and deadline from calldata instead of trusting a quote's labels. Require
configured venue/router/fee tier and full-size P4 re-evaluation.

Use an evidence hash as the P5-to-P7 boundary. P5 does not change P4 storage
or imply owner approval. P7 must compare the hash, refresh chain/source state
and invalidate stale approvals and unsubmitted plans on quantity/event/route
changes. Live source adapters and the unsupported token-audit policy must be
decided with actual evidence before automation is enabled.

## Consequences

Existing P4 callers and ledger schemas remain compatible. Synthetic P5
fixtures can exercise the boundary, but cannot turn P2 candidates into an
executable allowlist. Opaque wallet quotes and non-V3 routes are blocked until
their exact calldata semantics have a tested decoder. A successful simulation
is evidence at one block, never a fill guarantee. See
[specification 0004](../specifications/0004-market-gate.md).
