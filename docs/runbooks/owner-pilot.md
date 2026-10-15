# Owner-only NVDAB pilot

Updated 2026-10-02. Work items P5.5a–e, P7.1–P7.3/P7.5, P8.3–P8.4.
Decisions: [ADR 0031](../decisions/0031-owner-only-bstocks-pilot.md) and
[accepted Amendment 1](../0031-amendment-1-pilot-evidence-rules.md).
This is a supervised one-buy engineering pilot, not unattended trading or public
eligibility clearance. Independent review is deferred, not completed.

For a local private-key acceptance runner, use the separate
[funded-EOA instructions](eoa-pilot-runner.md). It collects private evidence by
default and uses these same gates; exact external allowance and one lifetime buy
remain the only two permitted mainnet transactions. Keys never enter the web server.

## Scope and prerequisites

One configured, code-free EOA on BSC; one USDT→NVDAB buy; principal at most five
USDT. A persisted leg consumes the cap even if it later reverts or becomes unknown.
Changing portfolio or profile revision does not reset it. Gas is additional;
the candidate limits valued network cost to 0.5 USDT and requires a 0.001-BNB
reserve. These are policy settings to review, not a quoted gas bill. Allowance
setup also uses gas. Existing NVDAB positions and a subsequent live sale are outside
this one-buy profile; the local simulated sale does not sell mainnet holdings.

Keep Node 22, PostgreSQL and the pinned npm dependencies. Install Foundry locally;
this increment exercised `anvil` and `cast` 1.8.3. Anvil must be available to the
server process. Its fork RPC has to serve the exact requested historical block
and state. `cast mktx` signs; it does not broadcast. The browser path never receives
a private key; the optional runner holds it only in its local operator process.

Use a separate test database for `TEST_DATABASE_URL` and an application database
for `DATABASE_URL`. Apply migrations, including `0009_chain_snapshots.sql` and
`0010_pilot_evidence.sql`, with
`npm run db:migrate`. Do not run the pilot against a test schema or fixture portfolio.
The checks create/remove isolated schemas; they do not fund an owner wallet.

## Inspect and prepare private configuration

Keep owner addresses, personal declarations, signatures and private configuration
outside the repository and MCP memory. CLI output files are exclusive-created with
mode 0600; existing parent symlinks and repository paths are rejected. `/tmp` can
be used for preparation but is temporary; the operator must securely retain needed
records outside the project. No private output is copied into Git automatically.

```bash
npm run pilot:inspect -- --wallet <intended-EOA> --output /private/path/candidate.json
```

This makes public reads only: current full USDT/NVDAB security/control observations,
quantity revision, published NVDA heartbeat and four venue code hashes. The output
is labelled `CANDIDATE_REQUIRES_OPERATOR_REVIEW`. Extract its
`configurationCandidate` object as the private execution configuration, keeping
`broadcastEnabled: false`. Do not use the entire wrapper as runtime configuration.

Review the exact instrument, reviewed source closure and current authority/code
fingerprints, route hashes, fee ceilings and price settings. The candidate leaves
`acceptedFindings` empty. Record each specifically accepted issuer-trust finding
for each asset/provider under the cap; retain the original scanner state, findings
and unknown coverage. Only profile-permitted findings can be accepted. Actual tax,
failed sell, missing executable/governance observation, changed permissions, pause,
blacklisting or pending multiplier changes cannot be accepted through this profile.
Inspection alone does not accept a finding or establish an independent audit.

The declared candidate price policy is `min(200, 100 + ceil(ageMs × 10 / 3600000))`
basis points, using the published 86,400-second NVDA heartbeat. This is an explicit
policy, not a calibrated volatility estimate. USDT uses a 1,350-second limit (900-second heartbeat × 1.5) and at most
50 bps deviation from one dollar. Boundaries are inclusive. NVDA must have an
update from today’s regular-session open, even within its 24-hour heartbeat.
Only the regular NYSE session is allowed. DEX mid, preview output and signed minimum
must fit the current band. An old round does not prove an unchanged market price. Gas is excluded from
these price ratios and must fit both absolute native and USDT fee caps in profile v2.
The native cap is derived from the current RPC gas hint and reviewed ceilings.
Full source history and every P1–P9 reason are retained in PostgreSQL’s private
`pilot_feed_highwater` / `pilot_price_observations` tables. Missing persistent
history wiring blocks pilot collection. A profile revision does not reset history.
`maxBlockLag: 2048` accommodates five-minute signing on subsecond BSC blocks;
actual current balances/nonce, controls, prices and simulation are checked separately.

Configuration paths are server-owned environment variables:

```bash
export NEXUS_EXECUTION_CONFIG=/private/path/execution.json
export NEXUS_PILOT_RECORDS=/private/path/pilot-records.json
export NEXUS_RECOVERY_CONFIG=/private/path/reviewed-recovery.json
```

