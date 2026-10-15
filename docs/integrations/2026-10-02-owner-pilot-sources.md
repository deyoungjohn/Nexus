# Owner-pilot primary source recovery — 2026-10-02

Work items P5.5a/P5.5b/P5.5c. This is source recovery, not live clearance.
Machine-readable URL/digest/section references are in the
[source manifest](2026-10-02-owner-pilot-sources.json).

## NVDAB prospectus recovered

The [ADGM approved-prospectus register](https://www.adgm.com/financial-services-regulatory-authority/listing-authority/approved-prospectuses)
contains issuer BTech Holdings Limited (public filter ID 351353). Its publicly
served `mdPages.js` documents a JSON POST to
`/ADGMApprovedProspectus/GetProspectusesAjax` with issuer, pagination and column
configuration. Filtering that register returned the June 11 NVIDIA document.
[The primary PDF](https://www.adgm.com/globalassets/market-disclosure/content/prospectus/btech-holdings-prospectus----11-june---nvidia-bstocks_06_11_2026_16-44-54.pdf)
was downloaded successfully: 4,222,652 bytes, SHA-256
`53b2308780c0da61b80b3bc91e625af7454804d56585f39740f17bccb3cd9378`.
No account or issuer message was needed. A plain Python request initially received
403; a normal browser User-Agent succeeded. Avoid claiming the document is absent
because one request path fails.

The definitions on PDF page 5 explicitly include external on-chain secondary
addresses outside Binance’s CSD. Binance-platform KYC/suitability is expressed for
Binance-platform users purchasing there; secondary representations also apply to
external recipients. Section 3.4.1 (PDF pages 16–17) covers secondary transfer,
non-US/offshore and restricted-jurisdiction representations. External movement
does not remove holding/transfer restrictions or potential freezing/cancellation.

Nigeria is absent from the June restricted-country list on PDF pages 8–9. The same
definition says the list is communicated on Binance and can be amended. Therefore
this is a promising owner-pilot eligibility lead, not confirmation of the current
list or permission for Nexus to serve third-party users. A current restriction
source review and expiring signed declarations are still required. General service
qualification/issuer country-API expectations remain separate.

## Economic terms and remaining interpretation

Sections 3.1–3.2 (PDF pages 13–14) describe certificate/share beneficial exposure,
fractional holdings, issuance rounding, USDC primary issuance/settlement, dividend
reinvestment after withholding and multiplier-based corporate actions. The existing
secondary DEX pair is USDT; primary issuance currency is not automatically a ban on
that pair, nor proof that every venue is permitted.

The document describes eight-place certificate issuance precision; deployed raw
ERC20 transfer units have 18 decimals. Do not equate the two integers. A reviewed
mapping record must explain the on-chain raw/display multiplier calculation and
its certificate/share interpretation, cite terms and exact current source/runtime,
and specify the ratio. A pending or changed multiplier blocks the pilot. The
historical initial multiplier is not substituted for the current chain value.

## Chainlink heartbeat

The [public Chainlink BSC reference directory](https://reference-data-directory.vercel.app/feeds-bsc-mainnet.json)
lists NVDA/USD proxy `0xea5c2Cbb5cD57daC24E26180b19a929F3E9699B8`, eight price
decimals, Equities/NYSE classification, heartbeat **86,400 seconds** and deviation
threshold `0.5`. Recorded directory digest/selected entry are in the manifest.

ADR 0031’s pilot uses actual round time, regular-session admission and an explicit
age-dependent band capped at 2%, including the signed worst fill. The band is a
bounded policy choice, not statistical calibration. A 24-hour heartbeat can leave
a prior-session round admissible by age; it does not prove market stability or rule
out outage. Changed reference values invalidate an existing signature. Monitoring
and source terms remain operational acceptance items before unattended/public use.

No wallet trade, geographic clearance, economic-review activation or independent
audit was performed by this document recovery.
