# Run the BSC recovery worker

P7.3/P7.5; [ADR 0024](../decisions/0024-production-recovery-worker.md) and
[ADR 0025](../decisions/0025-reviewed-bsc-raw-transfer-recovery.md).
This is a headless recovery command for existing signed EOA legs. It reads
the chain and updates verified ledger records. It cannot trade or broadcast.

## Configure and run

Privately set `DATABASE_URL` to the intended application database. Apply the
new immutable migration through the existing migration command:

```bash
npm run db:migrate
export NEXUS_RECOVERY_CONFIG="$PWD/config/bsc-recovery.json"
npm run recovery:once
```

For a deployment, build once and invoke `node dist/execution/recovery-cli.js`
from the deployment directory under the operator's scheduler/service account.
The command handles up to 25 oldest-checked legs each invocation and emits
JSON outcomes. Pick a polling interval/batch capacity for the portfolio count
and actual RPC latency; measure throttling and processing lag. Concurrent
workers skip a portfolio already being observed. They also monitor completed
receipts, so continued polling is needed to detect later reorgs.

The repository configuration names Sentio and Blockmachine and sets a
12-block confirmation depth. Review that depth for the deployment; a depth
threshold does not establish protocol fast finality. The current anonymous
endpoints have empirical historical capability, not a promised SLA or retention
contract. Endpoint failures leave reservations frozen and generate alerts;
do not increase risk limits to make evidence pass.

## Review the asset registry

The supplied registry contains native BNB, USDT and NVDAB, with reviewed raw
Transfer accounting and receipt-block code pins for the two tokens. See the
[dated review](../integrations/2026-09-30-token-recovery-semantics.md). This allows
conditional recovery settlement when the entire receipt/balance proof passes;
it does not grant P5 trading permission. Any other tracked/output token still
requires a separate review.

For each asset, document the exact chain-56 contract and raw decimals, proxy/
upgrade/control implications and wallet-level transfer accounting. Verify
that standard `Transfer(address,address,uint256)` net amounts explain raw
balance changes without rebasing, fee-on-transfer or unexplained events.
For stocks, this review is separate from reference-share/display conversion,
issuer access, price policy and token-risk review. Create a durable review
record and update the operator config with exact raw denomination and code
identity pins. The existing USDT entry shows the runtime-review shape:

```json
{
  "assetId": "eip155:56/erc20:0x55d398326f99059ff775485246999027b3197955",
  "decimals": 18,
  "semantics": "erc20-transfer-net",
  "review": "usdt-raw-transfer-2026-09-30",
  "contract": {
    "kind": "runtime",
    "codeHash": "0x97a48aa4c129657440dafdacd4c836389734d28cc4a0ca7403e68da660a74a59"
  }
}
```

NVDAB additionally pins its proxy runtime, immutable beacon identity/code
hash, implementation address/code hash and unused direct implementation slot.
The guard resolves the beacon using the proxy caller and rechecks raw decimals
at the exact receipt block before and after proof collection. Missing evidence
allows whole-source fallback; `RECOVERY_CONTRACT_CHANGED` requires a fresh
review and keeps the reservation frozen. Retain all deployment pins; optional
legacy four-field records exist for compatible operator fixtures, not as a
replacement for this production review. Update `registryVersion` whenever the
review/configuration changes. Unknown
assets, wrong decimals, incomplete tracked coverage and unsupported semantics
block settlement. The worker derives the wallet/hash/nonce/input/output from
persisted signed-leg records, never from browser parameters. The registry
does not discover arbitrary external wallet holdings.

## Outcomes and evidence

- `reconciled`: exact finalized receipt effects and same-block complete
  balances applied once; reservation consumed for success or released for
  revert, and revision advanced.
- `monitored`: previously applied receipt remains canonical; no repeated fill.
- `waiting`: signed-but-not-submitted, pending or insufficient confirmation;
  the worker never sends signed bytes.
- `unavailable`: required RPC evidence is unavailable even after available
  fallback attempts; preserve the reservation and alert the operator.
- `manual-review`: unsupported/contradictory evidence, consumed-nonce ambiguity,
  replacement or reorg. Preserve the freeze and investigate.
- `busy`: another worker owns the portfolio; retry on the next scheduled run.

Exit 0 means the batch completed without an unavailable/manual outcome, not
that all legs finalized. Exit 2 means operator attention is needed. Exit 1
means an infrastructure failure. A configuration/startup failure also exits
nonzero. Inspect `eoa_recovery_attempts` and `eoa_recovery_evidence` alongside
the immutable leg and portfolio revision. Configuration snapshots bind the
registry/finality/named source and hashed endpoint; successful observations
and fills save block/hash and proof provenance atomically. Do not expose these
server tables or signed bytes in public exports.

An attempt still marked `started` may have died before or after a committed
fill. Rerun the worker: its committed leg and ledger state determine whether
to reconcile or monitor. Never resend because an attempt is unfinished.

## Frozen/manual cases

Missing original receipt plus an advanced nonce does not prove a replacement.
The current runtime has no trusted inclusion-start height and does not assume
the last 32 blocks cover history. Gather full nonce history, original signed
hash, canonical replacement receipts and external wallet effects with a
reviewed indexer/operator process. The existing bounded reader remains a
diagnostic seam when a trusted scan start actually exists.

A changed receipt pauses the portfolio and invalidates held plans. A deep
reorg after settlement keeps its applied ledger snapshot for explicit repair;
the worker never overwrites it with a replacement guess. There is currently
no reviewed manual repair command. Do not update SQL states/balances or unpause
to bypass this guard. Record the diagnosis and implement/review the separate
repair procedure before any further execution.

P5.5 eligibility, supported token risk, prices/events/quantity, active policy/
session checks, guarded broadcasting and an authorized small mainnet leg
remain independent exit gates. Running recovery is not permission to execute.