Recovery assets must cover BNB, USDT and NVDAB with canonical raw-transfer guards.
The checked-in `config/bsc-recovery.json` is the existing review candidate; recheck
RPC availability and code guards instead of assuming indefinite qualification.
`NEXUS_TOKEN_SECURITY_REVIEWS` remains separate; an empty registry is not a review.
The explicit pilot handles deferral, while strict execution continues to require it.
Set `NEXUS_APP_ORIGIN` to the exact web origin and privately configure `DATABASE_URL`.

## Reviewed access, economics and notices

[Recovered primary documents](../integrations/2026-10-02-owner-pilot-sources.md)
include the ADGM NVDAB prospectus and Chainlink heartbeat directory. Owner-only
jurisdiction checks now use J1–J5: the current ADGM register's latest NVDAB primary
and every potentially applicable issuer supplement, Binance's current published
bStocks restriction notice, signed representations and a private dated local-law
decision. No affirmative issuer sign-off is required for this pilot. The operator
reviews country lists against exact document bytes; absence from BOTH fresh lists
satisfies this issuer-list test only. Listed countries deny; missing, changed or
expired evidence remains unknown and blocks. Public-service legal review and
issuer third-party/country-API terms remain separate open work.

J5 records only that the owner made a local-law decision, its date and rules
revision, without storing its content or advice. After a material rules change,
update that revision and reaffirm the decision privately, then obtain a new
signature binding it. Nexus does not establish legal permission independently.

The private JSON schema is `PilotManualRecords` in `src/pilot/manual-records.ts`.
Supply every required record rather than interpreting a missing value as “clear”:

| Field | Required content |
| --- | --- |
| `version`, `revision`, `profileRevision` | Version 2, immutable review revision and exact configured profile revision |
| `allowanceApprovalTransactionHash` | Canonical successful exact-input setup approval, described below |
| `reviewedControl` | Reviewed quantity snapshot control object, exactly matching current on-chain facts |
| `jurisdiction` | ADGM prospectus URL, digest, section, review/expiry, reviewed `restrictedCountries`, prospectus-supported external-secondary permission |
| `jurisdiction.currentRestrictions` | Current Binance bStocks FAQ section 16 (or an explicitly reviewed successor), digest, reviewed restriction list, section and review/expiry; reviewed no more than 24 hours ago |
| `jurisdiction.prospectuses` | Complete current register manifest: each `sourceUrl`, `approvalDate`, `type`, SHA-256 `documentDigest`, reviewed section, review/expiry and `restrictedCountries`; manifest changes require re-review and a new signature |
| `localLawDecision` | Private `recordedAt`, `reaffirmedAt`, nonempty `rulesRevision`; no advice/content |
| `declaration` | Exact owner wallet, residence/access ISO country codes, non-US/non-US-benefit/offshore/transfer-restriction affirmations, `notRestrictedPerson`, `notRestrictedJurisdiction`, exact `localLawRulesRevision`, issued/expiry (at most 24 hours), random bytes32 nonce, owner signature |
| `mapping` | ADGM URL/digest/section/review/expiry, exact mapping revision and UI multiplier, revisioned `mode: dual` or `reviewed`, exact conservative share ratio and substantive denomination rationale; reviewed mode also pins raw/display and exact cited clause/page/document digest |
| `event` | Primary NVIDIA investor/news source, digest/section/review/expiry and explicit underlying-company event evidence |
| `providerEvent` | Primary Binance/ADGM notice source, digest/section/review/expiry and separate instrument/provider notice evidence |

Public record digests are SHA-256 of the fetched response bytes, not pasted text
or screenshots. Use reviewed stable documents/pages. Changed bytes, failed fetches,
expired records or changed on-chain controls block until reviewed anew. Company
and issuer records are distinct; “none-confirmed” needs evidence of checked coverage.
Event evidence includes source, exact identity/source URL, revision, confirmation,
eventAt and blackoutStart/blackoutEnd (nullable when supported by the review).

Store bigint fields as canonical decimal strings. In particular, the manual mapping
UI multiplier and share numerator/denominator are bigint quantities. The collector's
security `controls.uiMultiplier` is deliberately a canonical string. The economic
formula is `shareUnits18 = rawUnits × numerator / denominator`; pricing multiplies
by USD-18 per share and divides by 10^18. The prospectus's eight-place rounding is provisionally primary issuance/redemption
only; secondary raw transfers are integer units. In `mode: dual`, raw shares are
`raw / 10^18` and display shares `raw × uiMultiplier / 10^36`. Both must pass all
price bounds; exposure uses the larger exact ratio. `shareUnitsNumerator` and
`shareUnitsDenominator` must match that larger ratio. A reviewed single mapping
requires `interpretation: raw | display` and `clause: {text, page, documentDigest}`
against the current primary prospectus. Revise and re-sign the entire record to
switch modes. There is no deployment flag bypass. Pending multipliers block;
active multiplier/mapping changes invalidate existing records and approvals.
Current USDT lower valuation also conservatively reduces cash used in P4 caps.

