# bStocks access control for Nexus

Status: P5.5c fail-closed access composer and P5 binding implemented with
synthetic tests; no production country/person adapter or live bStocks route is
enabled. This runbook implements the EOA-first
boundary in [ADR 0016](../decisions/0016-eoa-first-wallet-execution.md).

Binance's [bStocks FAQ](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
says third-party applications must enforce geographic restrictions, refers to
a public country-eligibility REST endpoint, and describes issuer-controlled
wallet restrictions. The reviewed FAQ does not publish an endpoint path or
establish that any particular jurisdiction or person is eligible. A Binance
trading page, wallet signature, IP address, VPN state or successful DEX quote
is not eligibility evidence.

For each proposed bStocks leg, Nexus must apply this sequence on its trusted
server, before showing an actionable transaction and again before accepting
an owner-signed transaction for submission:

1. Bind an authenticated user session to the exact EOA through a fresh wallet
   challenge signature. This proves wallet control only. Keep raw identity
   material out of Git, logs and shared project memory.
2. Establish the user's applicable jurisdiction and person-level restrictions
   through a provider-approved or otherwise reviewed evidence process. Use
   network location only as a supporting signal; it cannot prove residence
   or eligibility. Conflicting, expired or absent evidence means `unknown`.
3. Query the provider's authenticated and documented country-eligibility
   source for the relevant jurisdiction. Bind the response to its source,
   retrieval time, revision/expiry, product and jurisdiction. Denied, stale,
   malformed or unavailable results block. Do not infer a result from a
   localized site or invent an API path.
4. Check the exact token's applicable product/venue restrictions and current
   issuer notices. For an account-based venue, apply its account permission;
   a direct EOA DEX route has no universal Binance account-status requirement.
5. At a fresh BSC block, check the exact EOA, pool and router against the
   bStock compliance contract and pause manager, using the P5.5c transfer
   preflight. A transfer pass does not prove geographic permission.
6. Create P5 `EligibilityEvidence` only after all required route-specific
   checks pass. Bind it to the wallet, instrument, side, venue, timestamps,
   source revisions and a short expiry. Re-evaluate before each leg, after
   any wallet/route/policy change, and after a sequential fill. P7 rejects a
   changed evidence hash or approval envelope.

Enforce this on every Nexus API that prepares or submits a bStocks trade;
front-end hiding alone is insufficient. Nexus can control trades through its
own service, not independent transactions a user sends from the same EOA.
The issuer's on-chain controls are separate and may change between preflight
and inclusion. Product information can remain visible with a clear unavailable
state; no executable calldata is issued when the result is `denied` or
`unknown`.

Implementation gates: obtain the official country endpoint and its schema;
decide an acceptable, privacy-preserving user-jurisdiction evidence process;
review applicable person/venue restrictions; test denied, VPN/location
conflict, stale/unavailable provider, blocked wallet/pool/router, changed
country result, expired session and pre-submission recheck. Until those gates
are met, P5.5c cannot generate live bStocks eligibility evidence.

Implemented boundary: `src/market-gate/bstocks-access.ts` issues a five-minute
EIP-712 session/EOA challenge through an atomic challenge-store port. Its
verifier yields a short-lived wallet binding, which the future authenticated
server must persist. `assessBStocksAccess` reads only trusted server ports for
session, reviewed person/jurisdiction, official country and product decisions;
it calls the existing pinned-block NVDAB transfer preflight itself. Missing or
changed source revisions, country/location conflict, restricted person,
provider outage, blocked route party or expired binding returns no evidence.
The output contains an access hash and route/control revision, without the
person's country. P5 requires that output for bStocks; changed access hashes
invalidate P7's exact owner approval. [ADR 0018](../decisions/0018-bstocks-access-evidence.md)
records the trust boundary. The current country port is an interface only:
the official endpoint/schema and reviewed jurisdiction provider are still
needed before a production implementation can return an allowed result.
