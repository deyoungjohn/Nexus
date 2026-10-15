# Free-source readiness and bStocks access clarification

Date: 2026-09-30. Agent/client: Codex. Work items: P5.5a/P5.5c/P5.5d, P7.3.

The owner selected `https://bsc-dataseed.bnbchain.org/`, requested free stock
market sources, and deferred supplying the intended test wallet until needed.
This records preferences and read-only findings; it does not register a live
instrument, change trading policy or authorize a transaction.

## Public RPC probe

At 14:23:28 UTC, the supplied endpoint returned chain 56 and BSC block
124923910 (block timestamp 14:23:28 UTC). A historical full-transaction block
read succeeded. Native-balance and USDT `decimals()` calls at latest minus
128 blocks failed with `missing trie node`. A single-block USDT log query
returned `limit exceeded`. BNB Chain's official
[RPC documentation](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/)
says `eth_getLogs` is disabled on its listed mainnet endpoints.

At 14:25:46 UTC, the free [PublicNode](https://www.publicnode.com/) BSC endpoint
returned chain 56 and allowed a historical block and single-block log query.
Native-balance and contract reads at depths 128, 5,000 and 200,000 blocks,
plus a sampled historical transaction receipt, required a personal archive
access token. No token or account was supplied. This does not establish its
access price or whether an account/free allowance can satisfy Nexus's needs.

The supplied endpoint is a current-read candidate, not a verified P7 recovery
source. The current recovery builder requires balances at the exact finalized
receipt block after restart. Current/latest-only balances cannot replace that
proof. A suitable free-tier historical source must still be found and tested;
no subscription is required or purchased by this record. These samples are
capability checks, not a production availability guarantee.

Machine-readable evidence: [public probe results](2026-09-30-free-source-readiness.json).
No user wallet or sampled transaction identity is stored.

Later 2026-09-30 follow-up: the [Chainlist recovery RPC survey](2026-09-30-chainlist-recovery-rpc.md)
found Sentio and Blockmachine anonymous endpoints with historical native and
ERC20 balances, receipts/logs and existing-reader compatibility at sampled
blocks back to June 2024. Both also served the historical stock-pool blocks.
The search for a suitable candidate is now resolved; the dataseed/PublicNode
failures above remain valid historical observations. Production recovery
source/registry wiring and full P7 qualification remain open.

## Free price candidates

At the same pinned BSC block, the existing adapters' Chainlink proxies returned
correct descriptions, eight decimals and complete rounds:

| Asset | Source update (UTC) | Age at response | Price, indicative USD |
|---|---|---|---|
| NVDA | 14:07:31 | 959 seconds | 230.955 |
| AAPL | 14:03:45 | 1,186 seconds | 338.195 |
| USDT | 14:23:24 | 7 seconds | 0.9995 |

These public on-chain reads need no stock subscription. Equity readings are
older than the current 60-second reference limit. They do not clear that gate,
and the HTTP receipt time must not replace the source update time. Settlement
age alone does not clear quantity, uncertainty, peg or the full gate.

Use free public sources first and review their update cadence, coverage,
permitted use and actual risk bounds. A wider freshness policy is a separate
reviewed decision, not an automatic adjustment to make a free feed pass.
Delayed/last-close prices can inform display but cannot be represented as a
fresh execution reference. Official issuer notices and maintained exchange
calendars remain public-source candidates requiring runtime integration.

## What a terms modal can establish

The [bStocks FAQ, third-party integration section](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
expects integrators to enforce geographic restrictions and use its public
country-eligibility API. It invites contact with bStocks for integration
options, without publishing the endpoint/schema or establishing in that
section a universal requirement for bespoke authorization or KYC for every
EOA DEX user. Applicable product documents must still be reviewed.

A modal can record agreement to versioned terms and a declaration about
residence/restricted-person status. It does not independently verify those
facts or generate the official country/product/transfer decisions required by
ADR 0018. The adequacy of any lighter declaration/location-based verification
process remains a reviewed policy question; no automatic paid identity service
or universal Binance-account requirement is introduced here.

Suggested UX: allow general information and synthetic planning independently
of live bStocks eligibility. For bStocks trading, combine wallet control,
versioned declarations, server country/product decisions, supporting location
checks and exact on-chain transfer preflight. Reuse evidence within reviewed
expiry/change rules and handle conflicts explicitly. A checkbox alone must
not mark the current composer allowed. The user asked about this flow; it has
not been implemented or approved as a replacement evidence policy.

Contacting bStocks is a practical route to missing documentation and required
verification guidance. This source review cannot establish that direct contact
is universally compulsory, nor that unknown requirements can be waived.
