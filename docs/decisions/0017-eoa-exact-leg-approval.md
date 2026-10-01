# ADR 0017: Bind EOA approval to one verified leg

- Status: accepted for P7.1 synthetic implementation; live submission blocked
- Date: 2026-09-28
- Owners: Codex, under the owner's EOA-first direction

## Context

An EOA transaction signature authorizes chain calldata but carries no Nexus
portfolio revision, policy version or market-evidence reference. A free-standing
plan signature would also be unsafe if the later transaction changed router,
input, minimum output or fee limits. P5 provides a hash of a passing evidence
bundle, while P3 has durable plan revisions but no signed-transaction record.

## Decision

Use an off-chain EIP-712 owner approval for one plan leg, binding the plan and
policy, current P5 evidence hash, exact decoded route and input/output bounds,
EOA transaction nonce, expiry and gas ceilings. Require a separate signed
EIP-1559 transaction matching the approved chain, owner, router, calldata,
value and nonce. Rebuild the envelope from a fresh P5 pass and trusted current
plan/policy record before accepting either signature. A changed evidence hash
requires a new approval; no silent route substitution is allowed.

This module only verifies and returns a transaction hash. It has no signer,
network transport or broadcaster. P7.2 must persist the authorization nonce,
signed bytes and transaction hash before broadcast, then recover by hash and
wallet nonce. Until that is implemented and tested, no Nexus execution adapter
may submit a transaction. Production bStocks evidence remains a separate gate.

## Consequences

The owner will see two wallet signing actions for an initial leg: a typed
Nexus approval and the EVM transaction. A token allowance may require another
exact approval transaction. P8 should explain each action and avoid repeated
prompts when a safe persisted approval can be reused. This is an off-chain
application check, not contract-enforced EOA spending protection. An EOA may
send independent transactions outside Nexus; reconciliation must detect them.
