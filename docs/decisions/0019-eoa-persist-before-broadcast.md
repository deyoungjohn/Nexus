# ADR 0019: Persist signed EOA legs before broadcast

- Status: accepted for P7 offline implementation; production broadcast disabled
- Date: 2026-09-28
- Owners: Codex, under the owner's Phase 7 instruction

## Context

The P3 ledger freezes a submitted reservation but did not store signed bytes.
A crash between a wallet signature and a network call could lose the transaction
identity; treating a timeout as failure could then submit a second transaction.
EOA wallets can also use the same nonce outside Nexus. P7 must distinguish
signed, unknown, included, confirmed, reverted, replaced and reorged outcomes.

## Decision

Migration `0003_eoa_execution.sql` adds an EOA owner binding and default-paused
execution setting to portfolios and a one-leg-per-reservation record containing
the signed raw transaction, hash, authorization nonce, chain wallet nonce,
approval/evidence hashes, route bounds and receipt state. A unique wallet/chain
nonce index prevents a second Nexus leg using the same EOA nonce. The trusted
server binds the owner wallet only after separate challenge verification;
binding and pause changes increment the portfolio revision and invalidate
unsubmitted plans.

`persistSignedLeg` verifies the owner approval and exact EIP-1559 transaction,
locks the portfolio, checks owner, revision, plan and exact reservation, then
stores signed bytes and freezes the reservation in one database transaction.
`claimBroadcastOnce` rechecks fresh P5 evidence and the stored bytes, then
marks the leg unknown before returning those bytes once. A crash or ambiguous
network response leaves it unknown: no automatic second claim. No production
broadcaster is included in this increment.

A read-only BSC adapter checks canonical receipt blocks. Pure recovery logic
keeps timeout/nonce-use unknown and requires a configured block depth for
confirmation. A separate transactional reconciliation accepts only finalized
successful or reverted legs and a complete trusted chain balance snapshot.
Exact input, minimum output and unrelated-token changes are checked before
updating balances and portfolio revision. Replaced or reorged legs remain
frozen pending resolution. After each finalized leg, remaining held legs are
invalidated so a sell-funded buy needs a new snapshot and approval.
If a previously reconciled receipt later disappears or moves to a different
canonical block, the store marks the leg reorged, pauses the portfolio,
increments its revision and invalidates unsigned holds. The old balance
snapshot is no longer trusted; an operator must reconcile it manually before
execution resumes.

2026-09-29 extension: a read-only tracked-balance adapter pins native BNB and
registry-supplied ERC20 reads to one expected block/hash, checking canonicality
after every RPC state call. A bounded, canonical block scan can identify a
mined same-wallet/same-nonce replacement only with a matching receipt. Both
fail closed on incomplete evidence. A 32-block limit prevents unbounded RPC
work; older or unseen nonce consumption remains unresolved for manual/indexed
recovery. Neither adapter is wired to automatic reconciliation yet.

2026-09-29 recovery extension: the observation worker now obtains immutable
wallet/hash/nonce from the PostgreSQL leg instead of an external caller. The
balance-evidence builder checks the trusted asset list against persisted
holdings, requires native gas, reads only the receipt block, verifies exact
input/output deltas and rechecks canonicality before returning a candidate.
It does not authorize reconciliation or broadcast. Manual/untrusted balance
payloads cannot be treated as production chain evidence. Unpause is denied
while a submitted or unresolved leg remains, including a deep reorg.

## Consequences

The signed raw transaction is a broadcastable artifact and needs restricted
database access, encryption/retention policy and no logging. The owner ran
`./scripts/check.sh` against a disposable host PostgreSQL database on
2026-09-29 and reported 101 passing tests, including the P7 signed-leg store
suite. After workspace network access was enabled, Codex repeated the
PostgreSQL-backed check and independently passed 101 tests with no skips.
A trusted complete asset-set supplier and store wiring, broader nonce history,
reviewed policy and session wiring, manual recovery for external nonce use,
a guarded broadcaster and manual deep-reorg repair remain before P7 exit.
P5.5 bStocks evidence separately blocks live trading.

[ADR 0020](0020-eoa-receipt-effect-proof.md) narrows automatic reconciliation
to exact receipt effects for reviewed zero-native-value ERC20 legs. Its
PostgreSQL-tested proof requirement supersedes the earlier balance-only
candidate stage; production source, policy and repair gates remain open.
