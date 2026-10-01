# ADR 0025: Review and pin USDT/NVDAB raw recovery accounting

- Date: 2026-09-30
- Status: Accepted for P7.3/P7.5 recovery accounting only.

## Context

ADR 0024 supplied native-gas accounting and a trusted registry, while ERC20
entries remained unreviewed. The immediate task is to establish whether BSC
USDT and NVDAB can use ADR 0020's raw wallet-level Transfer/gas reconciliation.
Source review must distinguish NVDAB's display multiplier from raw balances
and must remain bound to the deployed execution path after beacon upgrades.

## Decision

Register these exact 18-decimal contracts for recovery:

- USDT: `0x55d398326f99059ff775485246999027b3197955`.
- NVDAB: `0x02fca66c1d1afb4e2a7884261eb00f63598a7436`.

The [dated source/receipt review](../integrations/2026-09-30-token-recovery-semantics.md)
and its JSON record document the evidence. USDT's Sourcify runtime match has
only an auxiliary compiler-metadata difference; its executable prefix matches.
NVDAB's proxy and implementation have exact runtime matches. Standard raw
balance updates and Transfer events are compatible with the existing verifier.
NVDAB's additional UI transfer/multiplier events are display evidence and never
count as another raw payment. Recovery does not apply the UI multiplier.

Extend the existing version-1 operator asset schema with an optional `contract`
review. Existing operator-reviewed fixture records remain compatible; the two
deployment entries include it and tests bind them to the dated evidence. Pin
USDT's entire runtime hash, and NVDAB's proxy, immutable beacon identity,
beacon runtime hash, implementation address/hash and raw decimals. Resolve
the beacon implementation using the same caller address as the verified proxy.
Read this identity at the receipt's block/hash before balance collection and
again after proof collection. A definite change raises
`RECOVERY_CONTRACT_CHANGED` and requires review. Unavailable/malformed/reorged
evidence returns no candidate, allowing whole-source fallback under ADR 0024.

The immutable beacon in the verified proxy runtime matters: an EIP-1967
storage-slot check alone does not establish the proxy's execution path. Pinning
its deployed runtime also binds that immutable address; the storage beacon
must agree and the unused direct-implementation slot must remain zero.

## Boundaries and consequences

The beacon source was unavailable via the attempted public verification and
explorer paths. Its observed bytecode and proxy-caller getter are pinned,
without claiming a complete review of upgrade authorization or all privileged
behavior. Receipt-block end state does not reconstruct every intra-block
implementation transition. Independent exact receipt effects and full raw
balance equality remain mandatory, and unresolved cases stay frozen.

This permits conditional reconciliation of already persisted legs whose
complete evidence passes. It does not live-register a P5 instrument, establish
reference-share entitlements, grant issuer eligibility, clear an unsupported
token audit, activate a policy or broadcast. Changes to compliance/pause policy
still affect new execution through P5.5; the reviewed token hooks make static
checks before the raw balance update. A later pause or display change is not
itself a reason to discard a correctly proved historical raw fill.

Tests cover runtime/decimals/beacon/implementation changes, malformed and
noncanonical source views, native/legacy compatibility, UI double-count
prevention, exact deployment registry/evidence binding and PostgreSQL guarded
USDT/NVDAB reconciliation with synthetic source bytecode. Live read-only
application guard checks separately verify the actual deployment hashes on
both configured RPCs at the sampled public buy and sell receipt blocks.
