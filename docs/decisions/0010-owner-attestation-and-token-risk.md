# ADR 0010: Bind owner declarations and keep unsupported token risk blocked

- Status: accepted for read-only P5.5 groundwork; risk exception decision pending
- Date: 2026-09-26
- Owners: Codex (implementation); project owner (risk acceptance)

## Context

Ondo's published eligibility rules prohibit specified persons and impose
additional conditions in some jurisdictions. A secondary-market acquisition
constitutes a representation by the buyer, but a connected wallet and the P2
test fill do not produce a reusable, wallet-bound record. Binance's BSC token
audit endpoint returns `hasResult=false` and `isSupported=false` for both
NVDAon and AAPLon, while the same request supports BSC USDT. GoPlus omits
important risk fields for these proxy contracts. The providers do not state
why these tokens are unsupported.

## Decision

Offer a 24-hour EIP-712 owner representation scoped to chain 56, exact wallet,
token, direct-V3 router, venue, side and nonce. The owner must explicitly
affirm the issuer restrictions before a challenge is generated. Verify the
wallet signature, expiry and a revocation lookup at each use. Keep signed
records and revocations outside Git. This verifies wallet control and records
the owner's declaration; it does not establish issuer KYC, legal eligibility,
current transfer permission or an owner trade approval. A production adapter
must check transfer/venue state separately and use durable revocation state.

For token risk, read the EIP-1967 beacon, its implementation and all three
code hashes at one pinned BSC block. A change invalidates any review of that
implementation. A matching fingerprint is an identity check, not a security
audit. Sourcify's verified runtime source shows role-gated mint/admin burn,
configurable compliance and pause managers, and an upgradeable beacon. A
future exception must also bind current control addresses, privileged roles
and actual-size transfer behavior because these can change without code-hash
changes. Continue to return `unsupported` at P5 until either a supported token
audit becomes available or the owner explicitly approves a separate,
time-limited policy exception after contract-scope review and current route
simulation. An exception must be represented distinctly from `clear`, bound
to exact token and implementation identities, and revoked on change. This ADR
does not itself authorize that exception.

## Consequences

An owner can prepare a signed, short-lived declaration without sharing
identity documents or keys with Nexus. The declaration and beacon fingerprint
remain read-only groundwork and do not enable the application to trade. The
Binance provider's unsupported response is a coverage limitation, not proof
of a failed risk check or a clean token. The exact reason for noncoverage is
not exposed by that API. P7 still needs durable revocation, approval binding,
pre-leg checks and transaction recovery.

Sources: [Ondo eligibility](https://docs.ondo.finance/ondo-stocks/eligibility),
[secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions),
[Ondo audit index](https://docs.ondo.finance/audits),
[GoPlus response details](https://docs.gopluslabs.io/reference/response-details),
[Sourcify verified implementation](https://sourcify.dev/server/v2/contract/56/0x578f397ca4661d1db4d9a65065d6b284a1a850fd?fields=all),
[EIP-712 signature verification](https://docs.ethers.org/v6/api/hashing/).
