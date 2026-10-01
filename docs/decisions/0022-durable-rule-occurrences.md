# ADR 0022: Commit rule occurrences with portfolio decisions

- Status: accepted; offline increment implemented
- Date: 2026-09-30
- Owners: Codex

## Decision

Persist immutable compiled P6 drafts, content hashes, reviewed-event revisions
and lifecycle state in PostgreSQL. Saving a replacement version disables the
previous version; activation binds a review hash covering the draft and its
event revision. Rule mutations advance the portfolio revision and invalidate
unsubmitted plans. They cannot rewrite a version or release submitted funds.

Evaluate all current active rules under the portfolio row lock. Map their
intents using explicitly supplied server-side valuation bounds and persisted
allocation quantities. Commit the evaluations, occurrence claims, P4 decision
and P3 reservations on one database client. A rollback leaves no occurrence
claim; a retry returns the recorded batch. Concurrent batches cannot purchase
the same scheduled occurrence twice. A policy-blocked occurrence is recorded
as skipped rather than retried under a different policy without owner review.

Active earnings freezes are reapplied on every batch. Unavailable or changed
event evidence blocks dependent buys and suspends reductions. Allocation
freezes apply to proposals from the named rule allocation; company freezes
apply to every instrument for that underlying. Allocation reductions require
persisted quantities matching the current portfolio revision. Reconciliation
must refresh allocations before their next use; missing/stale allocation data
cannot fall back to the whole company position.

## Boundary

This scheduling store creates proposals and reservations, not wallet authorization.
Valuation adapters remain trusted inputs requiring P5 verification before P7
execution. Execution pause blocks scheduling. P8 may display these records,
but its browser fixture acknowledgement cannot activate a persisted rule or
authorize a transaction. Existing P4/P7 interfaces remain compatible.
