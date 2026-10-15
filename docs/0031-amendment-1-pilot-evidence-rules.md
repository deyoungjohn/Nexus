# ADR 0031, Amendment 1: Pilot evidence rules after first implementation

- **Status:** Accepted for implementation by owner instruction, 2026-10-02
- **Date:** 2026-10-02
- **Amends:** [ADR 0031](decisions/0031-owner-only-bstocks-pilot.md), owner-only bStocks pilot
- **Context documents:** [SENIOR_ENGINEER_FOLLOWUP](SENIOR_ENGINEER_FOLLOWUP.md), [NEXUS_SENIOR_ENGINEER_RESPONSE](NEXUS_SENIOR_ENGINEER_RESPONSE.md), [owner pilot sources](integrations/2026-10-02-owner-pilot-sources.md)

> Accepted engineering specification. Profile v2 binds this amendment; private manual records v2 bind restriction manifests, owner representations and the local-law decision. Acceptance of engineering work does not supply an owner signature or legal opinion.

## 1. Context

ADR 0031 established a bounded, owner-only pilot profile while keeping strict admission as the default. Implementation surfaced five questions that ADR 0031 left open or stated too loosely:

1. What evidence satisfies the jurisdiction hard stop.
2. How raw NVDAB units map to economic share exposure.
3. Whether the declared price band and freshness rules are sufficient.
4. Whether an externally signed allowance is acceptable before the first fill.
5. What may be done to a disputed, already-applied fill.

This amendment settles each one for the pilot profile only. It does not change strict admission, does not convert any scanner unknown into a pass, and does not record deferred independent review as completed.

## 2. Decisions

### D1. Jurisdiction evidence (replaces the "clearly permitted" wording in ADR 0031 (manual evidence and recovery boundaries))

The NVDAB prospectus defines restrictions as a restricted-jurisdiction list (pages 8–9) that may be amended and communicated through Binance, plus the section 3.4.1 transfer restrictions. A secondary buyer satisfies this mechanism by checking the list and its amendment channel at trade time. **Affirmative issuer confirmation is not required for the owner-only pilot.**

The access port passes for a trade only when **all** of the following hold:

| # | Evidence | Freshness | Failure behavior |
| --- | --- | --- | --- |
| J1 | Current NVDAB prospectus and every supplement, retrieved from the ADGM FSRA register; digests recorded | Re-fetched per trade; digest change requires re-review before the next trade | Fetch failure or digest change = `unknown` = block |
| J2 | Binance's current published bStocks restriction notice (the bStocks FAQ section 16 or its successor channel); digest recorded | Re-fetched per trade | Fetch failure or digest change = `unknown` = block |
| J3 | Owner's jurisdiction absent from J1 and J2 | Evaluated per trade | Present = `denied` |
| J4 | Owner-signed representations: not a US person; not resident in or acting from a restricted jurisdiction; not a restricted person; acknowledges section 3.4.1 | Existing expiry in ADR 0031 (manual evidence and recovery boundaries) | Expired or missing = block |
| J5 | Owner-recorded local-law decision (see below) | Re-affirmed when Nigerian rules change materially | Missing = block |

**J5 local law.** The issuer's list covers BTech's restrictions, not the owner's home law. Nigeria's Investments and Securities Act 2025 classifies virtual and digital assets as securities. The SEC's 2021 directive on foreign listed securities, and its July 2026 draft cross-border trading rules, address intermediaries such as fintech platforms and brokers rather than an individual acting for their own account. J5 is therefore the **owner's own recorded decision**, ideally after consulting Nigerian counsel. Nexus records that the decision exists and when it was made, not its content or advice.

**Out of scope.** J1–J5 do not authorize Nexus to serve any user other than the owner. Serving others places Nexus in the intermediary role these rules address and requires a separate ADR with legal review. The issuer's third-party integration and country-API terms remain open with the issuer.

Personal records stay in private storage. Git holds only digests, timestamps and pass/deny/unknown outcomes.

### D2. Economic exposure mapping

BEP-677 (EIP-8056) defines **display** units: `uiAmount = raw × uiMultiplier / 10^18`, with an 18-decimal multiplier. bStocks use the multiplier for splits, reverse splits and dividend reinvestment. With 18 token decimals:

```
displayUnits = raw / 10^18 × uiMultiplier / 10^18
```

The standard defines display only, not legal entitlement. The reviewed mapping record must therefore cite the prospectus provision (expected in sections 3.1–3.2) that ties the certificate count to the display or multiplier-adjusted balance.

