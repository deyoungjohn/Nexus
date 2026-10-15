# Nexus: senior engineer response to the handoff

Prepared: 2026-10-02. Responds to `SENIOR_ENGINEER_HANDOFF.md` (application revision `5c7d541`).

Scope note: this response is based on the handoff document only. The repository was not inspected, so recommendations are architectural and must be checked against the code. Nothing here approves a trade or changes live policy.

---

## 1. Diagnosis: why the project is stuck

The blocker is not engineering. The admission policy is a chain of gates that must all pass, and several of them cannot pass for this asset no matter what is built:

| Gate | Requirement | Observed reality | Satisfiable? |
| --- | --- | --- | --- |
| U03 price freshness | Reference ≤ 60 s old | Free equity feed observed 16 min to 2+ h old | No, with free sources |
| U05 scanner coverage | Complete coverage from both providers | Binance scanner: NVDAB unsupported (0/7) | No, external |
| U06 independent review | Current full-scope audit, 24 h validity | No NVDAB report exists; registry empty | No, without commissioning |
| U07 risk findings | No caution or risk findings at all | Regulated tokenized securities must have pause, freeze, compliance and upgrade controls | No, for any issuer-managed security token |
| U09 approval window | Capped by earliest source expiry | Binance status record lasts 30 s | Probably not, for a human signing flow |

Each rule makes sense in isolation. Together they guarantee zero trades. Building more ports, ADRs or collectors will not change that outcome.

**Remedy:** a versioned **Pilot Admission Profile**. This is an explicit, bounded policy for a supervised trade with a small exposure cap. It is labelled as deferring review wherever it does, and it never records deferred review as completed.

---

## 2. The one external blocker that is real

U01 (eligibility) is the only item where no engineering substitutes for an external answer.

According to Binance's June 12, 2026 launch announcement, bStocks:

- are certificates over select U.S. stocks and ETFs, issued by BTech Holdings Limited, a Binance group affiliate;
- are offered under a prospectus approved by the ADGM Financial Services Regulatory Authority, with no public offer in any other jurisdiction;
- are available on a secondary-market basis only, to eligible users in permitted jurisdictions.

