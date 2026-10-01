# USDT/NVDAB full-token security findings

Date: 2026-09-30. Agent/client: Codex. Work items: P5.5d/P7.1.
Decision: [ADR 0026](../decisions/0026-full-token-security-evidence.md).
Machine-readable public evidence: [JSON report](2026-09-30-full-token-security.json).

## Outcome

Security enforcement is implemented, but neither token is cleared for live
trading under the initial policy. NVDAB still has unsupported Binance coverage,
an unavailable beacon source, two unresolved contract authorities and missing
independent contract-scope review. USDT has supported Binance coverage but
minting warnings and no qualified independent review. No risk exception has
been accepted. These findings are not evidence of a confirmed exploit.

Both configured RPCs produced complete current code/control observations after
the retrieval-clock correction: Sentio at block **124974058**, Blockmachine at
**124974062**. Each run binds both tokens to one canonical block/hash. Full
source/control/authority fingerprints agree across the two sources despite
different observation blocks. Both commands intentionally exit **2** for
blocked readiness. Earlier transient probes produced unavailable observations;
they were not relabelled as valid evidence. No user wallet was queried, no
approval requested, and no transaction submitted.

| Token | Exact BSC contract | Verified execution sources | Privileged accounts inspected | Public scanner outcome |
|---|---|---|---|---|
| USDT | `0x55d398326f99059ff775485246999027b3197955` | 1/1 runtime source | 1 owner, no execution code at the inspected block | Binance supported, MID/3 and mint caution; GoPlus mint flag; conservative policy blocks |
| NVDAB | `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` | 4/5: token proxy, implementation, compliance and pause manager; beacon unavailable | 9 unique current role/owner accounts; 2 have contract execution code and unresolved governance | Binance unsupported; GoPlus omits core proxy risk fields and flags another token with the same creator |

Security audit data is not available for NVDAB on this chain. Its unsupported
Binance response's risk labels/items are deliberately excluded. GoPlus's
`honeypot_with_same_creator` finding concerns a shared creator, **not a
demonstrated NVDAB honeypot**. It remains an unresolved provider warning and
cannot be treated as a clear audit. GoPlus explicitly documents omitted fields
and proxy-analysis limitations. [GoPlus response definitions](https://docs.gopluslabs.io/reference/response-details).

## Supported USDT Binance audit

The supported response reports risk level **3 / MID**, buy tax **0**, sell tax
**0**, and `extraInfo.isVerified=null`. No trade/scam category was included in
this response, so it is not complete coverage under Nexus's new policy. The
full supported result, including descriptions, is preserved in JSON. The
reported findings are:

| Provider check title | isHit | Type |
|---|---|---|
| Whitelist Restrictions Not Found | false | CAUTION |
| Cooling-Off Restrictions Not Found | false | CAUTION |
| Blacklist Restrictions Not Found | false | CAUTION |
| Trading Suspension Function Not Found | false | CAUTION |
| Sale Restriction Not Found | false | CAUTION |
| Anti-Whale Mechanism Not Found | false | CAUTION |
| Contract Renounced | false | RISK |
| Self-Destruct Not Found | false | RISK |
| Mintable Detected | true | CAUTION |
| Balance Manipulation Not Detected | false | RISK |
| Malicious Creator Not Found | false | CAUTION |
| Hacking Risk Not Found | false | RISK |
| Upgrade Risk Not Found | false | CAUTION |
| Modifiable Tax Not Found | false | RISK |
| Freezable Authority Accounts Not Found | false | RISK |
| Contract Code Verified | false | CAUTION |

These are literal provider titles/flags, not independent conclusions. In
particular, a negative title/flag must not be interpreted as proof that ownership
was renounced or an independent audit was performed. Current on-chain ownership
and verified source are checked separately. Mint authority is expected in many
centrally issued assets, but accepting its risk requires a separately reviewed
policy; this implementation does not silently grant such permission.

## Source/control inspection

USDT's verified runtime is a direct BEP20 implementation with 18 raw decimals,
owner-gated minting and holder burn. Neither EIP-1967 proxy slot is populated.
Source/raw-transfer review remains in [the recovery semantics report](2026-09-30-token-recovery-semantics.md).
[Verified USDT source](https://sourcify.dev/server/v2/contract/56/0x55d398326f99059ff775485246999027b3197955?fields=all).

NVDAB's verified SecuritiesToken implementation permits admins/issuers to mint
and burn their own token balance under mutable enable switches, update display
multipliers, and admins to replace compliance/pause managers. Raw ERC20 balance
accounting is separate from BEP-677 UI amounts. Transfers consult current pause
and compliance state for sender/recipient and, where applicable, the caller.
Source verification does not make those privileges safe or irreversible.
[Verified implementation](https://sourcify.dev/server/v2/contract/56/0xcfed6c4679297ea4889f8183bc057b4a86c64e46?fields=all).

The compliance source permits privileged changes to per-token blocklists and
global sanctions, including reset/replacement of the sanctions set. The pause
manager permits per-token and global pauses. Their code and role revisions are
fingerprinted; actual wallet/pool/router transfer permission remains a separate
fresh preflight. [Compliance source](https://sourcify.dev/server/v2/contract/56/0x53dba7aabde774787a1f57236b235567da8e14f4?fields=all),
[pause-manager source](https://sourcify.dev/server/v2/contract/56/0x9fc74be63f3589485b2423984a7a0557e0cf700a?fields=all).

The beacon getter/owner and code are readable, but Sourcify returns 404 for
its source. Therefore its complete upgrade behavior is unreviewed, and a
matching code hash cannot fill this gap. Two role-bearing contract accounts also
need governance/delegation review; matching their outer code does not establish
owners, thresholds, modules or implementation controls. The collector reports
them as unresolved. Privileged accounts without code are observable EOA-like
accounts, not proof of single-person custody, MPC protection or key safety.
[Beacon lookup](https://sourcify.dev/server/v2/contract/56/0x156d6dce9a4f6139a3406f1f021f1a4880de93a3?fields=all).

Sourcify source matching proves deployed/source correspondence under its
verification model, not a security audit. [Sourcify match definitions](https://docs.sourcify.dev/docs/exact-match-vs-match/).

## Enforced protections and remaining work

- Require both route denominations, current supported scanner evidence,
  verified executable source closure and an unexpired qualified review.
- Reject partial coverage, positive tax, any risk/caution, stale/missing source,
  omitted settlement report, fake `clear` state/hash, wrong decimals or blocks.
- Bind current implementation, beacon owner, manager addresses/code, role
  sets, switches, mapping and privileged execution code to the review.
- Use canonical hash reads and final canonical checks for security, quantity
  and transfer preflight; resolve the beacon with the proxy as caller.
- Bind detailed security evidence to P7 approval; review/control changes require
  a fresh gate and approval. Preserve already-submitted recovery accounting.

The current registry is empty. To clear this gate, obtain complete beacon and
contract-authority governance evidence, qualified contract-scope reviews, and
supported audit coverage or an explicitly approved **separate** exception
policy. This report does not propose/approve such an exception. Stock backing,
issuer custody, legal access, price/session/event evidence and production
broadcaster qualification remain separate gates.

⚠️ This audit result is for reference only and does not constitute investment advice. Always conduct your own research.
