# Chainlist BSC historical recovery RPC results

Date: 2026-09-30. Agent/client: Codex. Work items: P7.3/P7.5, production
chain-evidence prerequisite. [Structured evidence](2026-09-30-chainlist-recovery-rpc.json).

**Found:** use `https://bsc.rpc.sentio.xyz` as the preferred candidate for the
next P7 historical-read qualification, with `https://rpc-bsc.blockmachine.io`
as a backup candidate. Both served historical balances, full blocks, receipts
and logs and passed Nexus's existing read-only readers without an API key.
They also returned matching nonzero balances for the previously problematic
Ondo block and the historical bStocks route block. No application default,
automatic failover, production worker or broadcaster was changed.

This supersedes the earlier conclusion that a suitable anonymous historical
source had not yet been found, while preserving the
[original dataseed/PublicNode observations](2026-09-30-free-source-readiness.md).
Public historical capability is now demonstrated at the sampled blocks;
complete P7 production readiness is not established by this survey.

## Discovery and verification

The requested [Chainlist BSC page](https://chainlist.org/chain/56) returned via
direct HTTPS. The web browsing tool timed out on its rendered page, so the
probe used Chainlist's [published RPC feed](https://chainlist.org/rpcs.json),
documented in its [official repository](https://github.com/DefiLlama/chainlist#api).
The 16:48 UTC snapshot contained **58 entries** for chain 56. We screened
**45 distinct HTTPS endpoints**, excluding 13 WebSocket or credential-shaped/
query URLs. No account, public demo key, paid service or intended test wallet
was used. Exclusions and every screened endpoint are recorded in the JSON.

The initial screen required chain 56, historical `eth_getBalance` and an actual
ERC20 `balanceOf` at block **124743263** (2026-09-29 15:48:04 UTC), rather than
just an old header or `decimals()` lookup. Five endpoints passed. Deeper
verification covered these fixed canonical blocks:

| Block | Source timestamp UTC | Native BNB at WBNB contract* | USDT at public V3 pool* |
| --- | --- | ---: | ---: |
| 124938263 | 2026-09-30 16:11:10 | 1,565,839.99 | 7,739,801.15 |
| 124743263 | 2026-09-29 15:48:04 | 1,569,150.82 | 7,149,133.16 |
| 40000000 | 2024-06-28 07:09:39 | 1,442,403.74 | 39,933,475.39 |

*Rounded public contract balances, not user holdings. WBNB contract:
`0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`; USDT:
`0x55d398326f99059ff775485246999027b3197955`; factory-discovered USDT/WBNB
PancakeSwap V3 pool, fee 500:
`0x36696169c63e42cd08ce11f5deebbcebae652050`.

The differing nonzero values across historical dates help distinguish actual
historical state from latest-only or constant-zero responses. Native balances,
USDT/WBNB balances and historical nonce values matched across Sentio,
Blockmachine, thirdweb and Blast at all three dates. Matching gateways are
corroboration, not proof of independent upstream operators.

At the September 29 and June 2024 blocks, additional reads checked full
transactions, canonical transaction receipts, gas fields, receipt logs and
one-block USDT Transfer queries. The existing compiled readers were invoked
against the live endpoints with their normal five-second request limits:

- `fetchBscTrackedBalances`: exact-block BNB and ERC20 balances with canonical
  hash checks; included NVDAon/NVDAB contract reads at the recent block.
- `fetchBscReceiptEffectProof`: receipt identity, complete ordered log fields,
  gas and canonical block checks.
- `fetchEoaBscObservation`: chain/head/nonce, sender-bound receipt and block
  validation for a sampled public transaction. The public sender was used
  transiently and is not stored in this report/evidence or project memory.

These are reader compatibility checks. No Nexus leg/approval or portfolio
reconciliation was created, and no claim is made that a sampled unrelated
transaction proves an authorized Nexus trade's exact effects.

## Candidate matrix

| Endpoint | Historical state to June 2024 | Existing P7 readers, both receipt dates | Additional `eth_getLogs` | Result |
| --- | --- | --- | --- | --- |
| `https://bsc.rpc.sentio.xyz` | Pass | Pass | Pass | Preferred candidate |
| `https://rpc-bsc.blockmachine.io` | Pass | Pass | Pass | Backup candidate |
| `https://56.rpc.thirdweb.com` | Pass | Pass | Pass | Additional tested candidate; review access policy |
| `https://bsc-mainnet.public.blastapi.io` | Pass | Pass | Rate-limited | Core-reader candidate with query-limit caveat |
| `https://rpc.swiftnodes.io/rpc/bsc` | June 2024 reads failed `header not found` | Some checks returned no result | Recent pass, old failure | Not selected |

Sentio/Blockmachine/thirdweb returned matching normalized receipt-log and
filtered-log digests, with 101 USDT Transfer logs at the recent sample and
57 at the 2024 sample. Sample receipts contained six/eight total logs.
**`eth_getLogs` is an additional capability screen**: current P7 effect reads
use `eth_getTransactionReceipt().logs`, so Blast's query throttling does not
invalidate its successful core-reader checks. Do not infer that every
endpoint must expose unlimited standalone log queries for current P7 recovery.

Other screened results included dataseed/Defibit/Ninicoin historical state
failures, PublicNode's archive-token requirement, Fastnode pruned state, ZAN
registration limits, Tatum's contract-call plan restriction and network/HTTP/
method failures. OnFinality was rate-limited; that does not establish that
its archive infrastructure lacks the capability. Failures are dated samples,
not universal provider judgments.

The first deeper probe aborted when Blast rate-limited its reference log query.
Discovery was moved to Sentio and the method matrix rerun with paced calls.
No application bug or check failure resulted from that research-probe failure.

## Replaying Nexus's previous stock-source failures

Sentio and Blockmachine both passed `fetchBscTrackedBalances` for these public
pools, with identical raw values and canonical hashes:

| Case | Block | Stock balance | USDT balance |
| --- | ---: | ---: | ---: |
| Ondo NVDAon pool, earlier dataseed replay failure | 124939148 | 10.825947686385119358 NVDAon | 12,786.498366507565677853 |
| NVDAB pool from the bStocks route report | 124347223 | 9,688.231412552515173683 NVDAB | 1,492,881.842849431009167401 |

Ondo pool: `0xb90bdbfbdffd4af5a636b5805539edeafb969308`; NVDAon:
`0xa9ee28c80f960b889dfbd1902055218cba016f75`. bStocks pool:
`0x8fb4243b553ac29ba088acf00b9b7da24bd6690c`; NVDAB:
`0x02fca66c1d1afb4e2a7884261eb00f63598a7436`. These are raw token amounts
scaled by 18 decimals, not reference-share quantities or an investment ranking.

Repeat a historical native read without a wallet or key:

```bash
curl -sS https://bsc.rpc.sentio.xyz \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c","0x2625a00"]}'
```

## Scope and next use

The practical missing-history obstacle is resolved for these sampled public
readers through alternate sources. Next, connect a reviewed source to the
trusted recovery worker's `rpcUrl` interface and verify the intended tracked
wallet/registry and PostgreSQL recovery path before any live leg. This task
did not install that wiring or establish full nonce history, operator repair,
crash/reorg completion, current P5 evidence or broadcast authorization.

No key was required in these public probes. This is not a guarantee of future
free availability, throughput or retention. Sentio's
[managed-node documentation](https://docs.sentio.xyz/docs/rpc-nodes) describes
a separate billed product and does not specify the anonymous BSC endpoint's
limits. thirdweb's [infrastructure access documentation](https://portal.thirdweb.com/account/api-keys)
also requires review before production adoption. No managed service was
provisioned. Preserve source identity and canonical hashes and fail closed on
unavailable or contradictory evidence under ADRs 0019/0020; latest balances
must not substitute for the finalized receipt block.

Baseline full check: 139 tests passed, zero failures/skips, strict typecheck,
headless/production web builds and config checks. The post-documentation
PostgreSQL-backed full check also passed 139 tests with zero failures/skips,
strict typecheck and both builds. Evidence/count/consistency/nonzero-stock-replay
assertions and `git diff --check` passed. Durable findings were added to shared
memory. Application code and interfaces are unchanged.
