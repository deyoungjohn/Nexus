# Project state

Last updated: 2026-10-02

## Objective

Build Nexus as specified in [Nexus.md](../Nexus.md): coordinated tokenized-stock
portfolios on BNB Smart Chain with explicit approval, deterministic planning,
inspectable evidence and recoverable sequential execution.

## Current status

- **Supervised EOA acceptance runner available** (P5.5e/P7.1/P7.2/P7.5/P9.4,
  [ADR 0032](decisions/0032-supervised-eoa-acceptance-runner.md)).
  `./scripts/test-eoa-pilot.sh` / `npm run pilot:eoa` provide diagnostic check,
  exact external allowance, private declaration, one-buy run and scoped recovery.
  Hidden local key entry or a private file stays in the operator process; no web
  signer or custody service was added. Collection is mandatory and private outside
  Git/MCP: full source/gate/simulation observations, receipts/raw effects/zero
  allowance, database revisions/reservations and worker replay. Live sends require
  BOTH `deployment.broadcastEnabled: true` and `--broadcast`, with each exact local
  action confirmed. Default run collects diagnostics only. Claimed/ambiguous legs
  only recover; no repeat buy or mainnet sale. Current reviewed private records and
  actual owner mainnet/process-restart evidence remain open. See
  [instructions](runbooks/eoa-pilot-runner.md). Final checks passed **257 application
  plus three research tests**, no failures/skips, PostgreSQL enabled, typecheck and
  both builds; **18 browser cases passed**. Diagnostic/default-run CLI smoke collected
  private packets and left an isolated database's portfolios/sessions/legs empty.
  No mainnet transaction was sent; current logs retain verification details.

- **Current increment: owner-only NVDAB pilot, ADR 0031 Amendment 1.**
  [Accepted rules](0031-amendment-1-pilot-evidence-rules.md) implement the senior
  [response002](response002.md). The modular monolith and strict admission default
  remain; one configured EOA gets one buy up to five USDT. Independent review stays
  deferred and scanner coverage/findings remain unchanged. Profile/manual records
  v2 require fresh signatures; older configurations cannot silently inherit changes.

- Owner-only J1–J5 access uses current ADGM register discovery plus every potentially
  applicable issuer supplement, current Binance restriction notice, both reviewed
  restriction lists, expiring restricted-person/jurisdiction representations and
  a private dated local-law decision/rules revision. Fetch, manifest/digest change
  and missing evidence block; listed countries deny. No personal issuer sign-off
  is required for this profile. Public-service legal and third-party API/source-use
  qualification remain open. Personal records never belong in Git or MCP memory.

- Economic mapping defaults to exact dual raw/display interpretation until a cited
  clause/page is recorded in a revised signed mapping. Both price checks must pass;
  exposure/caps use the larger ratio and conservative current USDT cash valuation.
  Pending/changed multipliers still block. Current-session NVDA, 1,350-second USDT,
  50-bps peg, guarded fresh DEX mid, expected/signed minimum and separate absolute
  gas caps are enforced. P1–P9 and source high-water marks persist across restarts
  and profile revisions in migration 0010. Sampled price diagnostics report both
  exact premiums and source clocks; they do not grant trading admission.

- Exact external allowance setup must precede the signed initial bootstrap and
  equal the trade input. Recovery binds zero allowance at the canonical successful
  receipt block to the persisted pilot leg. Missing proof waits; nonzero records
  an incident and freezes without releasing submitted reservations. Immutable full
  original receipts and before/after balances support signed R1 compensation.

- R1 re-anchors the same transaction with identical logs/raw deltas/gas and complete
  finalized ledger equality, proven by two configured reviewed independent upstreams.
  An owner review/signature binds all evidence and revisions; replay is a no-op,
  competing transitions reject, accounting amounts and original fill proof remain,
  and trading stays paused. The authenticated Review screen exposes this narrow
  correction; `/api/reanchor` has owner/origin guards. Current public RPC candidates
  have no upstream independence review; actual R1 incidents remain gated. Resync
  still rejects applied disputed fills. R2/R3 and general repair remain deferred.

- Verification: **243 application and three research tests, 18 Chromium cases**,
  zero failures/skips; PostgreSQL suites, strict typecheck and both builds pass.
  Current engineering/project logs and changelog retain failures/corrections and evidence.
  `pilot:inspect`, `pilot:declaration`, `pilot:prices`, paused bootstrap/planning and
  exact trade approve/persist/submit remain separate commands/flows. Mainnet
  acceptance still needs a funded intended EOA, privately reviewed current records,
  owner local-law decision/declaration, exact setup/trade signatures, actual round
  trip and canonical receipt/restart evidence. No mainnet transaction was sent.
  Broadcasting remains default-disabled; P5.5/P7/P8/P9 are not declared complete.
  [Runbook](runbooks/owner-pilot.md) describes migration 0010, records v2 and R1.

The following entries describe earlier increments and their verification at the time;
ADR 0031 supersedes their strict-only pilot prerequisites within its narrow scope.

- Senior-engineering handoff prepared: [unresolved challenges and context](SENIOR_ENGINEER_HANDOFF.md)
  separates 15 current source/policy/integration/recovery/release challenges from
  resolved historical obstacles. Records the owner preference to prove the EOA MVP
  before commissioning a new audit; current live admission policy is unchanged.
  October 2 PostgreSQL baseline passed 213 application plus three research tests,
  zero failures/skips, strict typecheck and both builds; post-documentation check
  also passed the same suite. Handoff links/privacy/structure and whitespace checks
  passed. Documentation-only increment; no source configuration, signing, broadcast,
  provider pivot or gate closure. Current .git policy leaves this work uncommitted.

