# ADR 0029 — Server-owned market evidence and guarded EOA execution

Date: 2026-10-01. Status: accepted for implementation; live qualification open.
Work items: P5.5c/P5.5d, P7.1/P7.2/P7.5.

## Context

The pure Market Gate, EIP-712 verifier, signed-leg store and historical recovery
worker existed independently. Connecting them requires trusted plan/policy/session
records and a last pre-send check. Client-supplied evidence cannot authorize a trade.
Fresh collection changes receipt clocks and block numbers even if the approval
facts remain unchanged; comparing every refreshed packet byte would force another
signature on every collection. A gas estimate also need not cover the transaction's
approved gas limit multiplied by its maximum fee.

## Decision

Add a server orchestration service that accepts session, plan/leg and review IDs,
then derives policy, instrument, accepted amount, complete balances and reservations
from PostgreSQL. Chain-backed mode, current revision and an unpaused owner-bound
portfolio are mandatory. Operator-owned deployment and recovery configuration hashes
are part of the approval context. Reviewed source ports remain explicit and nullable;
missing source data never becomes eligibility, share entitlement or security clearance.
The initial assembly supports USDT/NVDAB only and collects security at the canonical
quantity block. It requires qualified quote and real-state exact-byte simulation ports.

Persist an immutable review packet and its earliest source/session/quote expiry.
Immediately before signature persistence and broadcast, both that original packet
and a fully recollected current packet must pass P5. Compare all approval facts,
including source identity, economic ratios, prices, events, policy/access revisions,
route bytes and full security/control/review fingerprints. Receipt clocks and pure
head changes may differ. Source time cannot move backwards. bStocks adds a stable
`authorizationHash` containing the entire access policy and authorization revisions;
the original block-specific `accessHash` remains unchanged for existing P5 consumers.
Current simulated output must independently pass fair-price and portfolio limits
and the approved positive-fill buffer. The original evidence lease is never extended.
Changed approval facts require a new review and signatures. Quoted native fees must
cover the full approved gas ceiling, not merely an estimated receipt cost.

Session, policy, revision, pause, registry and reservation checks run again in the
same database transaction as persistence or the one-time broadcast claim. The claim
commits the exact signed bytes in unknown state before one network attempt. Timeout,
process loss or a failed result write cannot undo it or authorize a resend. RPC
acceptance is an observation, not confirmation. Pause/logout serialize against the
claim; once committed they cannot retract signed EOA bytes or the claimed send.
Already-submitted recovery remains independent of current trading eligibility/security.

Compose execution and recovery from the same reviewed public HTTPS source and
complete denomination/code registry. The runtime defaults broadcasting to false;
only trusted deployment configuration can enable it after qualification. No browser
endpoint, unattended signer, private-key custody, allowance mutation or replacement
transaction is added. Existing web flows continue to report trading disabled.

## Consequences and verification

Modular P5, ledger, session, execution and recovery interfaces remain separate.
Lower-level APIs remain compatible, including optional transaction-client parameters
for atomic composition. Synthetic PostgreSQL tests cover server-derived review,
expired/changed evidence, external state, authentication/policy races, exact signatures,
concurrent claims, restart/timeout/result-write loss and receipt-effect reconciliation
exactly once. These fixtures are not live review or mainnet eligibility evidence.
Qualified scanner coverage, independent current reviews, approved governance-risk
policy, entitlement/access/event/valuation sources and production route simulation
remain release gates. See [the execution runbook](../runbooks/eoa-execution.md).
