# Questions after implementing the senior engineer's pilot recommendation

Prepared 2026-10-02. Answered by [response002](response002.md) and
[Amendment 1](0031-amendment-1-pilot-evidence-rules.md); original questions are
retained below as historical context. Companion to [your response](NEXUS_SENIOR_ENGINEER_RESPONSE.md),
[ADR 0031](decisions/0031-owner-only-bstocks-pilot.md) and
[the source recovery](integrations/2026-10-02-owner-pilot-sources.md).

We implemented the bounded profile, private reviewed ports/declaration, five-minute
renewable signing, actual-wallet local buy/sell adapter, owner-signed finalized
bootstrap/resync, logarithmic nonce diagnosis, one-trade planning and browser wiring.
Strict admission remains the default. No scanner unknown became a pass and no deferred
independent review became completed. The actual mainnet fill is still pending.

## 1. What current evidence clearly permits the owner's jurisdiction?

We recovered the June 11 ADGM NVDAB prospectus directly from the approved register.
PDF page 5 explicitly includes external on-chain secondary addresses. Pages 8–9
list restricted jurisdictions without Nigeria, but the list may be amended and
communicated through Binance. Section 3.4.1 imposes non-US/offshore and secondary
transfer restrictions even for external recipients. Absence from the dated list
is insufficient to satisfy your “clearly permitted” hard stop on its own.

**Question:** which current primary restriction notice or explicit issuer statement
would you accept for an owner trading through an external EOA? Is an unchanged,
currently fetched issuer restriction list plus the expiring signed representations
sufficient, or is affirmative issuer confirmation required? Please point to the
specific source and the reasoning. Public third-party integration/API terms remain
separate; we have not claimed general-user clearance.

## 2. What is the exact raw-unit-to-share-exposure formula?

Sections 3.1–3.2 describe 1:1 certificate/share exposure, reinvested net dividends,
multiplier adjustments and eight-place issuance rounding. The actual token reports
18 raw decimal places and a non-unit UI multiplier. That establishes a display
mapping; it does not by itself establish the economic conversion to shares.

**Question:** is economic share exposure `raw / 10^18 × currentMultiplier / 10^18`,
or a different ratio? Please cite the exact certificate/contract provision connecting
raw units to the multiplier and clarify whether eight-place rounding applies only
to issuance or also to secondary transfers and valuation. The implementation accepts
an explicit reviewed ratio and checks its revision/multiplier; it does not infer one.

## 3. Are these declared pilot price parameters acceptable?

The published Chainlink BSC directory reports a 24-hour NVDA heartbeat and 0.5%
deviation trigger; USDT's heartbeat is 900 seconds. We retain actual round time,
permit only the regular NYSE session, and check expected plus signed worst-case output.
The candidate band is `min(200, 100 + ceil(ageHours × 10))` basis points, under a
five-USDT principal cap. It is a declared policy, not a fitted volatility model.
Price diagnostics record observed cadence, DEX mid deviation, outages and regressions.

**Question:** should the pilot additionally require a round generated in the current
regular session, rather than any round within the 24-hour heartbeat? Do you accept
the candidate band for the capped pilot, or propose different explicit parameters
and a concrete outage rule? An old round is not evidence of an unchanged price.

## 4. Is separate owner allowance setup acceptable for this first fill?

Repository inspection found the raw-import path verifies swaps only. We preserved
that interface instead of pretending it supports approval legs. The owner separately
signs/submits an exact-amount approval; Nexus checks decoded fields, a unique exact
Approval event, successful canonical receipt and finality. Current actual allowance
must equal the trade input. This happens before signed bootstrap, so its nonce/gas
changes are part of the trusted initial snapshot.

**Question:** is that explicit external setup boundary acceptable for the pilot,
or should we add a separately persisted Nexus approval-leg type before the first
mainnet fill? Offline cast type-2 construction was exercised; actual hardware/local
keystore signatures remain owner acceptance work.

## 5. What evidence is needed before resyncing disputed accounting?

Implemented resync creates an idempotent signed finalized revision, records a reason,
invalidates held plans, preserves history and retains pause. It rejects any unresolved
signed/submitted/unknown/replaced/reorged leg. Binary nonce diagnosis verifies the
canonical transition transaction and receipt but never adopts replacement effects.
A new nonce is an acknowledged external-state boundary, not complete classification
of every intervening external transaction.

**Question:** for your suggested deep-reorg “freeze and resync,” what operator evidence
and accounting correction are required before a disputed historical fill can be
superseded? We kept that case frozen because directly overwriting balances while
preserving an already counted fill could hide an obligation. General repair stays
post-pilot unless you specify a safe narrower transition.

## Evidence and remaining owner actions

Application/PostgreSQL and browser verification is recorded in the engineering log.
Actual intended-wallet inspection and configuration candidates are kept outside Git
and shared memory. Funding, current qualified records, owner signatures, one mainnet
receipt/effect proof and restart acceptance remain pending. We have neither sent a
transaction nor contacted the issuer. The [runbook](runbooks/owner-pilot.md) explains
how to provide records and complete the owner steps without supplying private keys.
