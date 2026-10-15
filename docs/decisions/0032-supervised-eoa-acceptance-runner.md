# ADR 0032 — Local EOA acceptance runner with mandatory private evidence

Date: 2026-10-02. Status: accepted for implementation by the owner's instruction
to write a funded-EOA transaction test script and broadcasting instructions.
Work IDs: P5.5e/P7.1/P7.2/P7.5/P9.4.
Prerequisite: [ADR 0031](0031-owner-only-bstocks-pilot.md) and its
[accepted amendment](../0031-amendment-1-pilot-evidence-rules.md).

## Decision

Add an operator CLI, `npm run pilot:eoa`, and shell entry point
`scripts/test-eoa-pilot.sh`. The local signer accepts a hidden terminal private key
or an absolute mode-0600 private file outside the repository. It never accepts a
key argument or asks the owner to share a key with an agent. The offline ethers
wallet exposes signing methods only; it is not installed as a web/server signer.
No key is written to evidence, PostgreSQL, project documents or MCP memory.

Compose existing SessionStore, WorkspaceService, ChainBootstrapService,
PilotPlanningService, ProductionEoaExecutor and receipt-effect recovery. Keep
authentication/signatures and trusted evidence checks; do not seed chain balances
or bypass access/security/price gates to make a smoke test succeed. Current
reviewed records, owner local-law decision and accepted findings remain manual
operator inputs. The script never fabricates them or enables broadcasting itself.

Separate `check`, `allowance`, `declaration`, `run`, and `recover`. Default `run`
without `--broadcast` collects diagnostics only, without signing or database
portfolio mutations. Live sends require both the reviewed configuration's
boolean `deployment.broadcastEnabled: true` and `--broadcast`, with exact local
per-action acknowledgement. There is no unattended `--yes` option.

The exact external USDT setup approval remains outside Nexus's transaction-leg
ledger, as accepted for the first fill. The runner records signed bytes and a
durable no-retry claim privately before sending once, verifies the canonical
successful unique exact Approval event and finality, and reports its hash for the
private records. Existing allowance/initial bootstrap/persisted wallet leg blocks
new setup. No unlimited approve/reset/revoke, second buy or mainnet sale is added.
The canonical local buy/sell round trip remains simulation only.

Mandatory mode-0700/0600 private evidence includes diagnostics, exact reviews and
all collected market evidence, price clocks/reasons, source/control/security and
round-trip observations, full receipts/raw deltas/zero-allowance proof, revisions,
reservations and recovery provenance. A repeatable-read database packet is exported
on success, block and error. Credential-bearing fields/errors are excluded. The
production runtime has an optional observation sink, unchanged by default; the
runner requires its sink to succeed before proceeding to persistence/claim.

An exclusive directory lock plus PostgreSQL wallet-scoped operator lock serialize
runner instances. A failed/ambiguous setup send is inspected, never resent.
Already claimed trade legs only recover; a still-signed stored leg can request its
existing one-time guarded claim after fresh sign-in and exact confirmation. Existing
wallet-wide lifetime-cap enforcement remains authoritative across directories and
processes. Recovery gains an optional exact wallet/leg filter; the default worker
still discovers all configured candidates.

## Consequences and limits

The runner permits the owner to produce real acceptance evidence without a browser
wallet integration. It does not qualify issuer/public legal access, commission an
audit, auto-accept findings or change the pilot's scope. Key strings are transient
process memory; JavaScript cannot promise cryptographic memory erasure. Keep the
local signer in the short-lived operator process and protect its host/private files.

Live acceptance is reported only after a successful canonical receipt, original
full effect proof, exact zero allowance and once-only reconciliation. A second fresh
worker invocation must preserve all accounting/claim fields. The operator separately
restarts the actual process with `recover`, retaining both packets to demonstrate
process restart; the within-run worker replay is not labelled an OS restart.
Nonzero allowance, replaced/disputed/reorged effects stay incident procedures.
R1 correction remains separately owner-signed and source-qualified; R2/R3 remain
deferred. No reorg is induced on mainnet to test recovery.

Private evidence must be retained outside Git/MCP. A stale lock after abrupt death
requires verifying the old process is gone; automatic lock removal or resend is
not allowed. Losing the PostgreSQL operator lock prevents new persistence/send.
An interrupted setup before sending may intentionally require manual diagnosis.

## Verification

Named tests cover input/key/evidence boundaries, exact transaction signatures,
two-switch broadcasting, cancellation/write failures, changed setup, ambiguous
send/replay, blocked market evidence, once-only persistence/send, scoped recovery
and real PostgreSQL packet/reconciliation/recovery replay. Repository checks and
their actual results are retained in the engineering log. See the
[runner instructions](../runbooks/eoa-pilot-runner.md).
