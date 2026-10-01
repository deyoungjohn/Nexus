# Source, governance, scanner coverage and independent-review integration

Date: 2026-10-01. Work items: P5.5d/P7.1. Decision:
[ADR 0028](../decisions/0028-source-governance-and-independent-review-intake.md).
Machine evidence: [public observations](2026-10-01-security-collector.json).

The production read-only collector now resolves all nine NVDAB execution components
and their sources, including the recovered beacon and OperatorWallet/BurnWallet
proxy implementations. USDT has one execution component. Current governance reads
cover eleven distinct NVDAB authorities, both inner implementation/admin/owner
states, pending owners, initialization, operator and hot-wallet/pause controls.
The [source/governance research](2026-10-01-bstocks-governance.md) explains the
rebuild correspondence and observed upgrade powers. These facts do not constitute
an independent audit or an accepted-risk decision.

Sentio collection at block 125113819 and Blast at 125113823 produced identical
source/control/governance fingerprints, with complete source closure on both.
These are nearby, different-block collections, not a same-block comparison.
Each collection independently uses canonical hash reads and a final header check.
Both correctly exited 2 for blocked readiness. No signing, broadcast, personal
wallet inspection, live asset enablement or recovery-source configuration change.

## Scanner coverage

The public API refresh records explicit required-field coverage alongside findings.
Receipt timestamps bound evidence reuse; neither provider supplied a fresh scan
timestamp tied to the execution block.

| Asset | Binance required coverage | GoPlus required coverage | Positive findings / gaps |
| --- | --- | --- | --- |
| BSC USDT | 5/7 | 21/22 | Binance risk level 3 (MID), mint caution; GoPlus mint warning. Binance trade/scam categories and GoPlus `cannot_sell_all` unknown. |
| NVDAB | 0/7, unsupported | 7/22 | Binance audit data is not available for this token on this chain. GoPlus shared-creator honeypot warning; fifteen fields unknown. |

NVDAB's missing GoPlus fields: `is_honeypot`, `owner_change_balance`,
`hidden_owner`, `can_take_back_ownership`, `selfdestruct`, `slippage_modifiable`,
`personal_slippage_modifiable`, `is_blacklisted`, `is_whitelisted`,
`transfer_pausable`, `trading_cooldown`, `is_anti_whale`, `anti_whale_modifiable`,
`is_mintable`, `external_call`. The shared-creator warning concerns another token;
it is not proof that NVDAB is a honeypot. Unknown fields are not safe/false values.
The Binance unsupported record retains only envelope/coverage flags, suppressing
its unreliable risk-level/items. Supported USDT buy and sell taxes are both zero;
Binance `extraInfo.isVerified` is null. Its complete returned item list follows.

| Binance USDT item | Type | Hit |
| --- | --- | --- |
| Whitelist Restrictions Not Found | CAUTION | false |
| Cooling-Off Restrictions Not Found | CAUTION | false |
| Blacklist Restrictions Not Found | CAUTION | false |
| Trading Suspension Function Not Found | CAUTION | false |
| Sale Restriction Not Found | CAUTION | false |
| Anti-Whale Mechanism Not Found | CAUTION | false |
| Contract Renounced | RISK | false |
| Self-Destruct Not Found | RISK | false |
| Mintable Detected | CAUTION | true |
| Balance Manipulation Not Detected | RISK | false |
| Malicious Creator Not Found | CAUTION | false |
| Hacking Risk Not Found | RISK | false |
| Upgrade Risk Not Found | CAUTION | false |
| Modifiable Tax Not Found | RISK | false |
| Freezable Authority Accounts Not Found | RISK | false |
| Contract Code Verified | CAUTION | false |

These are provider labels/results, not Nexus conclusions about renounced ownership
or contract verification. The attached JSON preserves the full supported response.

## Independent review

Recovered a primary [EtherAuthority USDT report](https://raw.githubusercontent.com/EtherAuthority/Audit/59d033e81b747496ab2ab0c2d4f9e07f31c68507/Binance-BSC-USD.pdf),
dated 2025-04-03, naming the exact BSC settlement contract. The auditor reports
zero critical/high/medium findings, three low and three informational findings,
and discusses owner mint centralization. Those are the auditor's findings, not
newly reproduced Nexus conclusions. The inspected scope does not publish a current
runtime/source checksum or establish today's entire controller fingerprint and
custody. It is therefore a historical candidate, not a qualified all-clear review.

The publisher catalog is limited to the verified primary
[EtherAuthority repository](https://github.com/EtherAuthority/Audit) and
[PeckShield report repository](https://github.com/peckshield/publications/tree/master/audit_reports);
URLs must pin a commit. Unverified additional publishers are not admitted.

The new artifact adapter fetched the immutable auditor publication and verified
SHA-256 `94cedb0cb27d4266ce9dd6414775ab79708ef75f6a205c65e050d2453932014f`.
That receipt establishes report bytes/provenance only. The PDF is linked rather
than copied into Git. The review registry remains empty.

[Binance's bStocks FAQ](https://www.binance.com/en/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
states independent smart-contract audits exist, but the inspected page provides
no matching public NVDAB/control-contract report or audit firm. The linked
`bstocks.finance` domain did not resolve from this environment. Public recovery
did not produce a qualified artifact; this is not evidence that none exists.
The user does not have an audit URL. We can build and test Nexus without it;
qualified independent review remains required for live admission under the
current policy. Terms acceptance cannot replace that review.

## Implemented boundary and remaining gates

- Exact immutable local source certificates fall back to verified Sourcify for
  other identities. Unknown code/layout or inconsistent governance reads block.
- Review v2 binds publisher, freshly verified report digest, full component scope,
  current fingerprint and five declared review areas. Legacy reviews cannot clear.
- Report adequacy and declared coverage remain qualified operator judgments;
  PDF verification does not automatically interpret or approve audit findings.
- Unsupported/missing scanner coverage and all positive risk findings still block.
  Neither public source matching nor independent report bytes override those gates.
- Production market/session/economic/access evidence, guarded execution wiring
  and remaining P5.5/P7 gates are unchanged. Historical recovery continues.

Automated verification covers source-certificate provenance, canonical layouts,
inner upgrades and changed controllers, unknown delegation, incomplete closure,
scanner coverage/positive findings, report namespace/digest/scope/expiry and bounded
retrieval. PostgreSQL execution/recovery suites are included in the final check;
the definitive result is recorded in the project and engineering logs.

⚠️ This audit result is for reference only and does not constitute investment advice. Always conduct your own research.