After all records, including the exact allowance receipt, are final, export the
bound eligibility typed data; the temporary declaration `signature` may be empty:

```bash
npm run pilot:declaration -- --output /private/path/eligibility-typed-data.json
cast wallet sign --data --from-file /private/path/eligibility-typed-data.json --ledger
```

A locally encrypted keystore can use `--account <local-name>` instead of `--ledger`.
Review the private original records and typed wallet/profile/records/declaration
hashes before signing. Put the returned signature into `declaration.signature`.
Changing any bound record requires a new declaration signature. This signs an owner statement; runtime verification checks current source bytes,
country lists, local-decision revision, chain compliance and expiry separately.

## Exact allowance setup, then signed chain initialization

The existing raw import path signs swaps only. This increment explicitly treats
allowance as an external owner setup leg with independently verified canonical
receipt, not a Nexus-persisted/broadcast leg. If no exact allowance is present,
review a separate approval from the intended owner to BSC USDT
`0x55d398326f99059ff775485246999027b3197955`, spender Pancake router
`0x1b81d678ffb9c0263b24a97847620c99d213eb14`, amount `5000000000000000000`,
value zero, chain 56, current nonce and bounded gas. Do not approve unlimited.
For a smaller configured cap, use that exact configured amount instead.

An offline signing form, with operator-reviewed setup gas/nonce values, is:

```bash
cast mktx 0x55d398326f99059ff775485246999027b3197955 \
  'approve(address,uint256)' 0x1b81d678ffb9c0263b24a97847620c99d213eb14 \
  5000000000000000000 --chain 56 --nonce <current-nonce> \
  --gas-limit <reviewed-setup-gas> --gas-price <reviewed-max-fee-wei> \
  --priority-gas-price 0 --value 0 --ledger
```

The owner separately chooses whether to broadcast this approval through their wallet.
Nexus does not send it. Record its hash privately; the collector verifies decoded
amount/spender, exact matching Approval event, successful receipt, canonical block
and at least 12 confirmations. Actual buy allowance must still equal the input. The verified approval block
must be at or before the activated initial bootstrap block, ensuring its nonce
and gas effects belong to the signed initialization snapshot.
Finish this setup before bootstrap; it changes the owner's nonce and native balance.

In `/workspace`, sign in, create/select the owner portfolio and keep it paused.
The configured pilot panel is in Review. Request chain initialization, inspect the
server-derived finalized BNB/USDT/NVDAB balances, nonce, block/hash and explanation,
then acknowledge and sign the snapshot. The server rechecks all facts on activation.
Activation creates exactly one new chain revision and retains the pause. A later
owner unpause is separate. Existing holdings or insufficient funds block planning.

## One bounded trade and acceptance evidence

1. Unpause explicitly and create the supervised pilot plan in Review. It registers
   the immutable configured NVDAB instrument and active configured coordinator
   policy, reserves the full configured cash amount and native reserve, and produces
   one buy. Existing different policy/metadata is not overwritten. Retries are
   idempotent; the plan reservation lasts ten minutes.
2. Prepare an exact trade review. Current access, economic, event, feed, control and
   real-state simulation evidence must pass. The local Anvil fork starts at the
   canonical snapshot with no generated accounts or storage/balance overrides.
   It impersonates the actual wallet only on loopback, buys then sells exactly the
   acquired raw stock and proves zero transfer-tax effects; failure blocks.
3. Review the pilot disclosure: independent review deferred, preserved scanner gaps/
   findings, exact cap, true reference time/age/band, route, minimum, nonce, fee ceiling
   and expiry. Sign the exact trade's EIP-712 approval in the existing screen.
4. Sign its displayed type-2 transaction without sending. For raw import, take
   `to`, raw `data`, nonce, gas and max fee from the exact displayed template:

   ```bash
   cast mktx <reviewed-router> <reviewed-raw-calldata> --chain 56 \
     --nonce <reviewed-nonce> --gas-limit <reviewed-gas> \
     --gas-price <reviewed-max-fee-wei> --priority-gas-price 0 --value 0 --ledger
   ```

   Paste the signed `0x02…` bytes into Import and validate/store. Nexus checks the
   decoded identity, full fields and original signature; importing a hash is invalid.
   The installed cast was checked to emit a type-2 unsigned template with these
   explicit flags. Hardware/keystore signing itself remains owner acceptance evidence.
