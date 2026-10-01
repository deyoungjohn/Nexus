# USDT/NVDAB raw recovery review — 2026-09-30

P7.3/P7.5; [ADR 0025](../decisions/0025-reviewed-bsc-raw-transfer-recovery.md).
[Structured evidence](2026-09-30-token-recovery-semantics.json) contains source
digests, observed runtime hashes, public pool accounting checks and live
application guard outcomes. This is a recovery-accounting review, not a
security audit, issuer eligibility decision or live-trade permission.

## Source and deployed identity

Review block: **124962383**, chain 56. Sentio and Blockmachine both returned
runtime bytecode matching the verification records for the token, proxy and
implementation.

| Asset/path | Source review | Recovery conclusion |
| --- | --- | --- |
| USDT `0x55d398326f99059ff775485246999027b3197955` | [Sourcify BEP20USDT](https://sourcify.dev/server/v2/contract/56/0x55d398326f99059ff775485246999027b3197955?fields=all), Solidity 0.5.16 | Stored 18-decimal raw balances; exact subtraction/addition and standard raw Transfer events. No fee or rebase path found in the reviewed implementation. Owner mint and holder burn also emit raw Transfer events. |
| NVDAB `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` | [Exact-match BeaconProxy](https://sourcify.dev/server/v2/contract/56/0x02fca66c1d1afb4e2a7884261eb00f63598a7436?fields=all) | Runtime contains immutable beacon `0x156d6dce9a4f6139a3406f1f021f1a4880de93a3`; checking a storage slot alone is insufficient. |
| NVDAB implementation `0xcfed6c4679297ea4889f8183bc057b4a86c64e46` | [Exact-match SecuritiesToken](https://sourcify.dev/server/v2/contract/56/0xcfed6c4679297ea4889f8183bc057b4a86c64e46?fields=all), Solidity 0.8.24 | Inherited OpenZeppelin raw balances/Transfer updates; display scaling emits an additional event. Static compliance/pause checks can reject transfers; issuer/admin mint/burn and beacon upgrades remain privileges. |

USDT's verification label is **match**, not exact match: the recorded
transformation replaces CBOR auxiliary metadata at byte offset 4361. Comparing
the executable prefix with the recompilation succeeded. Recovery pins the
entire actual on-chain runtime hash, including metadata. NVDAB's proxy match
accounts for the constructor-set immutable beacon; its implementation has no
runtime transformations. Source SHA-256 digests are retained in the JSON record.

The [BEP-677 draft](https://github.com/bnb-chain/BEPs/blob/master/BEPs/BEP-677.md)
describes display scaling separately from raw balances. The deployed source
confirms the actual update chain: static restriction checks, ordinary raw
balance mutation/Transfer, then the additional display event. Its scheduled
multiplier changes affect display conversion, not the raw balance mapping.
Recovery sums standard `Transfer` only, ignoring `TransferWithUIAmount` and
multiplier notices. A zero UI overflow sentinel also does not change raw funds.

## Empirical receipt and balance evidence

The verified direct NVDAB/USDT pool is
`0x8fb4243b553ac29ba088acf00b9b7da24bd6690c`. Read-only discovery found 2,547
pool logs in a bounded recent range, including 2,540 seven-field Pancake V3
swap events. Selected one public buy and one public sell, sufficiently behind
the head:

| Direction | Block | Transaction | NVDAB raw/UI event pairs |
| --- | --- | --- | --- |
| Buy | 124963262 | `0xc7d6909ba8020a6f3336e3ab8b0c6869b471acaf4e21a1a19604daf92bbbd072` | 2 |
| Sell | 124963239 | `0xc566dd7a5cd80b636357aea85af81fb1da67f02cab9f1dbaa2fd90da61f8120e` | 1 |

Both sources verified successful canonical receipts and paired each stock raw
Transfer with its corresponding raw/UI event. For each sampled block and each
token, the public pool's raw balance change from the prior block matched the
net of **all** its standard Transfer events in that block. This checks block
accounting and does not attribute other transactions' movements to the selected
receipt. The new application contract guard passed all four source/block
combinations using its normal five-second request timeout. No user wallet,
signature, state override or broadcast was used.

## Registry/runtime outcome and limits

`config/bsc-recovery.json` now contains native BNB, USDT and NVDAB, with
registry revision `bsc-raw-transfer-review-2026-09-30`. ERC20 entries retain
their review IDs and runtime/beacon pins. The runtime validates only the exact
tracked asset set and output, twice at the finalized receipt block, before
once-only PostgreSQL settlement. Missing historical code/metadata leaves the
candidate unavailable; an identity change requires a new review. Existing
receipt-local input/output/gas and unrelated-asset checks remain mandatory.

The beacon's source was not retrieved: Sourcify returned 404, the explorer
returned 403, and attempted content-addressed metadata gateways did not yield
the source. Its bytecode hash and proxy-caller implementation getter are
bound, without a complete upgrade-authorization audit. End-of-block pinning
also does not reconstruct all intra-block implementation histories. The
reviewed contracts can retain privileged changes and external restrictions.
This accounting registration does not clear P5.5 risk, issuer eligibility,
reference/economic mapping, prices/events, session policy or broadcaster gates.

Probe corrections are logged: an initial Uniswap-style five-field Swap topic
missed Pancake's seven-field events; bounded unfiltered pool discovery corrected
it. Sentio rejected a 99,968-block request because its log range cap is 10,000;
the corrected discovery stayed below that cap. These research log queries are
not added as a production receipt-recovery dependency.
