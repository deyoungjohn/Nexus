# ADR 0024: Operator recovery worker with atomic evidence provenance

- Date: 2026-09-30
- Status: Accepted for P7.3/P7.5 recovery wiring; live execution remains gated.

## Context

ADRs 0019/0020 persist signed legs and verify receipt effects, but existing
helpers require a caller to supply an RPC, finality depth and asset resolver.
The Chainlist survey identified usable anonymous historical sources. A
restartable deployment needs trusted configuration, automatic discovery,
source provenance and a concrete recovery command without creating a signing
or broadcast path.

## Decision

Use `runBscRecoveryOnce` and a separate operator CLI to poll authoritative
chain-56 signed-leg rows. This also monitors previously reconciled receipts;
an outbox acknowledgement alone would miss later deep reorgs. Batches rotate
by oldest attempt, including unfinished attempts left by a crash.

The versioned operator configuration selects an explicit finality depth,
ordered named HTTPS sources and reviewed exact asset IDs/decimals/event
semantics. The checked-in sources are Sentio then Blockmachine, based on the
dated empirical survey. The checked-in registry enables native gas accounting
only. ERC20 entries require a documented review; neither a ticker, provider
metadata, a public historical balance nor liquidity establishes event
semantics. Registration never grants P5 permission or issuer eligibility.
The 12-block setting preserves the existing P7 depth policy; it is not a BSC
fast-finality attestation and must be reviewed for deployment risk.

One PostgreSQL session advisory lock serializes workers per portfolio. Every
store transaction uses that same connection, so losing ownership also prevents
subsequent writes. No transaction spans RPC calls. A dead process releases its
lock; no lease expiration allows a still-running worker to count a fill twice.
Ordinary application mutations remain protected by existing portfolio locks,
revision checks and unresolved-submission guards.

On unavailable evidence, retry a complete observation/balance/receipt-proof
collection on the next source. Each candidate comes from one endpoint; never
combine its balances with another provider's receipt logs. Invalid economic
effects or an unreviewed asset stop the attempt for review rather than selecting
a more favorable response. A changed canonical receipt pauses even an
unreconciled portfolio. Already reconciled contradictions retain the existing
deep-reorg pause. Two gateways agreeing does not prove independent upstreams.

Migration 0007 records attempts with a configuration snapshot/hash and source
endpoint digests. Each observation and each reconciliation records named
source, block/hash and evidence in the same transaction as its state change.
The reconciliation includes its receipt-proof digest and complete balances.
Attempts contain no signed bytes, keys or URLs. Failed evidence provenance
rolls back the associated observation/fill. An unfinished attempt does not
determine whether a fill applied: committed leg and ledger records do.

The worker never claims, signs, submits or replaces a transaction. A consumed
nonce without its original receipt, replacements and reorgs require manual
review and remain frozen. No trusted broadcast-start height exists in the
current stored record, so the runtime deliberately does not invent a 32-block
scan start. Reviewed complete nonce history/manual repair and a guarded
broadcaster remain separate work.

## Consequences and verification

The source/registry/runtime wiring is implemented and deployable separately
from the web app. Operators must migrate their deployment database, review
token entries and schedule/monitor the command; unavailable anonymous RPCs
remain a production availability risk, without a retention guarantee or SLA.
No deployment scheduler or intended wallet trade was run in this session.

PostgreSQL tests cover whole-source fallback, atomic provenance rejection,
concurrent ownership, proof/registry rejection, missing-receipt ambiguity,
successful and reverted fills, inconsistent fallback receipts, deep reorg,
lost worker connection before apply, and failure after fill but before attempt
completion. Restarts preserve reservations or recognize the committed fill,
without a second revision/fill. Public source smoke evidence is separately
recorded; it does not claim an approved Nexus mainnet reconciliation.

Subsequent increment: [ADR 0025](0025-reviewed-bsc-raw-transfer-recovery.md)
adds USDT/NVDAB raw recovery registry entries and receipt-block code guards.
The native-only registry description above records the original wiring exit.
P5 token risk/eligibility and live execution remain separate gates.
