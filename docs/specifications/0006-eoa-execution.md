# P7 EOA execution boundary

2026-09-30 P7.1 security hardening: the P5 hash now includes detailed security
reports for both route assets. Changed/expired/unsupported/absent token reviews
fail pre-leg revalidation; an otherwise clear revised review invalidates the
previous signature. Already-submitted transaction recovery remains under
historical accounting evidence and does not depend on current trading clearance.
See [ADR 0026](../decisions/0026-full-token-security-evidence.md).

Status: approval verification, signed-leg persistence, pure recovery and
read-only BSC receipt, tracked-balance and bounded replacement-scan adapters,
plus a store-derived observation worker and finalized balance-evidence builder
implemented. Receipt-effect proof and PostgreSQL recovery integration are
implemented for zero-native-value ERC20 swaps. Production recovery wiring now
adds an operator CLI, versioned registry/source configuration, named-source
whole-proof fallback, session ownership and atomic provenance (ADR 0024).
The supplied registry now contains native gas plus reviewed USDT/NVDAB raw
Transfer accounting with receipt-block runtime/beacon pins (ADR 0025). P5.5
security, eligibility and economic mapping remain separate gates.
2026-10-01: a server-owned production evidence collector and guarded EOA executor
now compose this boundary; broadcasting defaults to disabled and live qualification
remains open. See [ADR 0029](../decisions/0029-production-eoa-evidence-orchestration.md)
and [the execution runbook](../runbooks/eoa-execution.md).

For one exact leg, P5 must return `allowed` before Nexus can prepare an EOA
approval. The off-chain EIP-712 envelope binds portfolio, plan and leg IDs,
portfolio revision, trusted policy hash, P5 evidence hash, wallet, BSC chain,
router, input/output tokens, raw input and minimum output, exact route calldata,
transaction nonce, single-use authorization nonce, expiry and maximum gas
limits. Expiry cannot exceed the quote or route deadline. The owner signs the
envelope and separately signs the exact EIP-1559 transaction. Neither signature
establishes bStocks jurisdiction or issuer eligibility.

Before submission, the verifier requires a trusted current plan/policy metadata
record, an unpaused portfolio, an unexpired approval and a newly passing P5
gate. It rejects a changed revision, policy, evidence, route, signer, calldata,
chain, nonce or gas bound. It returns the signed transaction hash but has no
network or database access. A production caller must not interpret this as
permission to broadcast until the remaining P7 work below is complete.

Migration 0003 and `EoaExecutionStore` add a default-paused, one-EOA-per-
portfolio boundary. A verified signed EIP-1559 leg is persisted with its hash,
raw bytes, approval/evidence hashes, nonce and exact reserved input before any
network call. The reservation becomes submitted in the same transaction.
The one-time broadcast claim rechecks P5 and the stored bytes, then changes the
leg to unknown before returning those bytes. The guarded server broadcaster consumes that committed claim once.
A timeout cannot claim it again; acceptance does not mark the leg confirmed.

The read-only BSC adapter verifies chain 56, the receipt sender/hash and a
canonical block. Recovery distinguishes included, confirmed, reverted,
replaced, reorged and unknown, using an explicit finality depth. A finalized
success or revert can update portfolio balances only after the trusted full
chain snapshot passes exact input, minimum output and unrelated-token delta
checks. Replacements and reorgs stay frozen. Every finalized leg advances the
portfolio revision and releases unsubmitted holds; a confirmed sell requires
a newly reconciled buy plan. Pure tests cover the $75/$25 partial basket.
Reconciliation now requires native gas coverage, preserves every previously
tracked asset and accepts only the receipt's exact block/hash; an apparently
matching balance from a later block is insufficient.
If a reconciled receipt is later reorged, the store pauses the portfolio,
increments its revision and invalidates unsigned holds. An operator must
repair the balance snapshot before any further execution. Unpause now rejects
unresolved or submitted legs, including a deep reorg.

`fetchBscTrackedBalances` reads native BNB and every asset supplied by the
trusted portfolio registry at one specified chain-56 block. It verifies the
expected block hash before and after each `eth_getBalance`/ERC20 `balanceOf`
call and returns no snapshot on a changed or incomplete view. Its caller must
provide the complete Nexus-tracked asset set and a finalized, receipt-bound
block; this reader cannot discover arbitrary wallet tokens or by itself attest
that the asset list is complete. `fetchEoaBscObservation` can scan up to 32
canonical blocks from a trusted start height after the original receipt is
missing and the wallet nonce has advanced. It requires a same-wallet,
same-nonce transaction with a matching canonical receipt to identify a mined
replacement. An uncovered window, reorg or malformed RPC view returns no
observation; a covered window with no match remains unknown. The scanner does
not prove what occurred before its start height or resolve pending mempool
transactions. `loadRecoveryContext` supplies the wallet, transaction hash,
nonce, revision, receipt state and tracked balances from PostgreSQL.
`observeBscLeg` uses that identity for RPC observation and writes no state if
the RPC view is unavailable. `prepareBscBalanceEvidence` cross-checks a
server-side registry asset set against persisted balances and the output asset,
then reads the exact receipt block and rechecks finality/canonicality before
returning a balance candidate. It never updates the ledger. Receipt-effect
proof is now required before final reconciliation: the exact token contracts'
wallet-level `Transfer` events must explain input/output deltas, and receipt
gas must explain native balance loss. The adapter rejects missing or
contradictory logs, nonzero native transaction value and incomplete gas data.
`reconcileBscLeg` obtains that proof and candidate before the store applies
balances, releases the reservation and records a proof digest atomically.
This is limited to reviewed ERC20-style token behavior; provider token risk,
eligibility and policy remain separate gates. See [ADR 0020](../decisions/0020-eoa-receipt-effect-proof.md).