- P5.5e/P7.1/P8.3/P8.4 route/web binding implemented: actual-size USDT/NVDAB
  quotes and exact-byte real-state simulations pin venue code/identity, canonical
  blocks, gas/feed bounds and actual allowance/balances. `/api/execution` and the
  web Review panel connect explicit typed approval, signed-byte storage and
  separate guarded submission, with raw import for unsupported signing wallets.
  Default web execution configuration is absent; production access/economic/
  event/valuation ports remain unconfigured and broadcasting disabled. A public
  5-USDT quote smoke succeeded; an unfunded synthetic simulation stayed blocked.
  Current sources/reviews/scanner/risk policy, trusted chain initialization and
  funded-wallet mainnet/operational gates remain open. Final check passed 213
  application plus three research tests, zero failures/skips, strict typecheck
  and both builds; all 14 Chromium cases passed. See
  [ADR 0030](decisions/0030-bstocks-route-and-web-approval.md) and
  [route evidence](integrations/2026-10-01-bstocks-route-adapter.md).

- P5.5/P7.1/P7.2/P7.5 production execution composition is implemented: the
  USDT/NVDAB public evidence assembly feeds server-owned PostgreSQL reviews,
  exact signed-byte persistence and a one-time guarded EOA broadcaster. Active
  owner/session/policy/registry/revision checks are atomic at persistence/claim;
  reviewed recovery configuration and full approved gas cost are bound. Both
  original and newly collected P5 evidence must pass within the original lease.
  Synthetic PostgreSQL tests span review → persistence → send → receipt-effect
  recovery → repeat monitoring without duplicate fills. Broadcasting defaults
  to disabled; no actual wallet trade or new web trade endpoint was enabled.
  Qualified access/economic/event/valuation/quote/simulation sources, complete
  scanner coverage, current independent reviews and approved risk policy remain
  open. Exact P8 approval/chain initialization and operational repair gates also
  remain. Final PostgreSQL-backed ./scripts/check.sh passed 205 application
  and three research tests, zero failures/skips, strict typecheck and both builds.
  See [ADR 0029](decisions/0029-production-eoa-evidence-orchestration.md)
  and [execution runbook](runbooks/eoa-execution.md).

- P5.5d/P7.1 recovered source/governance integration implemented: immutable
  source certificates and canonical OperatorWallet/BurnWallet adapters now resolve
  all nine NVDAB execution components and eleven current authorities. Sentio and
  Blast independent nearby-block collections agree on full fingerprints. Explicit
  Binance/GoPlus coverage and review-v2 publisher/scope/PDF-digest verification
  prevent absent fields or historical reports from clearing live admission.
  Found a verified historical EtherAuthority USDT audit candidate; no qualified
  current full-scope USDT/NVDAB review is configured. Scanner gaps, mint/shared-
  creator warnings and centralized governance findings remain unapproved; live
  security clearance and overall P5.5/P7 completion remain open. See the
  [current report](integrations/2026-10-01-security-collector.md) and
  [ADR 0028](decisions/0028-source-governance-and-independent-review-intake.md).
  PostgreSQL connectivity is restored: current baseline passed 171 application
  tests plus three research tests with no failures/skips. The prior task's
  ECONNREFUSED/database-free result remains recorded as historical evidence.
  Final PostgreSQL-backed ./scripts/check.sh passed 186 application and three
  research tests with zero failures/skips, strict typecheck and both builds.
- P5.5d/P7.1 full-token security enforcement implemented: new read-only
  `src/security/` module and `npm run security:tokens` inspect exact USDT/NVDAB,
  normalize Binance/GoPlus coverage, verify executable source closure and
  current control/authority fingerprints, and require trusted contract-scope
  review. P5 now requires both route-token reports at the same quantity block,
  recomputes states/hashes and binds them to P7 approval. Missing legacy adapter
  security evidence blocks. Review registry is deliberately empty; no risk
  exception or live instrument was authorized. bStocks quantity/transfer reads
  now use canonical hash references and end-of-read reorg checks.
  See [ADR 0026](decisions/0026-full-token-security-evidence.md),
  [specification 0008](specifications/0008-token-security.md) and
  [security findings](integrations/2026-09-30-full-token-security.md).
  Final PostgreSQL-backed verification passed 171 tests with zero failures/skips,
  strict typecheck and both builds. Live two-source fingerprints agree; USDT
  mint warnings, NVDAB unsupported coverage and absent qualified reviews kept
  trading blocked at that increment; source/governance integration is now complete
  as described above.
- Cross-agent workspace initialized.
- Shared MCP memory initialized with the `Nexus` project entity; all four initial
  observations were retrieved successfully through `open_nodes` on 2026-09-25.
- P0 (roadmap), P1 (domain foundation), P2 (integration feasibility), P3
  (durable ledger), P4 (Portfolio Coordinator) and P5 (offline Market Gate)
  are complete. P5.5 now targets bStocks first; live-readiness remains active.
  P6 and non-live P7 are in progress under the EOA-first decision. P8 now has
  a labelled fixture flow and an owner-authenticated PostgreSQL workspace;
  production trading remains blocked.
  The completed P2 Ondo trade is historical feasibility evidence,
  not proof of a bStocks route. See
  [the implementation plan](IMPLEMENTATION_PLAN.md) for all phases and exit gates.
- P2 read-only evidence: chain 56, BSC USDT and three Ondo candidate token
  contracts (NVDAon, AMDon, AAPLon); public metadata/status and RPC `decimals()`
  agree on 18 decimal places. Public responses lack a source timestamp for the
  stock reference price; wallet display multipliers alter displayed quantities.
  See [the integration matrix](integrations/2026-09-25-phase-2.md).
