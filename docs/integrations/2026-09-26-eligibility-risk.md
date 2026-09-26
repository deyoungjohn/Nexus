# Owner attestation and token-risk investigation — 2026-09-26

This is a P5.5 operating note, not a live instrument allowlist or a trade
authorization. Nexus still has no signer or live execution adapter.

## What the owner will do

1. Read Ondo's current [eligibility rules](https://docs.ondo.finance/ondo-stocks/eligibility)
   and [secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions),
   plus the venue's current terms. Confirm that the exact wallet's controller
   is eligible for the proposed side and venue. Resolve any uncertainty with
   the issuer or qualified adviser before attesting. Do not send identity
   documents, keys or a seed phrase to Nexus.
2. Near activation, get the BSC wallet address with `baw wallet address --json`.
   Generate a distinct challenge for each token and side. For the first
   NVDAon buy, the command is:

   ```bash
   mkdir -p .agent-memory/eligibility
   umask 077
   npm --silent run attestation -- challenge "$NEXUS_WALLET" \
     0xa9ee28c80f960b889dfbd1902055218cba016f75 \
     0x1b81D678ffb9C0263b24A97847620C99d213eB14 \
     pancakeswap-v3-direct buy I_ATTEST_ELIGIBLE \
     > .agent-memory/eligibility/nvda-buy-challenge.json
   ```

   Set `NEXUS_WALLET` from the wallet command first. The explicit final
   argument affirms the three statements displayed in the challenge:
   not prohibited, any applicable restrictions satisfied, and terms read.
   Do not use it if any statement is uncertain or false. The challenge expires
   in 24 hours, so signing before other gates are ready will require renewal.
3. Preview the exact EIP-712 payload with Agentic Wallet Developer Mode. The
   `signRequest` string in the challenge is the `--message` argument to
   `baw sign-message preview --binanceChainId 56 --signType EIP712 --json`.
   Inspect `parsedMessage`, `risks` and `authorityChanges`, then approve only
   that message in the app. The preview alone does not sign. The wallet's
   `sign-message execute --requestId ... --json` command must follow a fresh
   preview and explicit owner confirmation. If the app returns pending, use
   `sign-message result --order-id ... --json` after app confirmation.
4. Save `{ "statement": <challenge.statement>, "signature": <wallet signature>,
   "signatureRecovery": <wallet recovery byte if separate> }` in an ignored
   local file under `.agent-memory/eligibility/`. Maintain a local JSON array
   of revoked nonces. `npm --silent run attestation -- verify <signed.json>
   <revocations.json> <wallet> <token> <router> <venueId> <buy|sell>` checks
   signature, scope, time and revocation. To revoke locally, add the nonce to
   the revocations array and pause use. P7 must persist revocations and recheck
   them before each leg; the current CLI is informational only.

The owner representation proves control of the stated wallet and records the
owner's declaration. It does not prove jurisdictional or issuer eligibility,
on-chain transfer permission, or consent to any particular trade. No wallet
address, signature or personal status is stored in Git or MCP memory.

## Why token audits are unsupported

On 2026-09-26, three otherwise identical read-only Binance audit requests
used chain ID `56` and the exact documented contract addresses. NVDAon
`0xa9ee28c80f960b889dfbd1902055218cba016f75` and AAPLon
`0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4` returned HTTP 200,
`code=000000`, `hasResult=false`, `isSupported=false`. BSC USDT
`0x55d398326f99059ff775485246999027b3197955` returned
`hasResult=true`, `isSupported=true`. This reproduces a token-coverage gap;
the API gives no reason for it. It is not evidence of a detected exploit.
GoPlus's published response guide says proxy risk fields may be omitted;
both Ondo responses omitted the fields needed for a clear determination.

Pinned-block BSC reads show both candidates share an EIP-1967 beacon proxy.
At blocks 124188783 and 124188793, respectively, their proxy code hash was
`0x439923c85f956f038ae77871736f789e6d08d22257b6e5fdccfdc83924ecb4d0`;
the beacon was `0xc046b05a920e4b412815934dd8e58904dda73315` with code hash
`0x90d14c8f8d7d3468b5215829b587058c5e7f78acaef6b946c20caa3de92bf410`;
the implementation was `0x578f397ca4661d1db4d9a65065d6b284a1a850fd` with code hash
`0x85d44c72e84a34f0b4a3bceca35289b10bd0c5510c5a441466a755e903edc36a`.
The read-only adapter rejects wrong chain, stale block, missing code and
unresolved beacon. These identities can detect an upgrade, but do not assess
the implementation or admin powers. Ondo publishes [Stocks contract audits](https://docs.ondo.finance/audits),
yet no reviewed report has been mapped to this exact runtime code hash here.

Sourcify's [BSC runtime-source lookup](https://sourcify.dev/server/v2/contract/56/0x578f397ca4661d1db4d9a65065d6b284a1a850fd?fields=all)
reports a `match` for `GMToken`. Its published source exposes role-gated mint,
admin burn, and configuration of compliance and pause managers; its transfer
hook checks the sender/receiver (and sometimes the caller) against compliance
and checks the pause manager. The [beacon lookup](https://sourcify.dev/server/v2/contract/56/0xc046b05a920e4b412815934dd8e58904dda73315?fields=all)
exposes an owner-controlled `upgradeTo`. `match` is verified source
provenance, not a security assessment or a promise that privileged controls
will remain unchanged. Read-only BSC calls at block `0x7670306` found both
tokens using compliance contract `0x76be569c94c39a2e2492de2f4d1c253f348250d0`
and pause manager `0x6334924c787ebd21c881740ef6237ef51962638f`;
the beacon owner was `0x8860bbfc7a83e4788a981f4e9f30878331413b26`.
Those pointers and role memberships can change without changing the token or
implementation bytecode, so the existing fingerprint alone is insufficient
for a reviewed exception. A future review must bind and recheck them.

Current risk state remains `unsupported` in P5. A supported audit, or an
explicitly approved narrowly scoped exception with independent code-scope
review, fresh implementation and control identities, token status and actual-size route
simulation, is required before a live risk decision. No exception is active.
