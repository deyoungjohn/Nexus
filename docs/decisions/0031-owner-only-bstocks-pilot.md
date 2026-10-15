# ADR 0031 — Owner-only NVDAB pilot admission and chain initialization

Date: 2026-10-02. Status: accepted for implementation by the owner’s instruction
“Do what he said,” referring to `NEXUS_SENIOR_ENGINEER_RESPONSE.md`.
[Amendment 1](../0031-amendment-1-pilot-evidence-rules.md) supersedes the access,
economic, feed, allowance and disputed-fill details below for profile v2. Original
context is retained. Strict admission and deferred independent review are unchanged.

Work items: P5.5a–e, P7.1–P7.3/P7.5, P8.3–P8.4.

## Context and decision

The strict production profile requires complete scanners, a qualified independent
review and finding-free security reports. Current bStocks evidence cannot satisfy
that conjunction. Implement a distinct, versioned owner-only pilot, while retaining
strict admission as the default. This is authority to implement the pilot, not an
exact allowance/trade approval or proof of issuer eligibility.

The profile permits one USDT→NVDAB buy on chain 56 for one configured EOA, up to
five USDT, through the existing exact PancakeSwap V3 route. A persisted buy consumes
the allowance even if submission becomes unknown or later reverts. Lock by wallet
as well as portfolio; a new portfolio/profile revision cannot reset the cap. Existing
holdings and other route assets are outside pilot scope. No scheduler or basket is
required before that fill. A later exit trade requires a separately approved scope.

Keep scanner states, findings and explicit coverage unchanged. Independent review
is **deferred**. Permit only specifically recorded issuer-trust cautions, with an
exact current full source/control/authority/governance fingerprint for both tokens.
Do not accept unknown executable code, missing privileged-controller observations,
changed roles/owners, pause, pending changes, actual transfer tax or failed sell.
A same-block real-owner Anvil buy/sell scenario must consume the whole input and
prove matching raw wallet/pool Transfer effects in both directions. It is route
behavior evidence, not an independent contract audit or a guarantee about future
issuer actions. No balance/storage override or mainnet write is available to it.

Reference age uses the feed’s published heartbeat and true round timestamp during
the regular NYSE session only. The public Chainlink BSC directory lists NVDA/USD
heartbeat 86,400 seconds. An old round is not proof that the price stayed unchanged.
Use explicitly configured linear age-band parameters, capped at 200 basis points;
this is a simple bounded pilot policy, not a fitted volatility model. Check both
the expected output and the signed worst-case minimum. The operator must review
parameters and source terms; no unconfigured price policy grants admission.

A configured renewable signing clock lasts at most five minutes and the original
quote expiry/on-chain deadline/quote-age limit. Original evidence is verified at
issuance; complete current evidence is checked at persistence and again before the
one-time broadcast claim. Semantic price, permission, issuer notice, mapping,
scanner findings and control changes invalidate approval. Refreshing observations
cannot change the signed evidence hash or transaction. Default original-lease
behavior remains compatible. Raw signed bytes still precede every broadcast.

USDT settlement freshness has a separate optional 900-second heartbeat limit;
the default remains the original status-age limit. Instrument metadata now accepts
namespaced reference/status identifiers so an exact Chainlink feed ID can be
registered. The candidate's 2,048-block lag limit accommodates five minutes on
subsecond BSC blocks, while fresh complete balances/nonce, controls and real-state
simulation still protect persistence/claim. Price probes record observed cadence,
raw pool mid, qualified mapping-dependent deviation, outages and clock regressions;
sampling does not certify rounds missed between probes or grant admission.

## Access boundary

The recovered ADGM NVDAB prospectus describes external on-chain secondary investors
and their representations. Its dated restricted-country list does not name Nigeria;
it can be amended. This supports a separately labelled prospectus/current-source
review plus an expiring owner-signed declaration for the owner-only pilot. It does
not qualify Nexus to serve the public or impersonate Binance’s country API.

Manual records must cite primary documents, bind their digests and sections, record
current country/product permission, reconcile certificate/raw denomination, and
check company and issuer notices. A changed source or expired review blocks. Signed
residence/location statements stay in private storage, outside Git/shared memory.
The owner must acknowledge non-US status/benefit, offshore acquisition and transfer
restrictions. Actual wallet/pool/router compliance and pause checks remain required.
ADR 0018 stays in force for general third-party users; this narrow owner-only path
has a different evidence-source label.

## Initialization and recovery

Owner-signed server-derived finalized BNB/USDT/NVDAB snapshots establish chain data
and a trusted nonce-history starting block/hash. Initialization and signed resync
create new revisions, invalidate held plans and preserve decisions/fills. Both keep
execution paused. Activation rechecks the canonical block, complete balances and
nonce against the latest/pending state. An explicit later owner unpause is separate.

Use historical nonce counts to binary-search the canonical block consuming a
missing receipt’s nonce, then verify the matching transaction and canonical receipt.
Unqualified historical reads, inconsistent intervals or reorgs remain unavailable.
A found replacement is diagnosis, not authorization to reconcile its effects.

Pilot resync is deliberately limited to portfolios with no signed/unreconciled,
submitted, replaced or reorged legs. A reason and owner signature are mandatory;
an idempotent replay creates no duplicate revision. Deep-reorg and disputed-fill
repair remain frozen until a separate reviewed repair mechanism exists. Do not
silently overwrite historical fill accounting with a new balance snapshot.

## Deferred and acceptance

Deferred: commissioning independent audit, full scanner coverage, unattended
scheduler/post-fill allocation refresh, baskets/additional providers, general repair,
general-release legal/operational qualification, and sendTransaction-based identity.
No deferred item is marked completed. Prototype/API/scenario verification is distinct
from real owner-wallet allowance, trade receipt/effect proof and restart acceptance.
The latter require the intended EOA, current reviewed records and fresh exact owner
approvals. See the [pilot runbook](../runbooks/owner-pilot.md).

Repository inspection identified that raw import verifies swaps only. Keep exact
allowance as a separately owner-signed/submitted external setup leg, with decoded
exact amount/spender, unique matching Approval event, canonical successful receipt
and finality independently checked by Nexus. Setup precedes the signed bootstrap.
This is not a Nexus-persisted approval leg. The private declaration export binds
the exact allowance receipt and all reviewed facts; it performs no signing/send.
The [senior follow-up](../SENIOR_ENGINEER_FOLLOWUP.md) asks whether this narrower
boundary is sufficient, along with current eligibility, denomination, price and
disputed-accounting questions. These are not silently marked resolved.