- Agentic Wallet CLI version 1.10.0 is installed and reports `CONNECTED` when
  checked outside the sandbox. Quote-only checks succeeded for USDT to NVDAon,
  AMDon and AAPLon, plus each token back to USDT, without submitting transactions.
  After the owner's funding, a read-only balance check showed settlement and
  native-gas assets present. Two 5-USDT NVDAon quotes succeeded; a 4-USDT quote
  was rejected with a greater-than-$5 value message. The
  earlier sandboxed `UNCONNECTED` response was a false negative; its cause and
  correction are logged. A direct V3 route, exact allowance, wallet preview,
  mined trade and reconciled receipt were verified for one supervised NVDAon
  test. No application live execution adapter is enabled.
- KyberSwap supplied an unsigned, decoded 5-USDT-to-NVDAon route with fixed
  wallet recipient, exact input and 0.5% minimum-output bound. Actual router
  allowance is zero; direct `eth_call` reverted, while a read-only exact-
  allowance state override succeeded and estimated gas. Agentic Wallet
  Developer Mode was disabled on 2026-09-25. After a VPN-related DNS failure,
  the owner enabled Developer Mode and 2026-09-26 CLI checks returned
  `CONNECTED` and `devMode.enabled=true`. A deadline-bound PancakeSwap V3
  direct route quoted below a separate opaque wallet quote; it passed
  read-only chain simulation with a temporary exact allowance override.
  The owner authorized an exact 5-USDT approval and bounded trade. Both
  BSC receipts succeeded. Mined swap calldata matched the preview, and token
  transfer logs, raw balances and spent allowance reconciled. The received
  NVDAon exceeded the encoded minimum. Wallet display quantity matched raw
  tokens times the public shares multiplier, truncated to display precision.
  Binance token audit returned no supported result for NVDAon; the trade
  occurred while public token status was open but off-hours.
- For MVP earnings confirmation, use manual issuer investor-relations
  announcements with direct provenance and rechecks. Label demo user-supplied
  events separately; defer automated ingestion until source rights and revision
  behavior are verified. No date-dependent live rule is enabled.
- Implemented: exact denominated quantities and serialization, immutable
  instrument metadata registry, deterministic priority/proportional cash
  allocation with separate native gas checks, and a synthetic CLI example.
- Implemented in P3: PostgreSQL migration for portfolio/revision/balance,
  policy/evidence/decision records, plans, exact reservations, transaction
  identities and outbox. The ledger serializes plan and revision writes per
  portfolio, blocks overspending and unresolved submissions, and exposes an
  at-least-once leased worker helper. See
  [specification 0002](specifications/0002-durable-ledger.md).
- Implemented in P4: pure deterministic coordinator and PostgreSQL decision
  store with versioned policy activation, immutable instrument mappings,
  snapshot-to-ledger checks, exact-instrument netting, sell-first phases,
  priority/proportional cash allocation and conservative company/sector/issuer
  limits. The blueprint NVDA/AMD example resolves to a $30 NVDA sell and a
  contingent $30 AMD buy; only a new reconciled revision can reserve that buy.
  See [specification 0003](specifications/0003-portfolio-coordinator.md).
- Implemented in P5: a pure fail-closed market gate and read-only evidence
  adapter seam. It checks exact eligibility, quantity mapping/version, separate
  reference/session/status/quote clocks, dated holiday/DST sessions, issuer
  events, clear supported audit, held-position valuation freshness, decoded
  direct-V3 route bounds, normalized price and settlement
  conversion, gas/cost limits, full-size P4 limits and exact simulation fields.
  It emits an evidence hash for P7 revalidation. See
  [specification 0004](specifications/0004-market-gate.md).
- P5.5 progress: a Pyth Pro reference adapter preserves the provider's
  `feedUpdateTimestamp` and fails closed on malformed/non-regular packets or
  missing credentials; it is dormant because no Pro access is available.
  A read-only BSC adapter reads Ondo's published SyntheticSharesOracle at one
  pinned block and rejects wrong-chain, stale, paused or scheduled mappings.
  Live read-only probes returned positive NVDAon, AMDon and AAPLon ratios on
  2026-09-26. See [the live-readiness matrix](integrations/2026-09-26-live-readiness.md)
  and [ADR 0007](decisions/0007-live-market-sources.md).
- P5.5 no-subscription source pivot: read-only Chainlink BSC adapters now
  source timestamped NVDA/USD and AAPL/USD underlying rounds and a bounded
  USDT/USD settlement valuation. Mainnet probes decoded the feeds; the equity
  rounds were from the prior session and correctly failed a 60-second age
  limit on 2026-09-26. The earlier Ondo candidate scope was NVDAon and AAPLon;
  AMDon remains read-only without a verified BSC reference. See
  [ADR 0008](decisions/0008-keyless-bsc-market-reference.md).
- A short-lived Binance public status adapter now reports only an explicit
  open venue state; read-only NVDAon/AAPLon checks succeeded. Both Binance
  token audits remain unsupported, and GoPlus leaves core proxy-token risk
  fields unknown. Neither result can satisfy P5's `clear` audit state.
- A versioned NYSE calendar adapter now fetches the official holiday and
  early-close section and rejects unreviewed revisions or dates outside
  2026–2027. Read-only weekend, regular-day, holiday and early-close probes
  succeeded. See [ADR 0009](decisions/0009-versioned-nyse-calendar.md).
- P5.5 owner-attestation groundwork now creates and verifies a 24-hour EIP-712
  declaration bound to exact BSC wallet, token, router, venue, side and nonce.
  A local challenge/verify CLI is available; no owner declaration has been
  signed for this workflow and no production eligibility adapter is wired.
  Durable revocation and current transfer checks remain open. See
  [the owner procedure](integrations/2026-09-26-eligibility-risk.md) and
  [ADR 0010](decisions/0010-owner-attestation-and-token-risk.md).
