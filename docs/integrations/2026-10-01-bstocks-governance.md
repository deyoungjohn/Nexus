# bStocks public source recovery and governance inspection

Date: 2026-10-01. Agent/client: Codex. Work items: P5.5d/P7.1.
Decision: [ADR 0027](../decisions/0027-local-source-recovery-governance-evidence.md).
Evidence: [canonical RPC snapshot](2026-10-01-bstocks-governance.json),
[compiler results](../research/bstocks-governance/source-rebuilds.json) and
[reproduction instructions](../research/bstocks-governance/README.md).

## Outcome

Recovered the missing NVDAB beacon source locally with an exact deployed-bytecode
match, including metadata. Identified both previously unresolved contract
authorities as transparent upgradeable proxies executing OperatorWallet and
BurnWallet logic. Their powers are now inspectable; the identified upgrade and
ownership concentration remains a material review finding.

This closes the public source-recovery research task. It does not provide an
independent audit, supported scanner coverage, approved risk exceptions or issuer
eligibility. The current application collector still requires its existing
source/governance checks and does not consume this local research artifact.
No trading clearance or policy exception was issued; the review registry stays
empty and application behavior is unchanged.

## Canonical evidence and permission checks

Sentio and Blast agree on the complete inspection at BSC block **125081086**
(`0x77495fe`), hash
`0xbcebcca14ff8d5bd440725a47e9f959f29666d9bc8ca1272012b87b424cead7c`,
timestamp **2026-10-01T10:02:41Z**. All code/storage/call reads use that canonical
hash; both sources recheck its canonical header at completion. This replays the
task's initial public observation block and is dated research, not evidence
fresh enough to approve a live trade. Eleven distinct control addresses were
inspected, including two newly resolved inner-wallet control addresses.

Each source passed **12 caller-specific `eth_call` probes**: five expected
successes and seven expected execution reverts. They cover beacon owner upgrade,
both proxy administrator upgrades, outsider rejection, transparent-admin fallback
rejection, owner-only zero-value external execution and owner-only zero-amount
burn. Boolean-returning successful calls must return true. These are ephemeral
simulations with no transaction submission, token spending or persistent changes.
They are sampled checks, not exhaustive authorization/fuzz tests.

Transient HTTP 429/transport failures were not counted as denials. Increasing
Node's network-family connection-attempt timeout to 2,000 ms restored sampled
transport access. BNB Chain returned `missing trie node`; Blockmachine passed
a code probe but later lacked historical state for storage. A newer Blockmachine
inspection also failed on unavailable state. The successful full comparison
uses Blast; Nexus's production recovery sources/configuration remain unchanged.
This establishes only the sampled research interfaces for Blast, not complete
P7 recovery-source qualification.

## Source recovery

Beacon: `0x156d6dce9a4f6139a3406f1f021f1a4880de93a3`.
Runtime: **644 bytes**. Keccak-256:
`0x80fbad22136c0abdce6e0f3cc46cd0572318e01b92dbd5b4d5795ef6e8808711`.

The public Sourcify record was unavailable. Explorer access returned HTTP 403;
sampled IPFS gateways returned 429, required payment or timed out. No paid service
was used. An initial build of public OpenZeppelin source reproduced the entire
executable portion but differed in metadata. Matching the token proxy's published
build paths/settings then reproduced **every beacon runtime byte**.

The preserved input uses OpenZeppelin v5.2.0's four source files, solc
`0.8.24+commit.e11b9ed9`, optimizer 200 runs, Cancun EVM, `viaIR=false`, original
`lib/openzeppelin-contracts/` paths/remappings and IPFS CBOR metadata. The input,
output bytes/hashes and MIT license are versioned. Matching these files does
not establish that the issuer downloaded that particular release. The source's
owner-only upgrade path accepts a replacement implementation with code; it
does not impose an on-chain delay or multisignature threshold.
[Official beacon source](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.2.0/contracts/proxy/beacon/UpgradeableBeacon.sol).

The beacon was not submitted to Sourcify or another explorer. Its external
registry availability is unchanged. Source matching establishes correspondence,
not safety, custody backing or a reviewer's approval.

## Privileged proxy identities