Source: [Binance bStocks launch announcement, PR Newswire](https://www.prnewswire.com/news-releases/binance-exchange-launches-bstocks-tokenized-securities-11-backing-and-247-trading-302798876.html)

**Concrete lead not in the handoff: obtain the ADGM-approved prospectus.** It should contain both:

- the selling and jurisdiction restrictions (U01), and
- the certificate's economic terms, i.e. the mapping from raw tokens to share exposure, corporate actions, deductions and rounding (U02).

Get that document before emailing anyone.

**Hard stop:** if the owner's jurisdiction, including Nigeria, is not clearly permitted, do not make the mainnet trade. Consider a different instrument instead. A trade from a non-permitted jurisdiction is the one outcome no amount of engineering rigor can repair.

Keep two questions separate:

1. The owner trading for themselves (pilot scope).
2. Nexus offering the service to other users. This needs legal counsel for the target jurisdictions.

---

## 3. Answers to the handoff's questions

### Q1. Which admission rules are justified for the MVP?

**Keep** the rules that protect funds and records:

- exact identity binding (chain, token, pool, router, calldata);
- persist before broadcast;
- never resend on timeout;
- reconcile each receipt exactly once;
- hard eligibility.

**Change** the rules that demand evidence the market cannot supply: scanner completeness, the no-findings policy, 24-hour audit renewal and 60-second freshness. Sections Q2, Q4 and Q5 give the replacements.

**Scale rigor to the money at risk.** On a 5 USDT trade, a 2% pricing error costs 0.10 USDT, so price-fairness evidence can be lighter for the pilot. The material pilot risk is issuer freeze or loss of the whole position, and the exposure cap handles that.

### Q2. Can free references support a defensible strategy?

Yes, if the policy stops treating the age of the last update as the risk. Chainlink-style feeds publish a new round only when the price moves past a deviation threshold or a heartbeat timer expires. An old round often means the price simply has not moved.

Proposed policy:

1. **Regular session:** accept a reference no older than the feed's published heartbeat. Check the actual value on data.chain.link rather than assuming one.
2. **Execution price:** execute against the DEX quote, but only within a band around the reference. Widen the band as the reference ages, e.g. `band = base + k · σ · √age`.
3. **Outside the session:** block, or allow only with a wider band and the reference explicitly labelled as a last close carrying its true source time.
4. **Post-quote protection:** keep the signed `amountOutMinimum` as protection against price moves after the quote.

Monitoring to add: per-session cadence of rounds, deviation between reference and DEX mid, outage detection, and source-time regression tests. Also check the feed's terms of use before redistributing its prices.

### Q3. What verification process does the bStocks secondary flow require?

For an owner-only pilot:

1. Confirm the owner's jurisdiction against the prospectus selling restrictions.
2. Record a signed self-declaration of residence and location, linked to that confirmation and carrying an expiry date.
3. Keep identity documents and personal records out of Git and shared memory.

Questions only the issuer can answer:

- the country-eligibility API's endpoint, schema and terms for third-party integrators;
- whether a third-party EOA flow is permitted, and what verification it expects.

### Q4. How can reviewed facts substitute for missing scanner fields?

- Give every check three possible states, **pass, fail or unknown**, each with a recorded evidence source.
- Each evidence type declares which checks it is able to establish. An `unknown` becomes `pass` only through evidence of a declared type, **never because data is missing**.
- Positive findings stay recorded even when coverage is resolved by other evidence.

**A cheap, strong substitute:** simulate a buy-then-sell round trip at the snapshot block from the real wallet. This tests the honeypot and transfer-tax checks directly, which is stronger evidence than GoPlus's unknown fields.

### Q5. Which issuer powers can the pilot tolerate, and what revokes admission?

**Tolerated as known issuer-trust capabilities**, under a hard exposure cap sized so that losing the whole position is acceptable:

- beacon implementation upgrades;
- pause and freeze;
- compliance lists;
- operator mint/burn.

**Revoke admission immediately if any of these happens:**

- any change to the code or control fingerprint (implementation, beacon target, admin or owner addresses, role membership);
- the token is paused;
- the owner's wallet, the pool or the router is blacklisted;
- a display-multiplier change is pending;
- a relevant issuer or provider notice appears.

**Never acceptable:**

- a nonzero transfer tax;
- a failed sell simulation.

**Audit validity.** The review should last as long as the code is unchanged; the observation of the code is what should expire.

- A review stays valid while the fingerprint is unchanged.
- Re-fingerprint when preparing the trade and again just before submission.

This turns the 24-hour audit renewal problem into a cheap check the existing collector can already perform. The pilot still records that independent review is **deferred**, not completed.

### Q6. What is the practical EOA signing workflow?

**Pilot (no code change):**

- The owner signs offline with Foundry's `cast mktx`, using a Ledger or a local keystore, and pastes the raw transaction into the existing import fallback.
- Do the token approval the same way, approving the **exact trade amount** rather than unlimited. Handle it as its own reviewed leg with its own receipt.

**Later, for broad wallet compatibility:** treat **(from, nonce) as the transaction's identity instead of the hash**:

1. Persist the full unsigned transaction and its nonce.
2. Call `eth_sendTransaction`.
3. During recovery, find whatever transaction actually used that nonce and decode it against the approved fields. If it doesn't match (for example, the user edited gas or nonce in the wallet), freeze.

This keeps crash safety without needing raw bytes. Review it as a deliberate revision of ADR 0019/0030 before adopting.

**Approval clock fix (`executionMarketExpiry`):**

- Cap the approval at min(quote deadline, 5 minutes).
- Let short-lived sources such as the 30-second status record trigger a **recheck just before submission** instead of capping the signing window.
- Only a real change in price or control facts invalidates the signature and requires a new review.

### Q7. What completes initialization, nonce history and repair with the least complexity?

**Bootstrap:**

1. Declare the tracked assets in policy: BNB, USDT, NVDAB.
2. Read their balances and the wallet's nonce at a finalized block, recording the block number and hash.
3. The owner activates the result as a signed act.
4. That snapshot becomes the chain-backed starting revision.

That bootstrap block is the **trusted start** that U10 says is missing. From then on, every nonce increment must be explained by a Nexus leg or explicitly recorded as external activity. Treat unexplained balance changes the same way: create a new revision that requires owner acknowledgement.

**Nonce diagnosis without block scanning:**

- Binary-search `eth_getTransactionCount(addr, block)` on the archive RPCs to find the block where the nonce passed `n`.
- Check that one block for the transaction from the EOA.
- This takes about log₂(range) calls and removes the 32-block scan limit. It depends on the archive endpoints being reliable (U10 qualification).

**Repair, pilot level:**

- Implement one idempotent `resyncFromChain(reason, evidence)`. It creates a new revision from a finalized block, records the operator's diagnosis, invalidates dependent plans and preserves history.
- Write a runbook for it.
- A deep reorg is very unlikely on a small pilot, so freezing and resyncing manually is an acceptable procedure for now. A general repair command (U11) is a post-pilot item.

### Q8. Can one NVDAB trade serve as the pilot?

Yes. Run one clearly labelled NVDAB/USDT trade as a pilot and keep the basket roadmap separate. Don't qualify a second provider first. That would multiply every open problem by two before any of them is closed.

---

## 4. Critical path

| Step | Work | Depends on |
| --- | --- | --- |
| 1 | Obtain the ADGM prospectus and confirm the owner's jurisdiction is permitted. Start immediately, in parallel with everything else. | None |
| 2 | Write the Pilot Admission Profile ADR: the policy changes above, the exposure cap and an explicit list of deferred items. | None |
| 3 | Implement the null production ports as reviewed manual records: economic mapping (citing the prospectus section), events and access. Then build the bootstrap. | 1, 2 |
| 4 | Sign with `cast mktx`: exact approval, then the trade. Submit once, reconcile once, restart the worker, and confirm no duplicate fill. | 3 |

**Deferred until after a real fill:** the scheduler and post-fill allocation (U12), the basket and additional providers (U13), a general repair command (U11) and general-release operations (U14).

---

## 5. Pilot acceptance evidence

- Profile revision and list of deferred items.
- Jurisdiction confirmation record (non-secret summary only in the repository).
- Economic mapping record citing the prospectus.
- Reference observation with its true source time, plus the band calculation.
- Event and issuer-notice records.
- Fingerprint at prepare and at pre-submit, plus the round-trip sell simulation result.
- Decoded quote and real-state simulation.
- Signed-leg identity (from, nonce, hash).
- Canonical receipt and effect proof.
- Reconciled revision.
- Worker restart showing no duplicate fill.

---

## 6. Next steps available

With the relevant files (`src/execution/market-revalidation.ts`, `src/execution/production.ts`, `src/execution/bsc-recovery.ts`), concrete changes can be drafted for:

- the approval-clock fix;
- nonce binary-search diagnosis;
- the bootstrap service;
- the Pilot Admission Profile ADR.
