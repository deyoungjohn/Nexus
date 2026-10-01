# Specification 0007: P8 web workflow

- Status: fixture and authenticated saved-record workflows implemented; exact execution binding implemented; live source qualification pending
- Date: 2026-09-29
- Authority: [blueprint section 6](../../Nexus.md), [implementation plan](../IMPLEMENTATION_PLAN.md)

## Observable behavior

The Next.js workspace exposes Overview, Plan, Review, Activity and Settings.
Overview can discover an already shared EIP-1193 EOA account and chain with
`eth_accounts` and `eth_chainId`; it never requests connection, signature,
allowance or transaction. Wallet details stay in component memory and are not
included in the browser fixture record.

The Plan form creates a **local synthetic** two-leg basket. Contribution and
reserve are exact cents; weights must sum to 100%; a whole-percent per-leg cap
reduces accepted amounts and retains the remainder as unallocated cash. Review
shows intended and accepted amounts, why a leg was reduced, synthetic prices,
minimum units, fee allowance, evidence source, creation and expiry times. No
result from this form is a P6 compiled rule, P4 portfolio decision, P5 Market
Gate pass, quote or simulation.

The local approval is valid for one plan ID for 15 minutes, is blocked by the
fixture pause and is invalidated when instructions change. It has no EIP-712
signature or server authority. A sample outcome may be recorded once for the
approved plan before expiry; Activity labels it `RECONCILED_FIXTURE` and says
explicitly that no chain transaction or balance reconciliation occurred. A
versioned JSON download carries the same fixture notice. Browser persistence
restores draft, pause and sample receipts only; previews and approvals must be
created again after reload. Settings pause and reset apply to this browser only.

All interactive controls use semantic buttons, associated form labels and
visible keyboard focus. Wallet discovery has a pending state and error message;
invalid form, expired preview and duplicate outcome errors are presented in an
alert. Small-screen navigation remains reachable by horizontal scrolling.

## Compatibility and trust boundary

Existing headless callers remain compatible; additive same-client seams
compose authenticated commands with their original transactions. The fixture
page has no database writes or transaction transport. Its calculations are
deliberately isolated from P4/P6 and must not be passed to execution. Production
UI work must use server-owned authenticated state, the canonical P6 compiler,
P4/P5 decisions and P7 signed-leg/recovery records; no browser-local approval
may be promoted to live authority. [ADR 0021](../decisions/0021-fixture-web-boundary.md)
records this separation.

## Exit evidence and remaining gates

The five named P8 model tests cover reduction/cash preservation, invalid input,
pause/expiry, one-time outcome and persistence invalidation. Three Chromium
browser tests cover the review-to-export path, form error/pause behavior and
mobile keyboard/wallet discovery. `next build web` checks the App Router page
and TypeScript. The full repository check runs the web build; the separate
`npm run web:e2e` command needs an installed Chromium binary. The saved increment provides authenticated wallet ownership, stored portfolio
and P6/P4/P7 records and server pause. Production P8 exit still needs P5/access
composition, exact P7 transaction approval, actual verified chain outcomes,
broader accessibility and completed P5.5/P7 live gates. Fixture records cannot satisfy those
requirements.

## Saved workspace increment: P8.1–P8.4

`/workspace` uses authenticated PostgreSQL state separately from the local
fixture at `/`. A five-minute, single-use sign-in challenge binds origin,
wallet and chain 56. The server verifies the stored exact EIP-191 message and
issues a one-hour, revocable HttpOnly session cookie. Cross-origin writes,
expired/replayed challenges, invalid signatures and foreign portfolios fail
closed. No wallet/signature/session data is written to project memory.

The saved workspace renders current balances/reservations, persisted P6 rules
and review hashes, P4 decision records, P7 receipt/recovery states and server
pause. It saves strictly compiled drafts, activates only the reviewed current
version and exports owner-scoped records. New portfolios start paused with
unsynchronized zero balances; the UI labels that state. It offers only
database-registered instruments and keeps market evidence and trading
unavailable while the P5.5/P7 gates remain open. Source adapters, valuation
inputs and signing envelopes are server-owned and cannot be supplied through
these rule endpoints. See [ADR 0023](../decisions/0023-owner-authenticated-web-workspace.md).

Saved commands are strictly `create-portfolio`, `save-rule`, `set-rule-state`
and `set-pause`. Basket/price creation is available; earnings creation rejects
browser revisions until a trusted event source is integrated. The API does not
accept trade/evidence inputs. HTTP mutations require the exact configured
origin and JSON bodies no larger than 16 KiB. Record responses are uncached;
HTTPS session cookies use the `__Host-` prefix. Account/chain changes revoke
the session, and late reads cannot restore a previous wallet's screen.

Verification includes four saved-workspace Chromium tests against the production
build/start server and isolated PostgreSQL schema: message sign-in/canonical
rule activation/P4 decision/export/pause/reload; exact-origin and body limits,
challenge replay, foreign portfolio and revoked session; wrong-chain mobile
keyboard/error flow; and delayed record response after wallet change. The
three original fixture browser cases remain passing. No browser test requests
an on-chain transaction or typed trade approval signature.


## Exact execution panel (2026-10-01)

The Review tab now includes owner-scoped accepted-leg records from `/api/execution`.
A fresh server review shows exact raw bounds, route, nonce, gas, expiry and evidence;
an explicit checkbox precedes EIP-712 approval. Transaction signing/storage and
submission are separate actions. Unsupported raw signing supports explicit import,
never wallet-side send. Imported/returned bytes, account/chain/session and payload
match are checked; the guarded server independently verifies authority and evidence.
Configuration reload, expiry or changed facts require a fresh review. Persisted signed
legs survive reload; submitted/unknown states await historical recovery, not another
send. Safe list/download records omit signed bytes and approval signatures. Origin,
body limits, authentication and uncached responses apply. Production sources default
unconfigured and broadcast remains disabled; no live admission is implied. ADR 0030
and the execution runbook record configuration and the remaining qualification gates.