- **TODO (owner/reviewer):** record the exact clause and page number in the mapping record.

**Until that clause is recorded,** the pilot uses dual interpretation:

- Interpretation A, raw: `shares = raw / 10^18`
- Interpretation B, display: `shares = raw × uiMultiplier / 10^36`

The price check (D3) must pass under **both** interpretations, and concentration and exposure caps use whichever interpretation yields the larger exposure. Diagnostics record the premium against the reference under each interpretation. When the clause is recorded, the mapping record pins one interpretation and the dual check is removed by a revision of that record, not by a config flag.

**Multiplier rules (unchanged from ADR 0031, restated):** a pending multiplier (`newUIMultiplier` with a future `effectiveAt`) blocks new trades. Any change to the active multiplier invalidates the mapping revision and any approval bound to it.

**Rounding.** The prospectus's eight-place rounding is treated as applying to primary issuance and redemption. Secondary transfers are integer raw units. Valuation is exact (rational or integer arithmetic), with conservative rounding only at decision thresholds. Redemption is out of pilot scope, so this reading must be confirmed before redemption enters any profile.

### D3. Price policy

**D3.1 Current-session round required.** During the regular NYSE session, the pilot requires an NVDA/USD round with `updatedAt ≥ today's regular-session open`. A round within the 24-hour heartbeat but before the session open is **not** sufficient. Outside the regular session the pilot blocks, as ADR 0031 already specifies.

Rationale: with a 0.5% deviation trigger, an old round means "moved less than 0.5%" only if the feed is live, and a quiet market cannot be distinguished from a stalled feed. For a capped pilot, blocking is the cheap failure. A future profile may relax D3.1 only with an explicit liveness test, for example several sibling equity feeds from the same feed network updating in-session.

**D3.2 Band accepted.** The declared band `min(200, 100 + ceil(ageHours × 10))` bps is accepted for the pilot, under the five-USDT principal cap. The 100 bps floor covers the feed's 0.5% deviation tolerance plus the 0.25% pool fee. Narrowness can only cause blocks, which are safe. The band is a declared policy, not a fitted model, and must be labelled as such in diagnostics.

**D3.3 Gas is excluded from the band.** Network fees are checked against a separate absolute cap. They are not counted against the price band, because pricing the full gas ceiling against a 5 USDT principal would consume most of the band. The pilot gas cap is derived from current BSC gas prices at review time and recorded in the profile. The smoke values (300,000 gas, 5 gwei) are not adopted.

**D3.4 Outage and integrity rules.** Any one of the following blocks the trade and logs a reason code:

| Code | Condition |
| --- | --- |
| P1 | Answer ≤ 0, or `answeredInRound < roundId` |
| P2 | `roundId` or `updatedAt` lower than the last observed value (regression) |
| P3 | `updatedAt` later than the observed block timestamp |
| P4 | No NVDA round since the current regular-session open (D3.1) |
| P5 | USDT/USD round older than 1,350 s (900 s heartbeat × 1.5) |
| P6 | USDT/USD more than 50 bps from 1.0000 |
| P7 | DEX mid deviates from the reference by more than the band, under either D2 interpretation |
| P8 | Expected or signed worst-case output outside the band |
| P9 | Gas ceiling cost exceeds the absolute gas cap (D3.3) |

Logged block reasons are the cadence dataset for any later relaxation.

### D4. Allowance setup

The external, owner-signed exact-amount approval described in the follow-up is **accepted for the first fill**. No persisted Nexus approval-leg type is required before it.

Conditions (existing checks restated, plus one addition):

1. The approval is decoded and its fields verified, with exactly one matching Approval event, a successful receipt and finality, all before the signed bootstrap, so its nonce and gas effects are part of the trusted snapshot.
2. Allowance at prepare time equals the trade input exactly.
3. **New:** post-fill reconciliation requires the USDT allowance from the owner to the router to be **exactly zero**. A nonzero remainder means the swap did not consume what was approved, and freezes the portfolio pending diagnosis.

A persisted approval-leg type becomes required before any profile that permits more than one trade, or any approval not immediately consumed by a single reviewed swap.

### D5. Disputed applied fills (replaces the "freeze and resync" suggestion for this case)

An already-applied fill whose receipt block is no longer canonical **remains frozen**. `resyncFromChain` must continue to reject it. Correction is a **compensating entry, never an overwrite**, and is permitted only through the following evidence sequence:

1. **Non-canonical proof.** The original receipt block hash is absent from the canonical chain at a finalized head, confirmed by at least two independent configured RPC sources that do not share a known upstream.
2. **Nonce diagnosis** for the leg's `(from, nonce)` produces exactly one outcome:
   - **R1, re-included:** the same transaction hash is in a different canonical block. Re-anchor the fill's block reference after verifying that the receipt effects (logs, raw balance deltas, native gas) are identical. There is no balance change and the revision advances.
   - **R2, replaced:** the nonce was consumed by a different transaction. Append a reversal of the original fill. Then classify the canonical transaction: if it is a Nexus leg, apply it through the normal reconciliation path; otherwise record an acknowledged external-state boundary.
   - **R3, unconsumed:** the nonce has not advanced. The transaction may still be pending, so no reservation or funds are released. Resolution is either waiting, or an owner-signed zero-value self-transfer at that nonce whose finalized receipt is the decisive evidence, after which R2 applies.
3. **Post-condition.** After the correction, ledger balances for all tracked assets equal chain balances at the finalized block. Otherwise the portfolio stays frozen.
4. **Authorization.** The owner signs a transition record that binds the evidence digests from steps 1–3, the before and after revisions, and the outcome code.
5. **Idempotency.** Replaying the same transition record is a no-op. A competing transition for the same leg is rejected.

**Pilot scope.** Only **R1** may be implemented before the pilot, because it involves no balance change. R2 and R3 remain manual incident procedures until a general repair ADR (U11). Given BSC fast finality, a reorg past finality is treated as a chain-level incident and recorded as such.

## 3. Consequences

**Positive**
- The jurisdiction gate becomes satisfiable from primary sources without inventing an issuer process, while unknowns still block.
- The pilot no longer depends on an unconfirmed economic ratio. The dual check makes the ambiguity safe and measurable.
- Price evidence is strict where it is cheap to be strict, and gas no longer distorts the band.
- The disputed-fill path cannot hide an obligation.

**Negative and residual**
- D3.1 will block quiet sessions. This is accepted for the pilot.
- J5 depends on an owner judgement Nexus cannot verify.
- The issuer can still amend restrictions through channels Nexus does not monitor between trades. Per-trade re-fetch of J1 and J2 bounds but does not eliminate this.
- Issuer freeze, upgrade, custody and redemption risks are unchanged and bounded only by the exposure cap.

**Explicitly not changed:** strict admission defaults; scanner unknown handling; the deferred independent-review status; one-trade planning; persist-before-broadcast; no resend on timeout.

## 4. Required tests

| Decision | Tests |
| --- | --- |
| D1 | J1 or J2 fetch failure gives `unknown` and blocks; digest change blocks until re-reviewed; jurisdiction listed gives `denied`; expired J4 blocks; missing J5 blocks; no personal data appears in repository records |
| D2 | Price check fails if either interpretation fails; caps use the larger exposure; pending multiplier blocks; active multiplier change invalidates the mapping revision and bound approvals; exact arithmetic at 18 + 18 decimals with no float conversion |
| D3 | Each of P1–P9 produces its reason code and blocks; pre-open round blocks in-session; boundary values at 1,350 s and 50 bps; band formula at 0 h, 1 h, 10 h and above 10 h; gas excluded from the band but enforced by its cap |
| D4 | Allowance not equal to input blocks at prepare; nonzero post-fill allowance freezes; approval effects present in the bootstrap snapshot |
| D5 | `resyncFromChain` still rejects a reorged applied fill; R1 re-anchors with identical effects and no balance change; R1 with differing effects is rejected; single-source non-canonical evidence is rejected; transition replay is a no-op; competing transition is rejected |

## 5. Owner and reviewer actions before live activation

1. Record the prospectus clause for D2, or accept the dual-interpretation check for the pilot.
2. Confirm the Binance channel URL used for J2.
3. Record the J5 local-law decision privately.
4. Set the D3.3 gas cap from current BSC gas prices.
5. Engineering references have been reconciled. Use profile/manual records v2 and migration 0010; see the [owner runbook](runbooks/owner-pilot.md).

## 6. References

- NVDAB prospectus, ADGM FSRA approved register (retrieved copy: see owner pilot sources)
- [Binance bStocks FAQ](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
- [BEP-677: EIP-8056 Scaled UI Amount](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md)
- [Chainlink data-feed selection guidance](https://docs.chain.link/data-feeds/selecting-data-feeds)
- Nigeria Investments and Securities Act 2025; SEC directive of 8 April 2021 on foreign listed securities; SEC Proposed Rules on Cross-Border Securities Trading and Custody (draft, 2 July 2026)