Open P7 gates: review production source retention/availability and extend
token event-semantics reviews beyond the registered USDT/NVDAB pair; cover
replacement history beyond the bounded RPC window or retain manual unresolved
recovery. Add reviewed manual repair, active-policy/session wiring and a
guarded broadcaster, with appropriate crash/reorg coverage. The app must
never submit raw bytes while these gates remain open. P5.5 must also supply
real bStocks eligibility, risk, quantity, price, event and route evidence.
[ADR 0019](../decisions/0019-eoa-persist-before-broadcast.md) records the
durable state decision.

P7 chain-evidence and recovery exit checks, in implementation order:

1. Derive the wallet, chain, finality depth, exact signed leg and full tracked
   asset set from trusted versioned portfolio/registry records. Never accept a
   browser-supplied balance list, block hash or replacement claim as authority.
2. Persist each recovery observation with its block number/hash and source;
   require a canonical finalized receipt and same-block balances before
   reconciling. Recheck that block immediately before the database transition
   and pause on any later contradiction.
3. Resolve a missing original receipt through complete nonce history or a
   documented manual path. A consumed nonce alone must remain unknown. Cover
   an external same-nonce replacement, a reverted replacement, gaps beyond the
   RPC scan window and inconsistent providers.
4. Exercise PostgreSQL crash points before broadcast claim, after claim but
   before network send, after send but before receipt write, and after fill but
   before reconciliation. Restarting must never issue a second claim or count
   the fill twice. Include deep reorg after reconciliation and operator repair.
5. Wire reviewed active policy, authenticated session and current P5 gate to
   each leg. Only then add a guarded broadcaster that sends the previously
   persisted exact bytes once, records the outcome, and leaves timeout unknown.
   Demonstrate one authorized small-value route with an independently checked
   receipt, balances, allowance, gas and portfolio revision. P5.5 must be
   complete for that provider before this live check.

Production recovery wiring is implemented by
[ADR 0024](../decisions/0024-production-recovery-worker.md) and documented in the
[runbook](../runbooks/bsc-recovery-worker.md). Migration 0007 persists attempts
and transactionally bound observation/fill provenance. Losing the session that
owns a portfolio recovery lock prevents further store writes. The runtime
never fabricates a nonce scan start or repairs a replacement/deep reorg.
PostgreSQL tests now cover source fallback, unsupported/invalid proof,
concurrency, revert, inconsistent/deep reorg and crashes before/after fill.
These close the runtime wiring increment, not all P7 or P5.5 exit gates.

USDT/NVDAB recovery registration follows
[ADR 0025](../decisions/0025-reviewed-bsc-raw-transfer-recovery.md). Optional
contract-review fields preserve earlier fixture APIs; the production entries
bind code/decimals and NVDAB's immutable-beacon path. The production worker
validates these at the exact receipt block before balances and after proof
collection. Definite code changes require review without seeking a favorable
backup; missing/malformed/reorged reads remain unavailable. Standard raw
Transfer events count once; BEP-677 UI events and multiplier notices never
change raw recovery quantities. No P5 risk/eligibility/economic evidence or
trade authorization is produced.


## Server-owned review and revalidation (2026-10-01)

Migration 0008 persists immutable reviews and network-result observations. Clients
submit IDs and signatures; plan/policy/registry/balances/amounts and deployment
configuration are read server-side. Session and execution authority are checked
again atomically at persistence and claim. The original signed evidence and a complete
new collection must both pass. Semantic equality allows only receipt-clock/head
refresh within the original evidence lease; changed approval facts invalidate it.
Current simulated fill must also pass fair-price and exposure bounds. Quoted native
cost covers maximum approved gas fees. Recovery uses historical receipt effects even
if current trading warnings subsequently block another leg. Lower-level pure/store
APIs remain available, but application trades must use the guarded server boundary.


2026-10-01 P5.5e/P8 follow-up: built-in canonical USDT/NVDAB route quote and
real-state simulation ports plus authenticated web exact-approval/persist/submit
are implemented. Route configuration is bound to execution policy; missing source
qualification/real funds or allowance still blocks. See [ADR 0030](../decisions/0030-bstocks-route-and-web-approval.md)
and [execution runbook](../runbooks/eoa-execution.md).
