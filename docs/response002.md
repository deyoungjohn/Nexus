Your team handled the hard parts correctly. Every place where you held the line (absence from a list isn't permission, no inferred ratio, no allowance faked through the swap path, no overwriting a counted fill) was the right call. Here are my answers.

## 1. Jurisdiction evidence

**My recommendation:** you don't need affirmative issuer confirmation. You do need a local-law check, which is a separate question from the issuer's list.

**Issuer side.** The prospectus defines how restrictions work: a restricted list that may be amended and communicated through Binance. A secondary buyer meets that by checking the list and its amendment channel at trade time. Asking the issuer for a personal sign-off goes beyond what the prospectus asks of buyers. So I'd sharpen my earlier "clearly permitted" hard stop into this evidence set, re-fetched and hashed for each trade:

- the current NVDAB prospectus plus any supplements, taken from the ADGM FSRA register (not your June 11 copy alone);
- Binance's current published bStocks restriction notice, fetched from the bStocks FAQ (section 16) or wherever Binance publishes amendments;
- the owner's expiring signed statements: not a US person, not resident in or acting from a restricted jurisdiction, not a restricted person, and acknowledging the section 3.4.1 transfer restrictions.

If either source fails to load, the result is unknown and the trade is blocked. Absence from a list you could not fetch proves nothing.

**Nigerian side.** The issuer's list only covers what BTech restricts, not what Nigerian law allows.
- Nigeria's Investments and Securities Act 2025 now classifies virtual and digital assets as securities.
- The SEC's 2021 directive was aimed at fintech companies offering foreign listed securities to the Nigerian public.
- The SEC's July 2026 draft cross-border rules apply to brokers giving Nigerian investors access to foreign securities.

That regime mostly targets intermediaries, not an individual buying for themselves. Two consequences follow:
- For the owner's own pilot trade, the owner makes the call, ideally after a short consultation with Nigerian counsel. Record it as the owner's decision.
- For Nexus serving anyone else, Nexus becomes the intermediary these rules address. Get counsel before offering it to anyone.

I'm not a lawyer, so treat this as an evidence standard to adopt, not a legal opinion.

## 2. Raw units to share exposure

**On the display side, your formula matches the standard.** BEP-677 multipliers use 18 decimals, and the display amount is raw × uiMultiplier / 1e18. With 18 token decimals, display units = raw / 10¹⁸ × multiplier / 10¹⁸. bStocks use the multiplier to reflect splits, reverse splits and dividend reinvestment.

**What I can't give you is the provision.** I haven't seen the prospectus text, and the standard defines display only, not legal entitlement. The question is whether sections 3.1–3.2 define one certificate as one display unit. Given that dividends are reinvested through the multiplier, that is the only reading under which "1:1 with shares" stays true over time. Find the sentence that connects the certificate count to the token's displayed or multiplier-adjusted balance, and cite it in the mapping record.

**Until you find it, a conservative fallback:** run the price check under both interpretations (raw / 10¹⁸ and raw × multiplier / 10³⁶) and require both to pass the band.
- If the multiplier is close to 1, this costs almost nothing.
- If it isn't, the check will tell you empirically which reading the market prices. The correct one shows a near-zero premium against the reference.

**On rounding,** I read eight-place rounding as applying to issuance and redemption amounts, the primary market. Secondary transfers are integer raw units with no rounding. For valuation, compute exactly and round conservatively only at decision thresholds. Your pilot is secondary-only, so this needs confirming only before redemption enters scope.

## 3. Price parameters

**Yes, require a round from the current regular session for the pilot.** You're right that an old round doesn't prove the price is unchanged. The 0.5% trigger only implies "moved less than 0.5%" if the feed is live, and a quiet market looks the same as a stalled feed. For a 5 USDT pilot, blocking is cheap, so take the strict rule. Relax it later only with a liveness test, such as several sibling equity feeds on the same feed network updating during the session.

**Accept the band, with one check.** 100–200 bps covers the feed's own 0.5% tolerance plus the 0.25% pool fee, leaving room for a modest bStock premium. A narrow band only causes blocks, which are safe.

The check concerns gas. Keep gas out of the price band. Your route prices the full gas ceiling, and at your smoke settings (300,000 gas × 5 gwei = 0.0015 BNB) that is likely a dollar or more, a large share of a 5 USDT trade. If gas counts against the band, every trade will be blocked. Give gas its own absolute cap, set from current BSC gas prices rather than the smoke's 5 gwei.

**Outage rule.** Block the trade if any of these holds:
1. The price is ≤ 0, or round data is incomplete (`answeredInRound < roundId`).
2. The round ID or `updatedAt` goes backwards, or `updatedAt` is later than the block time.
3. There is no NVDA round since today's regular-session open.
4. The USDT round is older than 900 s × 1.5.
5. The USDT/USD price deviates more than 50 bps from 1.
6. The recorded DEX-mid deviation exceeds the band.

Log every block reason. They become your cadence data.

## 4. External allowance setup

**Acceptable for the pilot. Don't build an approval-leg type before the first fill.** Your boundary is sound: decoded fields, a unique Approval event, finality, and a pre-bootstrap snapshot that absorbs its nonce and gas. The exposure is at most 5 USDT approved to the canonical router for a short window.

Add one check to post-fill reconciliation: **the allowance must be exactly zero after the swap.** Exact-input swaps should consume all of it. A nonzero remainder means the swap didn't do what was approved, so freeze. Build the persisted approval leg when trades start repeating, because that is when approvals stop being one-off setup.

## 5. Disputed historical fill

**Keep it frozen. My earlier "freeze and resync" was too loose for a fill you've already applied.** Overwriting balances while the fill stays counted would hide an obligation, as you say.

A safe transition is a **compensating entry, never an overwrite**. Diagnose first, which needs:
1. Proof that the original receipt's block hash is no longer canonical, at a finalized head, from at least two independent RPCs.
2. Your nonce diagnosis for the leg's (from, nonce), with one of three outcomes:
   - **Same hash included in a different block.** Re-anchor the fill to the new block after verifying the effects are identical. There is no accounting change, and this is the most likely outcome.
   - **Nonce consumed by a different transaction.** Reverse the original fill, then classify the canonical transaction. If it's a Nexus leg, apply it through the normal path. If not, record it as an external boundary.
   - **Nonce not consumed.** The transaction may still be pending, so nothing can be released. Either wait, or have the owner sign a zero-value self-transfer at that nonce. That transaction's receipt becomes the decisive evidence.
3. After applying the correction, the ledger must equal the chain at the finalized block, or it stays frozen.
4. The owner signs the transition record, which links all of the evidence above.

BSC's fast finality makes an actual reorg past finality a chain-level incident, not a routine event. For the pilot, freezing and treating it as an incident is the right posture. The re-anchoring outcome is the only narrow transition I'd consider implementing early, because it involves no change to balances.