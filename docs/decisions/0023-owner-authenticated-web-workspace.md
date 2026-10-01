# ADR 0023: Authenticate saved web state with an EOA challenge

- Status: accepted; offline increment implemented
- Date: 2026-09-30
- Owners: Codex

## Decision

Provide a separate saved workspace backed by the existing PostgreSQL modules.
Use a server-created ERC-4361-shaped sign-in message and EIP-191 EOA signature
to establish a one-hour session. Bind the challenge to configured origin,
chain 56, checksum wallet, random nonce and five-minute expiry. Verify the
stored exact message; consume the challenge once under row lock. Persist only
the digest of a random session token. Use an HttpOnly, SameSite=Strict cookie,
Secure on HTTPS, and reject mutation requests from another origin.

Every read and command is restricted to the session wallet's bound portfolio.
Expose P6 draft/review/activation, stored portfolio/decision/P7 receipt display,
and the existing server pause command. Browser-local fixture approvals retain
no authority. Do not accept a valuation, registry entry, chain observation or
signed execution envelope from these web rule commands. Trade approval remains
unavailable until a server-owned P5/P7 executable envelope exists.

## Consequences

The saved workspace can preserve rules and inspect backend records without
adding an execution path. Wallet sign-in authenticates control only; it proves
neither provider eligibility nor trade approval. Empty new portfolios start
paused with zero unsynchronized balances. The database and reviewed instrument
registry are deployment prerequisites; absent configuration yields an explicit
unavailable state. Public deployment still requires rate limits, operational
session cleanup and broader accessibility/release validation.

Source: [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361).

The web build/dev commands select Webpack with Next's extension-alias setting
so shared NodeNext `.js` specifiers resolve to their original TypeScript.
Headless emitted imports and module APIs stay compatible. Production browser
checks build/start the app and use an isolated disposable PostgreSQL schema;
they do not rely on development reload behavior or invoke a live signer.
