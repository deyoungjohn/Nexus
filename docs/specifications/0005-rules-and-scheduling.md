# P6 rules and scheduling

Status: pure and durable offline increments implemented; trusted runtime sources and post-fill allocation refresh remain open.

`compileRule` accepts only the documented basket, price and earnings schemas.
The input is structured data, including when drafted by an LLM. Unknown fields,
instruments, signal names, noninteger base units, contradictory weights and
implicit earnings scope are rejected. A compiled rule has a content hash and
`READY_FOR_REVIEW` state. Activation requires that reviewed hash and has no
wallet authorization effect. Pausing and expiry prevent evaluation.

Basket schedules use an IANA timezone, daily or weekly local time and a bounded
absolute UTC window. A nonexistent DST wall time is skipped; an overlapping
wall time uses its first instant. Occurrence IDs bind rule ID, version and
local date. The durable plan store must claim the ID before planning to make
retries and restarts idempotent. Basket base-unit dust is allocated by largest
remainder and stable instrument ID. Too little to fund every positive target
suspends the occurrence; no trade is created.

Price rules use the instrument's registered source and a source timestamp, not
HTTP arrival alone. A matched threshold yields one intent per rule version.
Earnings rules require a fresh direct-source event, explicit company/allocation
scope and confirmed blackout. Uncertain, withdrawn, malformed or expired event
evidence suspends the rule. A suspended freeze rule must block dependent buys
when integrated with P4; an empty intent list is not permission to buy.

All P6 outputs are intents or restrictions. P4 must value, net and constrain
them; P5 must provide current evidence; P7 must request separate owner
approval. No rule module has a signing or submission dependency. Current tests
cover strict rejection, hash activation, exact basket split, duplicate IDs,
DST gap/overlap, midnight-spanning windows, source freshness and earnings
scope. PostgreSQL covers immutable versions, occurrence/P4 transactions and
allocation bounds. Open work: production source/worker wiring, allocation
refresh after P7 reconciliation and optional LLM drafting.

## Durable increment: P6.1–P6.4

Migration 0005 adds immutable rule versions, lifecycle state, reviewed-event
hashes, revision-pinned allocation quantities, evaluation batches and unique
rule occurrences. The store compiles against the persisted instrument registry
and requires the portfolio settlement denomination for every buy budget.
Activating a version requires the exact review hash; replacement, activation
and pause advance revision and invalidate unsubmitted plans. Submitted funds
must remain unresolved until P7 reconciliation.

Scheduling evaluates the persisted active versions under the same portfolio
lock used by P4. Rule intent conversion consumes explicitly denominated,
positive conservative valuation ratios. No missing price/mapping is invented.
Company freezes block all company buys; allocation freezes block buys from
that allocation's rule. Suspended or revision-shifted event controls fail
closed for dependent buys and reductions. Allocation reductions require
persisted revision-matched ownership quantities; all allocations for a token
must fit the confirmed whole-wallet holding.

Each actionable occurrence commits its P4 decision/reservations and claim in
one transaction. Failed mapping or coordination rolls back both; retry of the
same batch returns the persisted outcome, while changing its input conflicts.
Concurrent batches, restarts, same-version schedule retries and DST overlap
cannot duplicate an occurrence. A completely blocked occurrence is consumed
with its reason record. A freeze is never consumed as a one-time trigger.
Global execution pause prevents scheduled planning. These records still
require a fresh P5 pass and separate P7 authorization before any trade.

Acceptance: real PostgreSQL tests must cover version/hash/revision checks,
concurrent and restarted scheduling, rollback after a claim, recorded blocked
occurrences, event revision/freeze behavior and allocation coverage. P6.5
LLM-draft review remains optional; its input must use the same compiler.