- A repeat Binance audit probe supports BSC USDT but returns unsupported for
  NVDAon and AAPLon, confirming a provider coverage gap without disclosing
  its internal cause. Read-only pinned-block checks found both Ondo tokens
  share one EIP-1967 beacon and implementation; their hashes can invalidate
  a later contract review but do not amount to an audit. P5 still rejects
  unsupported token risk. No exception is active.
- Sourcify's verified runtime source identifies role-gated mint/admin burn,
  mutable compliance and pause managers, and beacon upgrades for the shared
  Ondo implementation. Read-only BSC checks found current control pointers,
  but code hashes alone do not detect later role or pointer changes. Any
  exception policy would need to monitor those controls and actual routes.
- P5.5 settlement correction: the Chainlink USDT/USD reader now emits the
  P5 snapshot's `USD-18` unit and requires an explicit peg-deviation ceiling
  in addition to source age and uncertainty. A read-only mainnet probe passed
  illustrative 20-minute/50-bp/100-bp bounds; production thresholds are not
  activated. The [issuer-event runbook](runbooks/issuer-event-review.md)
  records a manual direct-source process and treats inaccessible/dynamic
  pages as uncertain, not as proof of no event.
- Earlier owner-directed provider pivot: xStocks was the first live-integration target;
  Ondo adapters remain available but dormant. A new read-only BSC adapter
  checks exact issuer-listed NVDAx/AAPLx native tokens and current v2 wrappers,
  then pins code, `asset()`, decimals and multiplier/conversion at one block.
  Both candidates passed live read-only probes. The bare EVM tokens rebase;
  current wrappers are distinct instruments with stable shares. Four 5-USDT
  Agentic Wallet quotes for the bare tokens/wrappers all reported no liquidity;
  tested direct Pancake V3 pools were absent. Seven of eight further BSC
  xStocks wallet quotes also lacked liquidity; SPYx returned an implausibly
  poor quote versus an indicative public price. No xStocks instrument is live-
  registered. See [the xStocks matrix](integrations/2026-09-26-xstocks-bsc.md)
  and [ADR 0011](decisions/0011-xstocks-first-bsc-provider.md).
- P5.5e BSC liquidity survey: a 2026-09-27 read-only snapshot covered all
  671 Binance-listed BSC securities records, including 458 Ondo, 128 xStocks,
  80 bStocks and five separately classified records. Among the three main
  providers' equity-scoped tokens, 100-USDT wallet quotes succeeded for
  23/329 Ondo, 4/96 xStocks and 66/67 bStocks. A direct-USDT-pool and
  100/10,000-USDT quote test supports a provisional bStocks top 20; Sunday
  market-hour blocks and absent/thin routes prevent defensible Ondo or
  xStocks top-20 liquidity ranks. At the time of that survey the
  provider-priority ADR was unchanged;
  no trade or application execution adapter was enabled. See the
  [dated report and full CSV](research/2026-09-27-bsc-stock-liquidity.md).
- Owner-directed P5.5 pivot to bStocks: [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md)
  supersedes xStocks-first priority while retaining the xStocks and Ondo
  adapters as dormant modules. A direct 5-USDT USDT-to-NVDAB PancakeSwap V3
  fee-2500 route was verified against the official factory and exact contracts
  at BSC block 124348179. Its 50-bps minimum output and deadline were decoded;
  a read-only swap simulation with temporary exact balance/allowance overrides
  succeeded, while deliberately too-high minimum and expired-deadline calls
  reverted. On-chain BEP-677 multiplier reconciled the raw quote to a
  contemporaneous bStocks spot ask within about 0.20%; the minimum implied a
  0.70% premium. This is route screening, not a production independent price
  source. The wallet lacked actual 5-USDT balance and router allowance, and
  Binance token audit reported unsupported. No trade or bStocks instrument
  was application-enabled. See the [bStocks route matrix](integrations/2026-09-27-bstocks-bsc.md).
- P5.5b bStocks read-only adapter: `src/market-gate/bstocks-bsc.ts` pins the
  exact NVDAB contract, BSC block, 18 raw decimals, BEP-677 current/pending
  multiplier and proxy/beacon/implementation, compliance, pause-manager and
  token-role fingerprints. A live 2026-09-27 probe succeeded at block 124352879
  with no pending multiplier and `isTokenPaused=false`.
  A later read at block 124354706 also pinned the external managers' role-set
  hashes and found the token's mutable mint and burn switches enabled. This
  broadens change detection but does not clear unsupported token risk.
  Scheduled changes and changed reviewed controls block review reuse. The
  multiplier only converts raw amounts for display; no P5 reference-share
  `QuantityEvidence`, clear audit, eligibility result or live registration is
  produced. [ADR 0013](decisions/0013-bstocks-display-mapping-boundary.md)
  records this boundary. Binance's FAQ mentions a jurisdiction API but gives
  no endpoint in the reviewed public text; no speculative integration exists.
- P5.5c on-chain transfer preflight: `src/market-gate/bstocks-transfer.ts`
  rechecks token pause and wallet, exact validated V3 pool and router against
  the verified compliance contract at the quantity snapshot's BSC block.
  A synthetic-address live read succeeded at block 124353819; it is not the
  owner's wallet or issuer/jurisdiction eligibility. [ADR 0014](decisions/0014-bstocks-transfer-preflight-boundary.md)
  keeps this result separate from P5 `EligibilityEvidence`. No official
  country endpoint path or verified user-jurisdiction evidence was established.