5. Persistence and pre-broadcast both refresh complete current evidence. The signing
   window is at most five minutes and the quote's deadline/expiry. Short status leases
   cause refresh, not expiry on their own. Changed semantic facts require a new review.
   Do not change deployment flags after signing: configuration is approval-bound.
   Only a qualified, operator-enabled deployment plus a fresh exact owner approval
   exposes the separate Submit stored transaction action. Default broadcasting is off.
6. Submit once. Timeout leaves an unknown committed claim; never submit again blindly.
   Run `npm run recovery:once` with the same reviewed registry. Pilot reconciliation
   requires a canonical receipt-block USDT→router allowance of exactly zero.
   Unavailable proof waits; nonzero allowance records an incident and freezes the
   portfolio with submitted funds still reserved. Restart does not erase this check. Preserve canonical
   receipt, exact before/after balances/raw Transfer effects, actual gas, reconciled
   revision and the signed identity `(from, nonce, hash)` privately. Restart and run
   again; verify no second fill/revision/send. PostgreSQL tests exercise this behavior;
   the actual owner mainnet result is still a separate gate.

Only a completed acceptance packet closes this pilot: profile/deferrals, qualified
access/mapping/notices, true reference/band, prepare/pre-submit fingerprints, real
round-trip/quote/simulation, signatures, canonical receipt/effects, reconciliation
and restart-without-duplication. Check results alone do not close P5.5/P7/P9 live gates.

## Price probes and resync

```bash
npm run pilot:prices -- --output /private/path/prices-1.json
npm run pilot:prices -- --output /private/path/prices-2.json --history /private/path/prices-1.json
```

These commands only read public sources and write diagnostics: true reference age,
observed per-session update intervals, raw pool mid, reviewed normalized deviation,
source outages, heartbeat overruns and source-time regression. Missing reviewed
mapping leaves normalized deviation unavailable; no raw/display assumption is made.
Repeat during the regular session to build cadence evidence. A probe sees observed
updates only, not every round between probes; there is no background price scheduler
or automatic admission from a monitoring report. Feed-use/redistribution terms still
need operator review before public price display.

For acknowledged external balance/nonce changes with no unresolved legs, pause first,
request Review chain resync with a concrete diagnosis/reason, inspect the new finalized
snapshot and sign activation. It creates a new revision, invalidates held plans,
preserves history and stays paused. The new nonce/block is recorded as acknowledged
external state; this is not a complete transaction-by-transaction external activity
classification. Repeated activation is idempotent.

Submitted, unknown, replaced, reorged and unresolved signed legs cannot be released
by resync. Recovery uses historical nonce-count binary search from the first signed
bootstrap anchor, checks the canonical transition transaction/receipt, and records a
replacement as diagnosis only. Missing historical state or receipts stays unavailable.
Applied deep reorgs stay frozen until the narrow signed R1 path below succeeds
or general repair is implemented; resync cannot rewrite a fill or erase an obligation.


## Applied-fill reorg: R1 only

A counted fill whose original receipt block is no longer canonical remains frozen.
Chain resync rejects it. Migration 0010 preserves the original complete receipt,
raw before/after balances and allowance proof. Existing fills with only an old
proof digest cannot use R1; retain the incident for general repair.

For R1, configure at least two recovery sources with distinct, explicitly reviewed
`independence.upstreamGroup` values, plus `reviewDigest` and `reviewedAt`. IDs or
different URLs do not establish independence. The checked-in endpoints have no
such review yet, so this correction stays blocked until that review is recorded.
Each source must support BSC `finalized` block tags, canonical receipts and the
required historical state. Do not relabel one upstream as two groups.

In the paused portfolio's Trade approvals, choose **Review re-included fill**.
Nexus verifies the original block is noncanonical, the exact same transaction's
nonce is consumed once, and its new canonical finalized receipt has identical
ordered log contents, raw deltas and gas. It verifies the whole tracked ledger
against both finalized sources. Changed effects/balances, later unexplained nonces,
source disagreement, replacements and unavailable history block.

Review the new anchor, original proof/evidence/configuration hashes, before/after
revisions and five-minute deadline. Explicitly acknowledge and **Sign recovery
correction**. The owner signature is verified again, sources are re-read, then
PostgreSQL appends one compensating revision without modifying balances, consumed
reservations, fill amounts or the immutable original proof. The leg's current
anchor follows the new receipt; signed transition and original anchor stay in
history. Replay is a no-op; competing transitions are rejected. Trading stays
paused. A second incident on an already corrected leg requires general repair.

R2 reversal/replacement and R3 wait/cancellation are manual incident procedures
pending U11. No cancellation or replacement transaction can be sent from this path.
A reorg beyond finality is logged as a chain incident. Operator source reviews and
real incident evidence are distinct from the synthetic PostgreSQL/browser tests.
