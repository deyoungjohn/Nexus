# ADR 0020: Require receipt effects before EOA balance reconciliation

- Status: accepted for P7 offline recovery; production execution disabled
- Date: 2026-09-29
- Owners: Codex, under the owner's Phase 7 recovery instruction

## Context

A canonical receipt establishes inclusion and status; a same-block balance
snapshot establishes wallet holdings. Neither alone attributes the input,
output and native-gas changes to the tracked transaction. Other wallet activity
or a nonstandard token could make a plausible net delta misleading.

## Decision

For a supported zero-native-value EOA ERC20 swap, the trusted recovery adapter
reads the complete transaction receipt and all its logs from chain 56. It
requires the stored hash, sender, router, block and status, plus a canonical
block recheck. A pure verifier accepts only valid, ordered logs bound to that
transaction and block. It sums wallet-level `Transfer` movements emitted by
the exact input and output token contracts. The input net must equal the
negative exact input; the output net must equal the observed balance increase
and meet the signed minimum. The native decrease must equal `gasUsed ×
effectiveGasPrice`. A reverted transaction needs no logs, unchanged tracked
tokens and only that gas loss. Missing fees, missing/contradictory logs,
malformed topics, removed logs, nonzero native transaction value or changed
canonical block fail closed.

`reconcileBscLeg` obtains the persisted leg, finalized receipt, registry-
checked balances and receipt-effect proof before asking PostgreSQL to apply a
single atomic reconciliation. The store independently rechecks the proof
against its locked leg and balances and saves a SHA-256 digest of the
normalized proof. A timeout or incomplete RPC result leaves the submitted
reservation frozen. Later contradictory chain evidence still triggers the
existing deep-reorg pause.

## Consequences

This rule deliberately does not support fee-on-transfer, rebasing, or tokens
whose balance changes are not faithfully represented by ERC20 `Transfer`
events. Such a token requires a separate reviewed adapter and tests; a token
audit or issuer eligibility decision is still a separate P5.5 gate. Receipt
logs are transaction-local evidence, while the balance snapshot can include
other same-block activity; exact equality is therefore required rather than
assuming that a successful receipt proves the portfolio delta. The proof
digest supports later comparison but does not replace the chain receipt as
the source record. No production broadcaster or live trade is enabled.

Sources: [ERC-20 event requirements](https://eips.ethereum.org/EIPS/eip-20),
[Ethereum JSON-RPC receipt and log fields](https://ethereum.org/developers/docs/apis/json-rpc/).