- P5.5c event review found a separate bStocks provider stream. Binance's
  historical NVDAB dividend notice specified an on-chain multiplier adjustment
  and conversion/deposit/withdrawal pauses while spot trading would continue.
  P5 now has a separate `providerEvent` record for instruments using the
  canonical `bstocks` issuer ID. The gate requires a fresh exact-instrument,
  direct-URL, revisioned notice record and binds it into the evidence hash.
  Missing, stale, uncertain or in-blackout records block. The updated
  [runbook](runbooks/issuer-event-review.md) and
  [ADR 0015](decisions/0015-bstocks-dual-event-review.md) require both streams.
  No production notice adapter, current clearance or live registration exists.
- Current PostgreSQL-backed verification: on 2026-09-29, after workspace
  network access was enabled, Codex ran `./scripts/check.sh` against the
  disposable local test database and passed **101 tests, zero failures and
  zero skips**, including the P7 signed-leg store suite. Strict typecheck,
  build and Portable configuration checks also passed. Earlier `EPERM`
  attempts were caused by this agent session's restricted network, not the
  database or application. No database credential is stored in project memory.
  This clears the current P7 migration/store test gate; broader chain
  evidence, crash recovery and broadcaster gates remain open.
- 2026-09-29 P7 chain-evidence increment: read-only pinned native/ERC20
  balance reader and bounded canonical same-nonce replacement scan are tested.
  The current PostgreSQL-backed `./scripts/check.sh` passes **106 tests, zero
  failures and zero skips**, plus typecheck, build and configuration. The
  adapters are not yet wired to the store or a trusted complete asset registry;
  crash/reorg recovery and guarded execution gates remain open.
- 2026-09-29 P7 recovery hardening: PostgreSQL now supplies immutable leg
  identity and tracked balances to a read-only BSC observation worker. A
  separate builder returns a registry-checked, exact-receipt-block balance
  candidate only after repeated canonical/finality checks. Reconciliation
  rejects missing native/previously tracked assets and later-block snapshots;
  unresolved or reorged legs block unpause. PostgreSQL-backed
  `./scripts/check.sh` passes **109 tests, zero failures/skips**, plus
  typecheck, build and configuration. The candidate is not automatically
  reconciled and no production broadcaster is present.
- 2026-09-29 P7 receipt-effect proof: the recovery adapter now binds a
  canonical BSC receipt's exact ERC20 `Transfer` movements and gas fee to the
  wallet's pinned balance changes. PostgreSQL rechecks the proof under lock,
  stores its digest and applies the balance/revision/reservation change once.
  The database-backed check passes **112 tests, zero failures/skips**, plus
  typecheck, build and configuration. This supports reviewed, zero-native-value
  ERC20 behavior only; production source trust, bStocks semantics and the
  remaining P5.5/P7 gates still prevent live execution. See
  [ADR 0020](decisions/0020-eoa-receipt-effect-proof.md).
- 2026-09-28 EOA-first decision: [ADR 0016](decisions/0016-eoa-first-wallet-execution.md)
  makes direct owner-approved EOA signing the P7/P8 priority. Agentic Wallet
  becomes an optional later adapter. The blueprint's wallet-native MVP and
  modular P3/P4/P5 boundaries remain intact. The reviewed bStocks FAQ does
  not impose a universal Binance account-status requirement on a direct EOA
  DEX route; product and jurisdiction restrictions still apply. The country
  endpoint path, reliable user-jurisdiction evidence and exact-wallet transfer
  checks remain open. Page access, signatures and quotes are not eligibility.
  The [bStocks access-control runbook](runbooks/bstocks-access-control.md)
  records the server-side flow. A fail-closed P5.5c composer now binds an
  authenticated session to a short-lived EOA challenge; requires reviewed
  person/jurisdiction, revision-pinned country and product decisions; and
  runs the exact wallet/pool/router on-chain preflight. P5 requires its
  route-bound access evidence for bStocks, and a changed access hash invalidates
  P7 approval. No production country endpoint/parser or trusted jurisdiction
  provider is connected. The new EOA web session proves wallet control only
  and is not yet wired to the bStocks access composer, so live geo-enforcement
  is not enabled. See [ADR 0018](decisions/0018-bstocks-access-evidence.md).
  P6 now persists strict immutable rule versions, review hashes and event
  revisions, atomic occurrence/evaluation/P4 reservation batches, conservative
  intent mapping and revision-pinned allocation quantities. Concurrent and
  restarted workers cannot repeat an occurrence. Schedules spanning midnight
  retain the preceding local date. Trusted valuation/event inputs and allocation
  refresh after reconciliation still need production integration. See
  [specification 0005](specifications/0005-rules-and-scheduling.md).
  P7 has a pure EOA EIP-712 approval and signed EIP-1559 transaction verifier,
  migration 0003 and a PostgreSQL store that persists signed bytes/hash and
  freezes one exact reservation before a one-time broadcast claim. Pure
  recovery distinguishes unknown, included, finalized, replaced and reorged
  outcomes; read-only BSC adapters validate canonical receipts, scan a bounded
  window for mined same-wallet/same-nonce replacements, and read native plus
  registry-supplied ERC20 balances at a pinned block with hash rechecks. The
  observation is now derived from the stored leg; a separate read-only builder
  checks registry-supplied assets and constructs the receipt-block balance
  candidate and transaction-local receipt proof. The production recovery worker
  now uses an operator-owned versioned registry, named Sentio/Blockmachine
  sources and explicit finality depth. It discovers persisted legs and commits
  source provenance with observations/fills. USDT/NVDAB now have reviewed raw
  Transfer registry entries and receipt-block runtime/beacon checks (ADR 0025).
  Other ERC20 reviews and a trusted replacement-scan start remain absent. A finalized
  success/revert can reconcile only against a complete trusted balance
  snapshot with exact input/minimum output and unrelated-token checks. The
  PostgreSQL-backed check in this session passed the P7 signed-leg store
  suite. No production broadcaster exists. See
  [specification 0006](specifications/0006-eoa-execution.md) and
  [ADR 0019](decisions/0019-eoa-persist-before-broadcast.md).
