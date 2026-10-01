# Guarded EOA execution composition

Work items: P5.5/P7.1/P7.2/P7.5. Decision: [ADR 0029](../decisions/0029-production-eoa-evidence-orchestration.md).
Status: server library wired and PostgreSQL-tested; live deployment disabled.

## Setup and trusted inputs

Apply repository migrations through `migrate(pool)`, including 0008, to PostgreSQL.
Compose `createBStocksExecutionRuntime` from `src/execution/bstocks-runtime.ts`
with a PostgreSQL Pool, a `SessionStore` for the approved application origin,
operator-owned deployment/Market Gate policy, explicit instrument mapping revisions,
gas ceilings, an approval lifetime of at most five minutes, reviewed recovery config,
security review registry and the chosen public HTTPS RPC. The RPC must appear in
that recovery config; every tracked ERC20 needs matching decimals and reviewed
runtime/beacon code pins. Source or registry changes invalidate prior reviews.
The factory defaults `broadcastEnabled` to false. There is no new web trade endpoint.

Provide `BStocksProductionReviewPorts` for authenticated jurisdiction/country/product
sources and reviewed transfer controls, qualified economic share mapping, complete
portfolio valuations, underlying and token-provider events, an actual-size verified
venue quote, and exact-byte simulation against real balances/allowance. State overrides
or display multipliers do not qualify. Nullable or failed sources stay blocked. Built-in
public readers collect canonical quantity/control snapshots, Chainlink stock/settlement
prices, reviewed NYSE sessions, Binance trading status and full token-security evidence.
Free feed availability does not relax freshness or independent-review requirements.

The supplied independent-review registry is empty. Scanner coverage and known risks
remain unresolved. Completing this wiring does not authorize deployment broadcasting.
An operator must qualify all these sources and approve the explicit risk policy before
changing the deployment flag. The service rejects fixture/unverified portfolios;
production chain initialization and browser approval UX are separate remaining work.

## Exact sequence

1. Authenticate the EOA through the existing sign-in challenge. Sign-in establishes
   wallet control only. Load a reserved P4 accepted leg under the current active policy.
2. Call `prepare({sessionToken, planId, legIndex})`. A blocked result contains P5
   reasons and writes no review. A review contains an ID and exact EIP-712 approval,
   including the earliest original evidence/session expiry and nonce/gas/route bounds.
3. Present that approval to the owner and obtain both its EIP-712 signature and the
   separately signed exact EIP-1559 transaction. No private key enters Nexus.
4. Call `persist({sessionToken, reviewId, ownerSignature, rawSignedTransaction})`.
   Fresh P5 evidence, complete chain balances and nonce must still agree. The database
   atomically stores exact signed bytes and freezes the input reservation. Identical
   persistence is idempotent; no transaction has been sent by this operation.
5. With explicitly qualified deployment broadcasting enabled, call
   `broadcast({sessionToken, reviewId})`. It rechecks evidence and database authority,
   commits the unknown claim, then attempts one raw send. `accepted` does not prove a
   fill; `unknown` requires recovery. `already-claimed` never sends again.
6. Run the existing [BSC recovery worker](bsc-recovery-worker.md). It observes canonical
   receipts, proves complete tracked balances and raw receipt effects, and applies one
   finalized success/revert. A second run monitors without double-counting. A sell
   fill requires a new reconciled revision and plan before its contingent buy.

Reviews cannot renew their original lease. Changed price, policy, authorization,
source/control/review facts require a new review; receipt clocks or an unchanged
canonical head refresh alone do not force resigning. A committed send claim survives
restart even if no network-result record was written. Never release submitted holds,
blindly resend, replace a transaction or assume a timeout means rejection. Deep reorgs,
unknown nonce use and manual accounting repair keep execution frozen.

## Reproduce checks

Set `TEST_DATABASE_URL` for the local PostgreSQL test database, then run
`./scripts/check.sh`. The production execution fixtures use synthetic reviews,
prices, events, random wallets and mocked RPCs in isolated temporary schemas.
They test orchestration and recovery, not live token clearance or a real trade.
Never place session tokens, private keys or personal eligibility data in logs/memory.