The wallet wrappers both have a 2,145-byte runtime with hash
`0x1fbdf1bd87186de14b3caf88cf1e6fb123c5ab1d105cbd83c8ee092b90496f4c`.
Their implementation/admin storage follows
[EIP-1967](https://eips.ethereum.org/EIPS/eip-1967).
Their beacon slots are empty. Compiler-derived wallet storage agrees with
the public ownership/operator getters at the evidence block.

| Item | OperatorWallet | BurnWallet |
|---|---|---|
| Privileged proxy | `0x5948602680fe4aea08d98302337a2715b3aadad1` | `0xc94e485510c458860f89d23dcb8dd34bd10e6b8b` |
| Implementation | `0xd00eb2a87e7b699b75be975c2edae47d36cf07dd` | `0x72f6389c01bffce7698fa5135cbf75191fe56d17` |
| Application owner | `0xb2f56fc21efe0f3921fc28adecacc36a4bfdcac1` | `0xa42436335a41fa6c82cde224ae2b82c025027e5b` |
| Shared proxy admin | `0x7cfe99c15537753682def016d17d4b29a7cab4ee` | same address |
| Operator | `0xa42436335a41fa6c82cde224ae2b82c025027e5b` | no separate operator in this implementation |
| Local source rebuild | exact runtime including metadata | exact executable portion; metadata differs |
| Proxy-wrapper rebuild | exact executable portion; metadata differs | exact executable portion; metadata differs |

The beacon owner is `0x4333daf4481f281f3d3d2b8735ce80bc00028d0c`.
The beacon owner, wallet owners, operator and shared proxy administrator have
no execution code at the inspected block. These paths therefore do not
establish an on-chain multisignature threshold or timelock. This says nothing
about off-chain MPC, key custody procedures or the real-world controller's
identity. No Safe classification is inferred from the proxy addresses.

## What the controllers can do

OperatorWallet owner can pause/unpause, change its operator and allowed hot
wallets, propose ownership transfer, withdraw its funds and execute arbitrary
external calls while unpaused. Owner/operator mint and transfer helpers constrain
recipients to the wallet or its current hot-wallet list as applicable. The
owner's arbitrary-call path can bypass that wallet-local recipient restriction;
the token's own compliance/pause checks still apply. The inspected wallet is
unpaused with two hot wallets. Neither wallet has a pending ownership transfer.
[OperatorWallet source record](https://sourcify.dev/server/v2/contract/56/0xd00eb2a87e7b699b75be975c2edae47d36cf07dd?fields=all).

BurnWallet owner can burn tokens held by that wallet and initiate a two-step
ownership transfer. The current `burn(token,amount)` method does not accept an
arbitrary holder address. This is not proof that future upgraded logic cannot
have different powers.
[BurnWallet source record](https://sourcify.dev/server/v2/contract/56/0x72f6389c01bffce7698fa5135cbf75191fe56d17?fields=all).

Both proxy upgrade paths share one administrator. That administrator can change
implementation/admin and perform an upgrade with initialization calldata; the
owner/operator controls in the current implementation do not constrain a new
implementation. Transparent-proxy admin calls cannot fall through to the wallet
implementation. The wrapper's source imposes no timelock/threshold on these
upgrade methods.
[Proxy source record](https://sourcify.dev/server/v2/contract/56/0x5948602680fe4aea08d98302337a2715b3aadad1?fields=all).

The separate beacon owner can replace the implementation used by stock proxies
attached to that beacon. Unchanged proxy wrapper code alone would not detect
either kind of implementation change. This is a centralization/governance
finding, not evidence that an exploit occurred.

## Remaining work

| Gap | Result / next requirement |
|---|---|
| Missing beacon source | recovered locally with full exact match; trusted production source adapter still needed |
| Unknown privileged-contract behavior | both wallet proxies identified and current permissions inspected; fresh inner implementation/admin/owner binding still needed in the production collector |
| Governance risk clearance | no acceptance issued; qualified review and an explicitly approved policy are required |
| NVDAB Binance/GoPlus coverage | September 30 unsupported/omitted-field and shared-creator findings remain; this task did not rerun or clear scanners |
| USDT mint findings | unchanged; no risk exception approved |
| Independent full-token audit | no new qualified audit artifact recovered in this source/governance task |
| P5.5/P7 live readiness | eligibility, economic mapping, timely prices/events and remaining execution/deployment gates still apply |

Keep source verification, independent audit coverage and risk acceptance distinct.
A wallet owner signature or terms checkbox cannot substitute for any of them.