- 2026-09-30 owner source preference: use the supplied public BSC dataseed
  endpoint and free stock sources. Read-only probes verified current BSC and
  Chainlink reads, but dataseed historical balance/contract calls failed, and
  a PublicNode fallback required archive access credentials. NVDA/AAPL rounds
  were about 16–20 minutes old, failing the existing reference-age limit.
  See [the dated source report](integrations/2026-09-30-free-source-readiness.md).
  No source is production-qualified by these samples, and no age limit or
  eligibility requirement was relaxed. Terms acceptance records a declaration;
  official geographic/product/transfer decisions remain required. Direct
  issuer contact is a practical documentation path, not an established
  universal bespoke-authorization requirement from the reviewed FAQ.
- 2026-09-30 access dependency reassessment: the requested
  [verification challenges report](verificaton-challenges.md) distinguishes
  missing bStocks country/API and accepted verification guidance from work
  Nexus can implement. The issuer's response/specification is an external
  dependency, but price/RPC/risk/runtime/recovery gates remain too. xStocks
  publishes platform-level compliance responsibilities and partner review;
  Backed lists Nigeria as non-serviceable for issuer accounts, without proving
  every secondary venue's policy. Ondo documents secondary acquisition
  representations separately from direct-issuer KYC/approved wallets/API keys.
  Earlier blanket direct-account assumptions must not be applied to all DEX
  users. The [regular-session Ondo route reassessment](research/2026-09-30-ondo-bsc-secondary-routes.md)
  now finds a conditionally simulated small direct NVDA route with full
  input spend/net receipt and minimum/deadline enforcement. AAPL's direct
  pool only consumes a tiny fraction of requested input; broader aggregator
  previews need new path/intermediate review and can include bStocks.
  NVDA/AAPL free equity rounds remained over two hours old and sampled audits
  remain unsupported. No independently price-qualified live route or provider
  switch is established; ADRs 0012/0018 and current gate limits remain in force.
- 2026-09-30 P7 RPC discovery: the [Chainlist recovery-source survey](integrations/2026-09-30-chainlist-recovery-rpc.md)
  found anonymous historical-read candidates after screening 45 HTTPS
  endpoints. Sentio and Blockmachine served matching native/ERC20 balances
  back to June 2024, full transaction blocks, canonical receipts/logs and
  passed the existing P7 readers. Both also replayed the previously failed
  Ondo block and the historical NVDAB route block with nonzero stock balances.
  Prefer Sentio for the next qualification, with Blockmachine as a backup
  candidate. The missing-history search is resolved at sampled blocks; no
  production source/registry wiring, automatic failover or P7 exit was inferred
  from that survey alone; the following increment implements the wiring.
- 2026-09-30 P7 production recovery wiring: `npm run recovery:once` now
  discovers stored BSC EOA legs, collects complete single-source receipt/balance
  proofs with Sentio → Blockmachine fallback, applies fills once and monitors
  settled receipts. Migration 0007 records configuration-bound attempts and
  atomic source/block/hash observation/fill evidence. Portfolio session locks
  and all store transactions share one connection; losing it prevents writes.
  Contradictions now pause unreconciled portfolios too. The checked-in registry
  initially enabled native gas only; the next review adds USDT/NVDAB while
  unreviewed tracked/output assets continue to block settlement.
  Consumed-nonce ambiguity, replacements and reorgs remain manual. Public
  June-2024 configured-source smoke reads passed both endpoints with matching
  balance/proof digests; these are unrelated public transactions, not a Nexus
  mainnet fill. See [ADR 0024](decisions/0024-production-recovery-worker.md),
  [runbook](runbooks/bsc-recovery-worker.md) and
  [smoke evidence](integrations/2026-09-30-recovery-wiring.json). PostgreSQL
  regression tests cover fallback, proof/registry rejection, concurrency,
  reverts, deep/inconsistent reorgs and crashes before/after fill. No deployment
  scheduler, production database migration or broadcast was run. Final full
  PostgreSQL-backed check passed 147 tests with zero failures/skips, strict
  typecheck and both builds. Production CLI empty-schema smoke returned `[]`
  and exit 0; memory findings were stored and retrieved.
- 2026-09-30 P7 token recovery review: USDT and NVDAB are registered for raw
  receipt-effect accounting, using verified source and public buy/sell receipts.
  USDT's executable code matched with a compiler-metadata-only difference;
  NVDAB proxy/implementation matched exactly. Both endpoints verified public
  pool block deltas against all relevant raw transfers and passed the new
  application guard at both receipt blocks. Registry revision
  `bsc-raw-transfer-review-2026-09-30` includes receipt-block code/decimals and
  NVDAB beacon/implementation pins, checked before and after proof collection.
  Changed identity requires review; unavailable evidence can use full-source
  fallback. UI events and multiplier notices are never counted as raw funds.
  The beacon source itself remains unavailable; this is conditional accounting
  review, not a full control audit or P5 live registration. See
  [ADR 0025](decisions/0025-reviewed-bsc-raw-transfer-recovery.md) and
  [review/evidence](integrations/2026-09-30-token-recovery-semantics.md). No wallet
  signature, broadcast, production migration or eligibility bypass occurred.
  Final PostgreSQL-backed full checks passed 154 tests, zero failures/skips,
  strict typecheck and both builds; structured evidence consistency and memory
  write/retrieval passed.
