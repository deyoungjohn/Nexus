# Eligibility verification and third-party integration challenges

Reviewed: 2026-09-30. Agent/client: Codex. Work items: P5.5c, P5.5e;
dependencies: P5.5a/P5.5b/P5.5d and P7. Filename preserves the requested spelling.
This is a source-backed assessment, not issuer approval or a provider switch.

## The major roadblock

Nexus can connect a wallet, save investment instructions and evaluate a route,
but it cannot yet establish production bStocks access for the person using
that wallet. The missing link is a documented, usable way to combine the
issuer's country decision with an acceptable user-verification process for
an independent application.

The [official bStocks FAQ, sections 15–16](https://www.binance.com/en-NG/support/faq/detail/f0c03cd6509a4085b4cce1636f16be38)
assigns geographic enforcement to third-party apps, expects use of a public
country-eligibility API, and directs integrators to contact
[bStocks](https://bstocks.finance/). It does not identify the API URL or schema
in that section. This review did not locate verified endpoint documentation.
Issuer-site retrieval failed in the research tool; that does not establish
that the site is unavailable to everyone. Ordinary Binance support is not
the only possible documentation/contact channel.

The owner reports difficulty reaching Binance support and time pressure.
There is no support transcript, issuer response or promised response date in
this record. We should not describe that delay as a formal rejection.

### What is outside our control, and what is not?

We cannot publish an issuer's missing specification, determine its eligibility
decisions, obtain a response on demand, or grant ourselves permission where
permission is required. **That external dependency cannot be solved by adding
a checkbox or changing a test.**

We can discover published sources, assess route-specific requirements, build
the verification flow, integrate an acceptable identity/location provider,
handle expiry and revocation, test failures and reconsider providers. Not all
current evidence requirements are express issuer mandates: some are Nexus's
conservative design choices recorded in
[ADR 0018](decisions/0018-bstocks-access-evidence.md). Any change to that policy
needs a reviewed decision and tests, rather than treating assumptions as
mandatory issuer rules or silently weakening the gate.

This is the principal unresolved **bStocks access dependency**, but not the
only remaining live-launch obstacle. Free reference-price freshness,
historical RPC coverage, token-risk/economic-mapping review, event sources,
production execution wiring and recovery still have open gates. See
[PROJECT_STATE](PROJECT_STATE.md) and the
[free-source report](integrations/2026-09-30-free-source-readiness.md).

## Why agreement to terms is only part of verification

A modal records consent and declarations. A wallet signature proves control
of a key. A country policy identifies where a product is available. Location
signals indicate access location. On-chain preflight tests transfer controls.
These answer different questions; no single one proves all the others.

We can make onboarding lighter by retaining versioned acceptance, reusing
valid evidence and running checks in the background. The exact checks must
follow the selected provider, venue and activity. Nexus browsing and synthetic
planning need not acquire the same permission as a live securities trade.
We have not established a universal requirement for paid KYC, a Binance
account, or bespoke issuer permission for every EOA DEX user. A popup alone
does not satisfy the currently accepted bStocks evidence policy.

## xStocks: verification belongs to the platform and activity

The [xStocks integration FAQ](https://xstocks.com/partner) explicitly separates
permissionless tokens from platform compliance: token transfers do not require
token-level KYC, while the integrating venue handles applicable onboarding
and KYC. Partners must enforce geographic restrictions. Its
[main site](https://xstocks.com/) also says partner integrations undergo
eligibility review. This does not describe an exemption for every independent
DEX interface.

For **direct issuance/redemption**, the
[primary-market documentation](https://docs.xstocks.fi/docs/issuance-and-redemption)
requires issuer onboarding, KYC/AML and whitelisted wallets. For **CEX
integration**, the [exchange guide](https://docs.xstocks.fi/docs/exchange-integration)
offers either direct issuer onboarding or supply from an already onboarded
market maker. The latter avoids direct issuer onboarding for the exchange;
it does not remove the exchange's own regulatory responsibilities or establish
that this model applies unchanged to Nexus.

Public data endpoints are available without authentication; client-specific
and RFQ operations require an API key. Public metadata access therefore
does not confer trading eligibility. See the
[developer guide](https://docs.xstocks.fi/developers).

**Important country distinction:** Backed's
[restricted-country page](https://assets.backed.fi/legal-documentation/restricted-countries)
lists Nigeria as non-serviceable, separately from its prohibited-country
category. Its [onboarding page](https://assets.backed.fi/onboarding) says
issuer accounts are not serviced there. That directly matters to issuer
account/issuance/redemption access; it is insufficient evidence to declare
all third-party secondary trading either permitted or prohibited. A relevant
venue's terms and the product documents still need review.

The [product legal overview](https://docs.xstocks.fi/docs/product-legal-overview)
places regulatory responsibility on distributors and explains that licensing
requirements vary by jurisdiction. Technically transferable tokens do not
by themselves settle whether Nexus may distribute or facilitate them for a
particular user.

**Implication:** xStocks has clearer published integration guidance, but it
does not eliminate platform eligibility duties, partner-review uncertainty,
or the documented thin BSC liquidity. It is not a verified shortcut.

## Ondo Stocks: distinguish secondary acquisition from issuer services

Ondo's [secondary-market restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions)
say acquiring a token carries representations about eligibility, disclosures,
risk understanding and suitability. Issuer redemption requires customer due
diligence/KYC; a secondary buyer may not qualify to redeem. The
[official Stocks FAQ](https://ondo.finance/ondo-stocks) expressly acknowledges
that tokens can be acquired or held through third-party venues without
issuer onboarding, subject to restrictions.

For **direct issuer access**, the
[onboarding guide](https://docs.ondo.finance/ondo-stocks/onboarding-and-kyc)
describes Persona identity/business verification, required agreements and
approval of linked wallets. The [API overview](https://docs.ondo.finance/api-reference/overview)
uses whitelisted primary purchasers and issuer-signed mint/redeem attestations.
The [API quickstart](https://docs.ondo.finance/api-reference/quickstart)
requires onboarding/contact for API keys and authenticates requests. These
issuer attestations are different from Nexus's wallet-signed declaration;
we cannot generate the issuer's authorization ourselves.

For **secondary-market Nexus use**, issuer-account KYC is not established as
a blanket prerequisite by these sources. That corrects any earlier inference
that all Ondo use must pass its direct-account onboarding. Nexus still needs
an appropriate verification process and geographic/person restrictions under
the [eligibility policy](https://docs.ondo.finance/ondo-stocks/eligibility),
applicable venue terms and local requirements. Nigeria does not appear on the
reviewed Ondo prohibited/restricted jurisdiction lists; absence is not an
affirmative approval for a user or for Nexus. Partners also commit not to
offer relevant services in prohibited jurisdictions. The
[partner page](https://docs.ondo.finance/ondo-stocks/partners-and-media)
directs businesses offering client services to support; no complete reusable
third-party user-verification API was established by this review.

**Implication:** Ondo provides the clearest reviewed distinction between
secondary-market declarations and direct-issuer KYC. A declaration plus
appropriate server-side checks is a candidate for policy review, not an
approved eligibility adapter or assurance that a modal alone is sufficient.
Issuer APIs would introduce an external onboarding dependency again.

## Comparison for Nexus

| Question | bStocks | xStocks | Ondo Stocks |
| --- | --- | --- | --- |
| Main missing access evidence | Official country API specification and reviewed verification process | Applicable platform process and integration-review scope | Reviewed secondary-market process, venue requirements and user evidence |
| Direct issuer services | Separate from the investigated DEX route | KYC/AML and wallet whitelist | KYC/KYB, approved wallets and issuer authorization |
| Existing-token DEX use | Current Nexus composer remains blocked | Token layer is permissionless; platform duties remain | Secondary acquisition is distinct from issuer onboarding |
| Public guidance eliminates all contact? | Not established | No blanket exemption established | Not established for partnerships; direct API access needs onboarding |
| BSC liquidity evidence | Strongest in the dated survey | Thin/poor routes in that survey | Incomplete comparison because most Sunday quotes were market-hour blocked |

Access-source links are in the provider sections above. Liquidity statements
refer only to the [2026-09-27 empirical survey](research/2026-09-27-bsc-stock-liquidity.md):
100-USDT equity quotes succeeded for 66/67 bStocks, 4/96 xStocks and 23/329
Ondo listings. These are quote counts, not proof of fair prices or fills.
They are not current liquidity measurements. The bStocks route was separately
[bounded and simulated](integrations/2026-09-27-bstocks-bsc.md) with hypothetical
funding/allowance, not enabled for live Nexus use.

The subsequent [2026-09-30 regular-session Ondo reassessment](research/2026-09-30-ondo-bsc-secondary-routes.md)
finds a directly bounded and conditionally simulated small Nvidia route,
with full input spend and net receipt checked. Apple's direct pool cannot
fill the requested size; aggregator paths need additional review and some
Nvidia paths cross bStocks. Free equity rounds remained over two hours old,
and sampled audits remain unsupported. This improves the route evidence but
does not close access or other live gates and does not authorize a pivot.

## Recommended response to the deadline

1. Keep bStocks as the documented target while gathering the exact country
   API URL/schema, access/rate limits, restriction revisions and acceptable
   third-party verification guidance. Use published documentation or the
   issuer integration channel rather than making general Binance support
   the sole path. No outreach was sent during this work.
2. Reassess **Ondo secondary-market routes on BSC during a regular session**
   first. Inference: clearer secondary-acquisition rules and the earlier
   supervised route make it a stronger research candidate than immediately
   returning to thin xStocks pools. The historical trade supplies no standing
   eligibility or current route guarantee.
3. For each candidate, distinguish direct DEX trading from issuer RFQ/minting,
   write the exact user/venue requirements, and validate a current actual-size
   route with independent price bounds. No issuer API access or account
   eligibility should be assumed from public token transferability.
4. Make a provider switch only after both access evidence and executable
   liquidity pass, recording a new ADR and changing the plan/state. Changing
   chains would be a separate blueprint decision: the current MVP targets BSC.
5. Continue free-source qualification and P7 recovery/runtime work alongside
   this research. Offline/saved-workspace demonstrations can proceed with
   honest labels while live trading remains blocked.

No reversal has been made. [ADR 0012](decisions/0012-bstocks-first-bsc-provider.md)
remains the provider-priority decision; ADR 0018 remains the bStocks control
boundary. This document recommends evidence gathering, not bypassing access
controls. Remaining questions include Nexus's platform classification,
accepted user evidence, direct-redemption availability and current BSC depth.

## Verification and scope

Official public sources were reviewed on 2026-09-30. Missing/dynamic pages,
country-policy scope differences and unverified endpoints are identified as
limitations; marketing terms such as permissionless were not treated as
integration permission. No account was opened, personal wallet requested,
signature collected, message sent or transaction submitted. Application
interfaces and live gate behavior are unchanged.

PostgreSQL-backed baseline: `./scripts/check.sh` passed 139 tests with zero
failures/skips, strict typecheck, headless/web builds and configuration checks.
Post-documentation check also passed 139 tests, zero failures/skips, strict
typecheck, both builds and configuration checks. `git diff --check` passed.
Details are recorded in ENGINEERING_LOG; no new behavior tests were needed
for this documentation-only work.