- Next: connect trusted scheduling valuation/event inputs and post-fill
  allocation refresh; finish EOA-first P7 recovery and bStocks P5.5. Review
  the issuer's economic
  reference-share mapping and the implications of the verified mutable
  controls beyond their fingerprints;
  establish current
  wallet/jurisdiction eligibility, a supported token-risk policy, bStocks
  reference/session rules, a production dual-source issuer/provider event
  adapter and settlement
  bounds. Refresh and simulate the exact route after actual funding/allowance
  only within an owner-approved plan. Existing BSC price, quantity and settlement sources
  are read-only; no instrument is live-registered.
  P7 must still extend token reviews beyond USDT/NVDAB and review source availability/
  retention, handle nonce history outside the bounded scan, add reviewed manual
  repair and qualify the implemented active-policy/session execution wiring and
  guarded broadcaster. Nexus live automation
  remains disabled.
- P8 fixture increment: `web/` now contains a Next.js App Router workspace with
  Overview, Plan, Review, Activity and Settings. It discovers an already shared
  EOA account/chain read-only, interprets a synthetic basket with exact-cent
  cash and a per-leg cap, shows synthetic bounds/evidence/expiry, records a
  15-minute local acknowledgement and one sample outcome, exports labelled
  JSON, and offers a browser-only pause. Previews and acknowledgements do not
  survive reload. This fixture page has no trading authority. [Specification 0007](specifications/0007-web-workflow.md)
  and [ADR 0021](decisions/0021-fixture-web-boundary.md) define the boundary.
- P8 saved increment: `/workspace` uses a five-minute stored exact EOA
  challenge, one-hour revocable HttpOnly session and owner-scoped PostgreSQL
  reads/commands. Basket/price rules use the P6 compiler, review/activation
  hashes and current revision; P3 balance/reservation, P4 decision/evaluation
  and safely projected P7 receipt records are inspectable/exportable. Pause
  invokes P7 server state and releases held plans. New portfolios start paused
  with explicitly unverified zero balances. Strict origin/body/session guards
  prevent cross-wallet writes; source evidence and signing envelopes are not
  browser inputs. Earnings creation awaits server-reviewed event records.
  [ADR 0023](decisions/0023-owner-authenticated-web-workspace.md) records the
  boundary. Production source/session/access composition, exact execution
  approval, actual chain receipts and broader accessibility remain open.
- Verification for this increment: PostgreSQL-backed checks passed 129 tests
  after durable P6, 138 after the application service and 139 after the web
  integration; zero failures/skips on each passing run. Seven Chromium tests
  pass against the production server, covering the saved workflow, HTTP/session
  guardrails, delayed account-change response, mobile keyboard/error behavior
  and the original fixture cases. Final combined verification is recorded in
  the engineering log: final PostgreSQL-backed `./scripts/check.sh` passed
  139 tests, zero failures/skips, strict typecheck and both builds.
- Workspace Git limitation: the active filesystem policy exposes `.git` as
  read-only, so these changes cannot be staged/committed from this session.
  Existing unrelated modifications were preserved. Commit the reviewed work
  from a terminal with write access to `.git`; documentation and source changes
  are still local until then.
- Detailed work, tests, reporting correction and lessons recorded in
  [the engineering log](ENGINEERING_LOG.md). One supervised mainnet trade was
  performed with separate owner approval; application trading remains disabled.

## Architecture

- Modular monolith; domain kernel in `src/domain/`, PostgreSQL ledger in
  `src/ledger/`, offline coordinator in `src/coordinator/`, compiler and
  durable rule store in `src/rules/`, EOA verifier/store in `src/execution/` and pure market gate
  plus separate read-only bStocks quantity/transfer, fail-closed bStocks access
  composer and xStocks/Ondo/Chainlink
  P5.5 adapters and the dormant
  Ondo owner-attestation verifier in `src/market-gate/`; owner-authenticated
  application service in `src/application/`; separate fixture and saved
  Next.js App Router interfaces with server-only routes in `web/`.
- Node.js 22.x; TypeScript 5.9.3; Node types 22.18.6; Next.js 16.3.7 and
  React 19.3.0 for P8; pinned npm lockfile.
- Native `bigint` accounting with explicit chain/token denomination; JSON base
  units are strings. Identity never uses ticker symbols as execution keys.
- Runtime database driver: `pg` 8.23.0; types 8.23.1. Numbered SQL migrations
  in `migrations/` (0001–0008); `DATABASE_URL` is required
  for `npm run db:migrate`. Recovery additionally requires the operator-owned
  `NEXUS_RECOVERY_CONFIG` file for `npm run recovery:once`; see the runbook.
- Tests: Node's built-in runner via explicit `test/run.ts` imports; new suites
  must be registered there. `test/` compiles into ignored `dist-test/`. Set
  `TEST_DATABASE_URL` to run the real PostgreSQL integration suite; without it,
  the suite is reported as skipped.
- Build: TypeScript into ignored `dist/`; `next build web --webpack` into ignored
  `web/.next/`. `npm run demo` runs synthetic data. `npm run web:dev` serves
  `/` fixture and `/workspace` saved UI; `npm run web:start` serves a
  production build locally. Saved state needs migrated `DATABASE_URL` and
  exact `NEXUS_APP_ORIGIN` (default local origin, HTTPS elsewhere). Webpack
  extension aliases resolve shared headless NodeNext `.js` imports.
  `npm run web:e2e` runs Chromium interaction tests after
  `npx playwright install chromium`; `TEST_DATABASE_URL` enables isolated
  PostgreSQL saved-workspace/browser tests. Playwright 1.63.0 is a pinned dev dependency.
- `npm --silent run attestation -- challenge ...` generates a 24-hour EIP-712 request;
  `npm --silent run attestation -- verify ...` checks a local signature and revocation
  list. `ethers` 6.17.0 is pinned for typed-data verification and BSC code
  hashing. Keep signed records under ignored `.agent-memory/`.
- Planned: trusted P6 inputs/allocation refresh, remaining P7 recovery and
  funded-wallet approval qualification, bStocks access/session composition and verified live sources; Agentic Wallet may be added
  later. No Nexus-controlled signing exists. Guarded application submission is implemented but disabled pending qualification.
- Decisions: ADR 0001 (shared memory), ADR 0002 (domain kernel and allocation),
  ADR 0003 (Phase 2 integration gates and quantity semantics), ADR 0004
  (PostgreSQL ledger and leased outbox), ADR 0005 (staged conservative planning),
  ADR 0006 (market evidence boundary and direct V3 decoder), ADR 0007
  (source-timestamped reference and on-chain share mapping), ADR 0008
  (keyless BSC Chainlink source for the two-asset MVP), ADR 0009
  (versioned NYSE calendar), ADR 0010 (Ondo owner declaration and unsupported
  token-risk boundary), ADR 0011 (historical xStocks priority and wrapper
  identity boundary), ADR 0012 (bStocks-first provider priority), ADR 0013
  (bStocks display mapping boundary), ADR 0014 (on-chain transfer boundary),
  ADR 0015 (dual event review), ADR 0016 (EOA-first wallet priority),
  ADR 0017 (exact EOA leg approval), ADR 0018 (bStocks access evidence),
  ADR 0019 (persist-before-broadcast execution), ADR 0020 (receipt-effect
  proof), ADR 0021 (fixture web trust boundary), ADR 0022 (atomic durable
  rule scheduling), ADR 0023 (owner-authenticated saved workspace).

## Required verification

Run:

```bash
./scripts/check.sh
```

Install pinned dependencies with `npm ci` on Node 22.x first. The script validates
required project records, shell and MCP config syntax, then runs tests, strict
type checking, headless build and Next.js web build. It remains the single
entry point for required checks.
For full P3/P4 evidence, run it with `TEST_DATABASE_URL` pointing to an isolated
PostgreSQL test database. A database-free run skips their integration suites.

## Known limitations

- P1 allocation remains pure spending math. The P4 coordinator adds offline
  concentration constraints and durable reservations but cannot establish
  freshness, eligibility, owner authorization or chain state. It must not be
  connected directly to a wallet.
- Registry entries are metadata, not verified token support. Unknown quantity
  models remain read-only; the CLI example identities and balances are synthetic.
  Phase 2 observed real candidate addresses in documentation only; none are
  installed as executable instruments in the application.
- Binance public market status is momentary. Its observed reference-price
  payload did not expose a source timestamp; receipt time does not establish
  underlying price freshness. Exact wallet/venue eligibility evidence is not
  yet bound to an attestation and cannot be inferred from a prior fill.
- Agentic Wallet status returned a false `UNCONNECTED` result in the sandbox;
  the same CLI reported `CONNECTED` outside it. Quote responses expose amounts
  and slippage but no route transaction fields. A separate Kyber route was
  decoded and conditionally simulated with a temporary allowance override,
  not the wallet's then-zero allowance. The connected wallet's exact V3
  allowance and one bounded swap were subsequently confirmed and reconciled.
  This does not establish eligibility or recovery behavior for automation.
  The Binance CLI was
  temporarily unreachable due to DNS on 2026-09-26 and then recovered. A
  successful 5-USDT quote does not guarantee execution at the observed size
  boundary.
- The P3 ledger stores raw balances supplied by a caller; it does not verify
  their chain source or resolve submitted transactions. Outbox delivery is at
  least once and future handlers must deduplicate. A database-free check does
  not exercise concurrency or crash recovery. No P3 worker handler calls a
  wallet. Production deployment roles and backup procedures remain open.
- P4 snapshots match application-ledger balances and immutable registered
  classifications. Their valuation bounds, eligibility flags, proceeds and
  source block are still caller inputs, not externally verified facts. A
  contingent post-sell buy is preview only. P5 must validate market evidence,
  clocks and quantity mapping; P7 must recheck each leg before execution.
- The Pyth reader has only documentation/fixture verification and is dormant.
  BSC Chainlink equity and settlement plus Ondo quantity readers are live-
  tested read-only; public Binance status is a 30-second venue receipt.
  Chainlink's equity feed heartbeat can leave rounds too old
  for the configured trade gate. Regular-session verification, wallet/venue
  attestation, issuer-event/audit evidence and full execution recovery
  are pending.
- The USDT settlement reader now has compatible units and depeg rejection,
  but its production limits and full P5 evidence-bundle behavior remain
  unvalidated. Issuer-event review requires a fresh human-sourced record;
  no `none-confirmed` record was issued from dynamic or inaccessible pages.
- xStocks' current v2 wrapper conversion has been verified read-only, but
  issuer status is not a DEX venue status and neither selected candidate had
  an available 5-USDT Agentic Wallet quote at the recorded time. Other
  venues/filler paths require new route decoding and simulation. Bare xStocks
  rebasing requires explicit ledger reconciliation; legacy v1 wrappers must
  not be registered as supported instruments. xStocks distribution and
  jurisdiction restrictions remain unresolved for production use.
- A valid owner EIP-712 signature proves wallet control and a dated owner
  representation; it does not prove issuer KYC or transfer permission. The
  current CLI's local revocation file is not durable production state. The
  beacon fingerprint detects implementation changes but does not establish
  token safety or match a reviewed audit report to the runtime code. The
  unsupported Binance audit remains a P5 live-use blocker.
- The local MCP memory package should not be written by multiple agent processes
  concurrently. Close one agent and its MCP process before opening the next.
- MCP memory is supplementary and does not replace tests, Git history, decision
  records, specifications, or the change ledger.
